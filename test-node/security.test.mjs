import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import worker from '../_worker.js';
import { database, crypt, decode, sample, userscript, to64 } from './helpers.mjs';
const base = 'https://worker.test/legacy-path';
const admin = 'legacy-admin-password';
const secret = 'legacy-transport-password';
const device = 'd'.repeat(43);
function environment(extra = {}) { return { COOKIE_DB: database(), PATH_SECRET: 'legacy-path', ADMIN_PASSWORD: admin, TRANSPORT_SECRET: secret, ...extra }; }
async function request(env, path, { method = 'GET', body, key = secret, headers = {} } = {}) {
  return worker.fetch(new Request(base + path, { method, headers, ...(body === undefined ? {} : { body: JSON.stringify(await crypt(key, body)) }) }), env);
}
async function save(env, id = 'record1', changes = {}) { return request(env, '/send-cookies', { method: 'POST', body: { id, url: 'https://example.com/account?token=private#secret', cookies: [sample()], ...changes } }); }
const adminHeaders = { 'X-Admin-Password': admin };

test('old clients can store/read/delete using the unchanged v1 encryption protocol', async () => {
  const env = environment();
  assert.equal((await save(env)).status, 200);
  const result = await decode(await request(env, '/receive-cookies/record1'), secret);
  assert.equal(result.cookies[0].value, 'secret-cookie');
  assert.equal(result.url, 'https://example.com/account');
  assert.equal(result.revision, 1);
  assert.equal((await request(env, '/delete', { method: 'DELETE', body: { key: 'record1' } })).status, 200);
  assert.equal((await request(env, '/receive-cookies/record1')).status, 404);
});
test('existing D1 schema upgrades additively and old plaintext rows remain readable', async () => {
  const env = environment();
  env.COOKIE_DB.raw.exec('CREATE TABLE cookie_records(id TEXT PRIMARY KEY,url TEXT,host TEXT,cookies_json TEXT,created_at TEXT,updated_at TEXT)');
  env.COOKIE_DB.raw.prepare('INSERT INTO cookie_records VALUES(?,?,?,?,?,?)').run('old1', 'https://example.com/', 'example.com', JSON.stringify([sample()]), '2025-01-01', '2025-01-01');
  const result = await decode(await request(env, '/receive-cookies/old1'), secret);
  assert.equal(result.cookies[0].value, 'secret-cookie'); assert.equal(result.revision, 1);
});
test('same-ID legacy overwrite remains available; conditional writes detect races/deletions', async () => {
  const env = environment();
  await save(env); await save(env);
  assert.equal((await save(env, 'record1', { createOnly: true })).status, 409);
  assert.equal((await save(env, 'record1', { expectedRevision: 1 })).status, 409);
  assert.equal((await save(env, 'record1', { expectedRevision: 2 })).status, 200);
  await request(env, '/delete', { method: 'DELETE', body: { key: 'record1' } });
  assert.equal((await save(env, 'record1', { expectedRevision: 3 })).status, 409);
  assert.equal((await request(env, '/receive-cookies/record1')).status, 404);
});
test('invalid routes return cheap plain JSON and all responses prohibit storage', async () => {
  const response = await worker.fetch(new Request('https://worker.test/no-secret'), environment());
  assert.equal(response.status, 404); assert.equal((await response.json()).version, undefined);
  assert.equal(response.headers.get('cache-control'), 'no-store');
  assert.equal(response.headers.get('referrer-policy'), 'no-referrer');
});
test('body limit is enforced before expensive crypto, including streaming bodies', async () => {
  const env = environment();
  const response = await worker.fetch(new Request(base + '/send-cookies', { method: 'POST', headers: { 'Content-Length': '9000000' }, body: '{}' }), env);
  assert.equal(response.status, 413);
  const large = 'x'.repeat(8 * 1024 * 1024 + 1);
  const streamed = await worker.fetch(new Request(base + '/send-cookies', { method: 'POST', body: large }), env);
  assert.equal(streamed.status, 413);
});
test('strict mode rejects uncredentialed legacy reads/writes without querying cookie payloads', async () => {
  const env = environment({ REQUIRE_CLIENT_AUTH: 'true' });
  assert.equal((await request(env, '/receive-cookies/id')).status, 401);
  assert.equal((await save(env)).status, 401);
  assert.equal((await request(env, '/capabilities')).status, 200);
});
test('device credential restricts listing, reads, writes and deletes independently', async () => {
  const env = environment({ DEVICE_TOKENS: JSON.stringify([{ token: device, records: ['one'], permissions: ['read'] }]) });
  await save(env, 'one'); await save(env, 'two');
  const headers = { Authorization: 'Bearer ' + device };
  const list = await decode(await request(env, '/list-cookies-by-host/example.com', { headers }), device);
  assert.deepEqual(list.cookies.map((c) => c.id), ['one']);
  assert.equal((await request(env, '/receive-cookies/two', { headers })).status, 403);
  assert.equal((await request(env, '/send-cookies', { method: 'POST', headers, key: device, body: { id: 'one', url: 'https://example.com/', cookies: [sample()] } })).status, 403);
  assert.equal((await request(env, '/delete', { method: 'DELETE', headers, key: device, body: { key: 'one' } })).status, 403);
});
test('revoked and expired device tokens fail closed', async () => {
  const env = environment({ DEVICE_TOKENS: JSON.stringify([{ token: device, records: ['*'], permissions: ['read'], expiresAt: '2000-01-01' }]) });
  assert.equal((await request(env, '/receive-cookies/a', { headers: { Authorization: 'Bearer ' + device } })).status, 401);
  env.DEVICE_TOKENS = '[]';
  assert.equal((await request(env, '/receive-cookies/a', { headers: { Authorization: 'Bearer ' + device } })).status, 401);
});
test('v2 HKDF/AAD interop, replay rejection and cross-route binding', async () => {
  const env = environment({ REQUIRE_CLIENT_AUTH: 'true', DEVICE_TOKENS: JSON.stringify([{ token: device, records: ['*'], permissions: ['read', 'write', 'delete'] }]) });
  const path = '/send-cookies';
  const context = { method: 'POST', path: '/legacy-path' + path, requestId: to64(crypto.getRandomValues(new Uint8Array(16))), timestamp: Date.now() };
  const headers = { Authorization: 'Bearer ' + device, 'X-Cookie-Protocol': '2', 'X-Request-Id': context.requestId, 'X-Request-Time': String(context.timestamp) };
  const body = JSON.stringify(await crypt(device, { id: 'new1', url: 'https://example.com/', cookies: [sample()] }, { context, version: 2 }));
  const response = await worker.fetch(new Request(base + path, { method: 'POST', headers, body }), env);
  assert.equal(response.status, 200);
  assert.equal((await decode(response, device, { context, version: 2, direction: 'response' })).success, true);
  assert.equal((await worker.fetch(new Request(base + path, { method: 'POST', headers, body }), env)).status, 409);
  // Changing the request context without re-encrypting must fail authentication.
  headers['X-Request-Id'] = to64(crypto.getRandomValues(new Uint8Array(16)));
  assert.equal((await worker.fetch(new Request(base + path, { method: 'POST', headers, body }), env)).status, 400);
});
test('at-rest encryption supports mixed plaintext/encrypted rows and key-id rotation', async () => {
  const env = environment(); await save(env, 'old');
  env.STORAGE_KEYS = JSON.stringify({ k1: to64(crypto.getRandomValues(new Uint8Array(32))), k2: to64(crypto.getRandomValues(new Uint8Array(32))) });
  env.STORAGE_KEY_ID = 'k1'; await save(env, 'new');
  const stored = env.COOKIE_DB.raw.prepare('SELECT cookies_json FROM cookie_records WHERE id=?').get('new').cookies_json;
  assert.equal(stored.includes('secret-cookie'), false); assert.equal(JSON.parse(stored).keyId, 'k1');
  env.STORAGE_KEY_ID = 'k2'; await save(env, 'newest');
  for (const id of ['old', 'new', 'newest']) assert.equal((await decode(await request(env, '/receive-cookies/' + id), secret)).cookies[0].value, 'secret-cookie');
});
test('missing historical storage keys fail closed without modifying records', async () => {
  const env = environment({ STORAGE_KEYS: JSON.stringify({ k1: to64(crypto.getRandomValues(new Uint8Array(32))) }), STORAGE_KEY_ID: 'k1' });
  await save(env); const before = env.COOKIE_DB.raw.prepare('SELECT cookies_json FROM cookie_records').get().cookies_json;
  env.STORAGE_KEYS = '{}';
  assert.equal((await request(env, '/receive-cookies/record1')).status, 500);
  assert.equal(env.COOKIE_DB.raw.prepare('SELECT cookies_json FROM cookie_records').get().cookies_json, before);
});
test('admin session login, CSRF, lazy metadata and logout', async () => {
  const env = environment(); await save(env);
  const login = await worker.fetch(new Request(base + '/admin/login', { method: 'POST', headers: { Origin: 'https://worker.test' }, body: JSON.stringify({ password: admin }) }), env);
  assert.equal(login.status, 200);
  const cookie = login.headers.get('set-cookie');
  assert.match(cookie, /HttpOnly/); assert.match(cookie, /Secure/); assert.match(cookie, /SameSite=Strict/);
  const credentials = await login.json();
  const headers = { Cookie: cookie.split(';')[0], 'X-CSRF-Token': credentials.csrfToken };
  assert.equal((await request(env, '/admin/list-cookies?summary=1', { headers: { Cookie: headers.Cookie } })).status, 403);
  const result = await decode(await request(env, '/admin/list-cookies?summary=1', { headers }), credentials.encryptionSecret);
  assert.equal(result.cookies.length, 1); assert.equal(result.cookies[0].cookies, undefined);
  const raw = await decode(await request(env, '/admin/record/record1', { headers }), credentials.encryptionSecret);
  assert.equal(raw.record.cookies[0].value, 'secret-cookie');
  assert.equal((await request(env, '/admin/logout', { method: 'POST', headers })).status, 200);
  assert.equal((await request(env, '/admin/list-cookies', { headers })).status, 401);
});
test('admin HTML has no external executable/CSS dependency, persists no password, and JS parses', async () => {
  const response = await request(environment(), '/admin');
  const html = await response.text();
  assert.equal(/<script[^>]+src=/.test(html), false); assert.equal(html.includes('jsdelivr'), false);
  assert.equal(html.includes('localStorage.setItem(PASSWORD_KEY'), false);
  assert.match(response.headers.get('content-security-policy'), /frame-ancestors 'none'/);
  for (const match of html.matchAll(/<script[^>]*>([\s\S]*?)<\/script>/g)) new vm.Script(match[1]);
});
test('partition keys, empty values and unspecified SameSite round-trip through Worker', async () => {
  const env = environment();
  const c = sample({ value: '', sameSite: 'unspecified', partitionKey: { topLevelSite: 'https://example.com', hasCrossSiteAncestor: false } });
  assert.equal((await save(env, 'partition', { cookies: [c] })).status, 200);
  const received = await decode(await request(env, '/receive-cookies/partition'), secret);
  assert.equal(received.cookies[0].value, ''); assert.equal(received.cookies[0].sameSite, 'unspecified');
  assert.deepEqual(received.cookies[0].partitionKey, c.partitionKey);
});

