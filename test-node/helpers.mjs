import { DatabaseSync } from 'node:sqlite';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { webcrypto } from 'node:crypto';

export function database() {
  const db = new DatabaseSync(':memory:');
  return {
    raw: db,
    prepare(sql) {
      let values = [];
      return {
        bind(...args) { if (args.length > 100) throw new Error('D1 parameter limit'); values = args; return this; },
        async run() { const result = db.prepare(sql).run(...values); return { success: true, meta: { changes: Number(result.changes) } }; },
        async first() { return db.prepare(sql).get(...values) || null; },
        async all() { return { results: db.prepare(sql).all(...values), success: true }; },
      };
    },
    async batch(statements) {
      db.exec('BEGIN');
      try { const results = []; for (const statement of statements) results.push(await statement.run()); db.exec('COMMIT'); return results; }
      catch (error) { db.exec('ROLLBACK'); throw error; }
    },
  };
}
export const to64 = (data) => Buffer.from(data).toString('base64url');
export const from64 = (data) => new Uint8Array(Buffer.from(data, 'base64url'));
const enc = new TextEncoder();
export async function crypt(secret, value, { envelope, context, direction = 'request', version = 1 } = {}) {
  const salt = envelope ? from64(envelope.salt) : crypto.getRandomValues(new Uint8Array(16));
  const iv = envelope ? from64(envelope.iv) : crypto.getRandomValues(new Uint8Array(12));
  const material = await crypto.subtle.importKey('raw', enc.encode(secret), version === 2 ? 'HKDF' : 'PBKDF2', false, ['deriveKey']);
  const key = await crypto.subtle.deriveKey(version === 2
    ? { name: 'HKDF', hash: 'SHA-256', salt, info: enc.encode('cookie-share/device-protocol/v2') }
    : { name: 'PBKDF2', hash: 'SHA-256', salt, iterations: 100000 }, material, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
  const params = { name: 'AES-GCM', iv, ...(context ? { additionalData: enc.encode(JSON.stringify({ ...context, direction })) } : {}) };
  if (envelope) return JSON.parse(new TextDecoder().decode(await crypto.subtle.decrypt(params, key, from64(envelope.payload))));
  const payload = await crypto.subtle.encrypt(params, key, enc.encode(JSON.stringify(value)));
  return { version, salt: to64(salt), iv: to64(iv), payload: to64(payload) };
}
export async function decode(response, secret, options = {}) {
  return crypt(secret, null, { envelope: await response.json(), ...options });
}
export const sample = (overrides = {}) => ({ name: 'session', value: 'secret-cookie', domain: 'example.com',
  path: '/', hostOnly: true, secure: true, httpOnly: true, sameSite: 'lax', session: true, ...overrides });

export function userscript({ initial = [], failSet, failDelete, failList, gmRequest, nativeConfirm = () => true } = {}) {
  const saved = new Map();
  let jar = structuredClone(initial);
  const calls = [];
  const location = new URL('https://example.com/');
  location.reload = () => calls.push(['reload']);
  const window = { location, prompt: () => null, confirm: nativeConfirm };
  window.top = window; window.self = window;
  const normalizeDomain = (domain) => domain.replace(/^\./, '');
  const cookieId = (cookie) => JSON.stringify([cookie.name, normalizeDomain(cookie.domain), cookie.path || '/', cookie.partitionKey || null]);
  const context = vm.createContext({
    window, URL, TextEncoder, TextDecoder, Uint8Array, crypto: webcrypto, console, queueMicrotask,
    setTimeout, clearTimeout, btoa, atob, AbortController,
    navigator: { platform: 'Linux', language: 'en' }, document: {},
    GM_getValue: (key, fallback) => saved.has(key) ? saved.get(key) : fallback,
    GM_setValue: (key, value) => saved.set(key, value),
    GM_deleteValue: (key) => saved.delete(key), GM_listValues: () => [...saved.keys()],
    GM_xmlhttpRequest: gmRequest || (() => { throw new Error('Unexpected network request'); }),
    GM_cookie: {
      list(details, callback) {
        calls.push(['list', details]);
        queueMicrotask(() => {
          if (failList) return callback(null, 'list denied');
          const url = new URL(details.url || location.href);
          const result = jar.filter((c) => (url.hostname === normalizeDomain(c.domain) || (!c.hostOnly && url.hostname.endsWith('.' + normalizeDomain(c.domain)))) && url.pathname.startsWith(c.path || '/'));
          callback(structuredClone(result), null);
        });
      },
      set(details, callback) {
        calls.push(['set', details]);
        queueMicrotask(() => {
          if (failSet?.(details, calls)) return callback('set denied');
          const cookie = { ...details, domain: details.domain || new URL(details.url).hostname,
            hostOnly: !details.domain, sameSite: details.sameSite || 'unspecified', session: details.expirationDate === undefined };
          jar = jar.filter((c) => cookieId(c) !== cookieId(cookie));
          jar.push(cookie); callback();
        });
      },
      delete(details, callback) {
        calls.push(['delete', details]);
        queueMicrotask(() => {
          if (failDelete?.(details, calls)) return callback('delete denied');
          const url = new URL(details.url);
          const matches = jar.map((c, index) => ({ c, index })).filter(({ c }) => c.name === details.name &&
            (url.hostname === normalizeDomain(c.domain) || (!c.hostOnly && url.hostname.endsWith('.' + normalizeDomain(c.domain)))) &&
            url.pathname.startsWith(c.path || '/') && JSON.stringify(c.partitionKey || null) === JSON.stringify(details.partitionKey || null));
          matches.sort((a, b) => (b.c.path || '/').length - (a.c.path || '/').length);
          if (matches.length) jar.splice(matches[0].index, 1);
          callback();
        });
      },
    },
  });
  let source = readFileSync(new URL('../tampermonkey/cookie-share.user.js', import.meta.url), 'utf8');
  source = source.replace('  init();\n})();', `  globalThis.subject = { cookieManager, validateCookieImport, utils, transportCrypto, configManager, deviceCipher, api, capabilities, getTransportSecret, getServerUrl, configureSecret };\n})();`);
  vm.runInContext(source, context);
  return { subject: context.subject, saved, calls, context, cookies: () => structuredClone(jar) };
}