test('userscript resolves empty values, keeps hostOnly and restores a failed import', async () => {
  const old = sample({ name: 'old', value: 'original' });
  const ok = userscript({ initial: [old] });
  assert.equal(await ok.subject.cookieManager.replaceAll([sample({ value: '' })], 'empty'), 1);
  assert.equal(ok.cookies()[0].value, '');
  assert.equal('domain' in ok.calls.find((c) => c[0] === 'set')[1], false);
  const failed = userscript({ initial: [old], failSet: (c) => c.name === 'session' });
  await assert.rejects(failed.subject.cookieManager.replaceAll([sample()], 'empty'), /restored/);
  assert.equal(failed.cookies()[0].value, 'original');
  assert.ok(failed.saved.has('cookie_share_recovery_example.com'));
});
test('userscript detects partial write and failed rollback instead of falsely reporting success', async () => {
  const subject = userscript({ initial: [sample({ name: 'old' })], failSet: (c) => c.name !== 'ok' });
  await assert.rejects(subject.subject.cookieManager.replaceAll([sample({ name: 'ok' }), sample({ name: 'bad' })]), /RESTORE FAILED/);
  assert.ok(subject.saved.has('cookie_share_recovery_example.com'));
});
test('userscript list errors and domain/prefix validation occur before any deletion', async () => {
  const failed = userscript({ failList: true });
  await assert.rejects(failed.subject.cookieManager.getAll(), /list denied/);
  for (const cookies of [[sample({ domain: 'other.test' })], [sample({ name: '__Host-session', hostOnly: false })], [sample({ sameSite: 'none', secure: false })], [sample({ expirationDate: 1, session: false })]]) {
    const subject = userscript({ initial: [sample()] });
    await assert.rejects(subject.subject.cookieManager.replaceAll(cookies));
    assert.equal(subject.calls.filter((c) => c[0] === 'delete').length, 0);
  }
});
test('userscript rejects cross-site source metadata and overlapping operations', async () => {
  const subject = userscript({ initial: [sample()] });
  await assert.rejects(subject.subject.cookieManager.replaceAll([sample()], '', 'https://evil.test'), /another site/);
  const first = subject.subject.cookieManager.replaceAll([sample({ value: 'first' })]);
  await assert.rejects(subject.subject.cookieManager.replaceAll([sample({ value: 'second' })]), /in progress/);
  await first;
});
test('normal configuration export excludes address and secrets but still imports legacy config', async () => {
  const subject = userscript();
  subject.saved.set('cookie_share_custom_url', 'https://worker.test/private-path');
  subject.saved.set('cookie_share_transport_secret', 'secret'); subject.saved.set('cookie_share_device_token', device);
  const exported = JSON.parse(subject.subject.utils.decodeBase64(subject.subject.configManager.exportToBase64()));
  assert.equal(exported.values.cookie_share_custom_url, undefined);
  assert.equal(exported.values.cookie_share_transport_secret, undefined);
  assert.equal(exported.values.cookie_share_device_token, undefined);
  const legacy = subject.subject.utils.encodeBase64(JSON.stringify({ version: 1, values: { cookie_share_custom_url: 'https://old.test/path', cookie_share_transport_secret: 'previous' } }));
  await subject.subject.configManager.importFromBase64(legacy);
  assert.equal(subject.saved.get('cookie_share_transport_secret'), 'previous');
});
test('userscript device crypto interoperates with server independent vectors', async () => {
  const subject = userscript();
  const context = { method: 'POST', path: '/legacy-path/send-cookies', requestId: 'r'.repeat(22), timestamp: 1000 };
  const envelope = await subject.subject.deviceCipher(device, { value: 'test' }, context);
  assert.equal((await crypt(device, null, { envelope, version: 2, context })).value, 'test');
  const response = await crypt(device, { success: true }, { version: 2, context, direction: 'response' });
  assert.equal((await subject.subject.deviceCipher(device, null, context, response)).success, true);
});
test('credential storage is not auto-filled into page inputs; privileged events require trust', () => {
  const source = readFileSync(new URL('../tampermonkey/cookie-share.user.js', import.meta.url), 'utf8');
  assert.ok(source.includes('attachShadow({ mode: "closed" })'));
  assert.ok(source.includes('if (!e.isTrusted) return;'));
  assert.equal(/transportInput\.value\s*=\s*GM_getValue/.test(source), false);
  assert.equal(/serverInput\.value\s*=\s*GM_getValue/.test(source), false);
  assert.ok(source.includes('if (!event.isTrusted)'));
});

test('new userscript negotiates fallback and works with the old v1 backend contract', async () => {
  const records = new Map();
  const subject = userscript({ initial: [sample()], gmRequest(options) {
    const url = new URL(options.url);
    (async () => {
      let status = 200; let payload;
      if (url.pathname.endsWith('/capabilities')) { status = 404; payload = { success: false, message: 'Not Found' }; }
      else if (options.method === 'GET') {
        const id = url.pathname.split('/').at(-1);
        if (!records.has(id)) { status = 404; payload = { success: false, message: 'Cookies not found' }; }
        else payload = { success: true, cookies: records.get(id).cookies };
      } else {
        const body = await crypt(secret, null, { envelope: JSON.parse(options.data) });
        assert.equal(JSON.parse(options.data).version, 1);
        assert.equal(body.cookies[0].sameSite, 'lax');
        records.set(body.id, body); payload = { success: true };
      }
      options.onload({ status, responseText: JSON.stringify(await crypt(secret, payload)), finalUrl: options.url });
    })().catch(options.onerror);
    return { abort() { options.onabort?.(); } };
  } });
  subject.saved.set('cookie_share_custom_url', base);
  subject.saved.set('cookie_share_transport_secret', secret);
  assert.equal((await subject.subject.api.sendCookies('oldBackend', base, secret)).success, true);
  await subject.subject.cookieManager.set(sample({ value: 'other-account' }));
  assert.equal((await subject.subject.api.receiveCookies('oldBackend', base, secret)).success, true);
  assert.equal(subject.cookies()[0].value, 'secret-cookie');
});
test('new userscript uses v2 against Worker and verifies response binding end-to-end', async () => {
  const env = environment({ REQUIRE_CLIENT_AUTH: 'true', DEVICE_TOKENS: JSON.stringify([{ token: device, records: ['*'], permissions: ['read', 'write', 'delete'] }]) });
  const subject = userscript({ initial: [sample()], gmRequest(options) {
    (async () => {
      const response = await worker.fetch(new Request(options.url, { method: options.method, headers: options.headers,
        ...(options.data === undefined ? {} : { body: options.data }) }), env);
      options.onload({ status: response.status, responseText: await response.text(), finalUrl: options.url });
    })().catch(options.onerror);
    return { abort() { options.onabort?.(); } };
  } });
  subject.saved.set('cookie_share_custom_url', base);
  subject.saved.set('cookie_share_device_token', device);
  assert.equal((await subject.subject.api.sendCookies('deviceClient', base, '')).success, true);
  await subject.subject.cookieManager.set(sample({ value: 'changed' }));
  assert.equal((await subject.subject.api.receiveCookies('deviceClient', base, '')).success, true);
  assert.equal(subject.cookies()[0].value, 'secret-cookie');
});
test('a cancelled receive does not mutate cookies or claim success', async () => {
  const subject = userscript({ initial: [sample()], nativeConfirm: () => false, gmRequest(options) {
    crypt(secret, { success: true, cookies: [sample({ value: 'replacement' })] }).then((envelope) => options.onload({ status: 200, responseText: JSON.stringify(envelope) }));
    return { abort() {} };
  } });
  subject.saved.set('cookie_share_custom_url', base); subject.saved.set('cookie_share_transport_secret', secret);
  assert.equal((await subject.subject.api.receiveCookies('record', base, secret)).success, false);
  assert.equal(subject.cookies()[0].value, 'secret-cookie');
  assert.equal(subject.calls.some((c) => c[0] === 'delete'), false);
});


test('a credential with 100 record IDs stays within the D1 parameter limit', async () => {
  const records = Array.from({ length: 100 }, (_, index) => 'record' + index);
  const env = environment({ DEVICE_TOKENS: JSON.stringify([{ token: device, records, permissions: ['read'] }]) });
  await save(env, 'record1');
  const response = await request(env, '/list-cookies-by-host/example.com', { headers: { Authorization: 'Bearer ' + device } });
  assert.equal(response.status, 200);
  assert.equal((await decode(response, device)).cookies.length, 1);
});
test('oversized records fail before touching the stored record', async () => {
  const env = environment(); await save(env);
  const cookies = Array.from({ length: 100 }, (_, i) => sample({ name: 'cookie' + i, value: 'a'.repeat(15000) }));
  const response = await save(env, 'record1', { cookies });
  assert.equal(response.status, 413);
  assert.equal((await decode(await request(env, '/receive-cookies/record1'), secret)).cookies[0].value, 'secret-cookie');
});
test('device mode rejects non-HTTPS backends before sending a token', async () => {
  const client = userscript();
  client.saved.set('cookie_share_device_token', device);
  client.saved.set('cookie_share_custom_url', 'http://worker.test/legacy-path');
  await assert.rejects(client.subject.api.requestEncryptedJson({ method: 'GET', url: 'http://worker.test/legacy-path/receive-cookies/id' }), /HTTPS/);
});
