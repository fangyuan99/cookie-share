const CORS_METHODS = "GET, POST, PUT, DELETE, OPTIONS";
const CORS_HEADERS = "Content-Type, X-Admin-Password, Authorization, X-CSRF-Token, X-Cookie-Protocol, X-Request-Id, X-Request-Time";
const ID_PATTERN = /^[A-Za-z0-9]{1,64}$/;
const SAME_SITE_VALUES = new Set(["lax", "strict", "none", "unspecified"]);
const ENCRYPTION_VERSION = 1;
const PBKDF2_ITERATIONS = 100000;
const AES_KEY_LENGTH = 256;
const IV_LENGTH = 12;
const SALT_LENGTH = 16;
const encoder = new TextEncoder();
const decoder = new TextDecoder();
const SCHEMA_STATEMENTS = [
  `CREATE TABLE IF NOT EXISTS cookie_records (
    id TEXT PRIMARY KEY,
    url TEXT NOT NULL,
    host TEXT NOT NULL,
    cookies_json TEXT NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    revision INTEGER NOT NULL DEFAULT 1
  )`,
  "CREATE INDEX IF NOT EXISTS idx_cookie_records_host ON cookie_records(host)",
  "CREATE INDEX IF NOT EXISTS idx_cookie_records_updated_at ON cookie_records(updated_at DESC)",
  "CREATE INDEX IF NOT EXISTS idx_cookie_records_host_updated ON cookie_records(host, updated_at DESC, id ASC)",
  "CREATE TABLE IF NOT EXISTS admin_sessions (token_hash TEXT PRIMARY KEY, expires_at INTEGER NOT NULL)",
  "CREATE INDEX IF NOT EXISTS idx_admin_sessions_expiry ON admin_sessions(expires_at)",
  "CREATE TABLE IF NOT EXISTS request_nonces (id TEXT PRIMARY KEY, expires_at INTEGER NOT NULL)",
  "CREATE INDEX IF NOT EXISTS idx_request_nonces_expiry ON request_nonces(expires_at)",
];

class HttpError extends Error {
  constructor(status, message, payload, options = {}) {
    super(message);
    this.name = "HttpError";
    this.status = status;
    this.payload = payload;
    this.plain = Boolean(options.plain);
  }
}

export default {
  async fetch(request, env) {
    try {
      validateDatabaseBinding(env);
      databaseSettings.set(env.COOKIE_DB, env);

      const runtimeConfig = resolveRuntimeConfig(env, request.url);
      const url = new URL(request.url);
      const path = url.pathname;
      const basePath = `/${runtimeConfig.pathSecret}`;
      const isHtmlRoute = request.method === "GET" && path === `${basePath}/admin`;
      const isOptions = request.method === "OPTIONS";
      const useEncryptedResponse = !isHtmlRoute && !isOptions;
      let routeSecret = resolveRouteSecret(path, basePath, runtimeConfig);

      try {
        if (path !== basePath && !path.startsWith(`${basePath}/`)) return jsonResponse(404, { success: false, message: "Not Found" });
        if (request.method !== 'OPTIONS') await limitRequest(request, env, path === `${basePath}/admin/login`);
        if (request.method === 'GET' && path === `${basePath}/capabilities`) {
          return jsonResponse(200, { success: true, protocolVersions: [1, 2], deviceTokens: true,
            cookieAttributes: true, metadata: true, conditionalWrites: true,
            clientAuthRequired: String(env.REQUIRE_CLIENT_AUTH).toLowerCase() === 'true' });
        }
        if (request.method === 'POST' && path === `${basePath}/admin/login`) return await handleAdminLogin(request, env, runtimeConfig, basePath);
        if (path.startsWith(`${basePath}/admin/`) && request.method !== 'OPTIONS') {
          runtimeConfig.adminPassword = await authorizeAdmin(request, env, runtimeConfig);
          runtimeConfig.adminAuthorized = true;
          routeSecret = runtimeConfig.adminPassword;
          if (path === `${basePath}/admin/logout` && request.method === 'POST') {
            if (runtimeConfig.sessionHash) await env.COOKIE_DB.prepare('DELETE FROM admin_sessions WHERE token_hash = ?').bind(runtimeConfig.sessionHash).run();
            const response = jsonResponse(200, { success: true });
            response.headers.set('Set-Cookie', sessionCookie(basePath, '', url.protocol === 'https:', 0));
            return response;
          }
          if (path === `${basePath}/admin/list-cookies` && request.method === 'GET' && url.searchParams.get('summary') === '1') return await handleAdminSummary(env, url, routeSecret);
          if (path.startsWith(`${basePath}/admin/record/`) && request.method === 'GET') return await handleAdminRecord(path.slice(`${basePath}/admin/record/`.length), env, routeSecret);
        } else if (!isHtmlRoute && !isOptions) {
          runtimeConfig.transportSecret = clientSecret(request, env, runtimeConfig, url);
          routeSecret = runtimeConfig.transportSecret;
        }
        return await handleRequest(request, env, runtimeConfig, url, path, basePath);
      } catch (error) {
        return await handleRequestError(error, routeSecret, useEncryptedResponse);
      }
    } catch (error) {
      return handleTopLevelError(error, request);
    }
  },
};

function validateDatabaseBinding(env) {
  if (!env || typeof env !== "object") {
    throw new HttpError(500, "Missing environment bindings", {
      success: false,
      error: "Missing environment bindings",
    }, { plain: true });
  }

  if (!env.COOKIE_DB || typeof env.COOKIE_DB.prepare !== "function") {
    throw new HttpError(500, "Missing required bindings: COOKIE_DB", {
      success: false,
      error: "Missing required bindings: COOKIE_DB",
    }, { plain: true });
  }
}

function shouldReturnHtmlError(request) {
  if (!request || typeof request !== "object") {
    return false;
  }

  if (request.method !== "GET") {
    return false;
  }

  const accept = request.headers.get("Accept") || "";
  return accept.includes("text/html");
}

function renderTopLevelErrorPage(message) {
  const safeMessage = escapeHtml(message || "Internal Server Error");
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>Cookie Share Error</title>
    <style>
      :root {
        color-scheme: light;
      }
      body {
        margin: 0;
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
        background: #f6f7fb;
        color: #191919;
      }
      main {
        max-width: 720px;
        margin: 48px auto;
        padding: 0 20px;
      }
      article {
        background: #fff;
        border: 1px solid #e5e7eb;
        border-radius: 16px;
        padding: 24px;
        box-shadow: 0 12px 32px rgba(15, 23, 42, 0.08);
      }
      h1 {
        margin-top: 0;
        margin-bottom: 12px;
        font-size: 24px;
      }
      p {
        line-height: 1.6;
        margin: 0 0 16px;
      }
      code {
        display: block;
        padding: 12px;
        border-radius: 12px;
        background: #111827;
        color: #f9fafb;
        overflow-wrap: anywhere;
      }
    </style>
  </head>
  <body>
    <main>
      <article>
        <h1>Cookie Share deployment error</h1>
        <p>The Worker started, but request handling failed before a normal response could be generated.</p>
        <p>Check the message below and then review your Worker bindings, secrets, or crypto settings.</p>
        <code>${safeMessage}</code>
      </article>
    </main>
  </body>
</html>`;
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function handleTopLevelError(error, request) {
  if (error instanceof HttpError) {
    if (shouldReturnHtmlError(request)) {
      return createResponse(renderTopLevelErrorPage(error.message), {
        status: error.status,
        headers: { "Content-Type": "text/html; charset=UTF-8" },
      });
    }

    return jsonResponse(error.status, error.payload || { success: false, message: error.message });
  }

  console.error("Unhandled worker error", error);

  const message = "Internal Server Error";
  if (shouldReturnHtmlError(request)) {
    return createResponse(renderTopLevelErrorPage(message), {
      status: 500,
      headers: { "Content-Type": "text/html; charset=UTF-8" },
    });
  }

  return jsonResponse(500, {
    success: false,
    error: message,
  });
}

function resolveRuntimeConfig(env, requestUrl) {
  const hostname = new URL(requestUrl).hostname.toLowerCase();
  const isLocalDevHost =
    hostname === "localhost" ||
    hostname === "127.0.0.1" ||
    hostname === "[::1]";

  const pathSecret =
    typeof env.PATH_SECRET === "string" && env.PATH_SECRET.trim()
      ? env.PATH_SECRET.trim()
      : isLocalDevHost
        ? "dev"
        : null;

  const adminPassword =
    typeof env.ADMIN_PASSWORD === "string" && env.ADMIN_PASSWORD
      ? env.ADMIN_PASSWORD
      : isLocalDevHost
        ? "dev-password"
        : null;

  const transportSecret =
    typeof env.TRANSPORT_SECRET === "string" && env.TRANSPORT_SECRET
      ? env.TRANSPORT_SECRET
      : isLocalDevHost
        ? "dev-transport-secret"
        : null;

  const missing = [];
  if (!adminPassword) {
    missing.push("ADMIN_PASSWORD");
  }
  if (!pathSecret) {
    missing.push("PATH_SECRET");
  }
  if (!transportSecret) {
    missing.push("TRANSPORT_SECRET");
  }

  if (missing.length > 0) {
    throw new HttpError(
      500,
      `Missing required bindings: ${missing.join(", ")}`,
      { success: false, error: `Missing required bindings: ${missing.join(", ")}` },
      { plain: true }
    );
  }

  if (/[\x00-\x20<>;?#]/.test(pathSecret)) throw plainError(500, 'PATH_SECRET contains unsupported characters');

  return {
    adminPassword,
    pathSecret,
    transportSecret,
    isLocalDevFallback:
      isLocalDevHost &&
      (
        !(typeof env.ADMIN_PASSWORD === "string" && env.ADMIN_PASSWORD) ||
        !(typeof env.PATH_SECRET === "string" && env.PATH_SECRET.trim()) ||
        !(typeof env.TRANSPORT_SECRET === "string" && env.TRANSPORT_SECRET)
      ),
  };
}

async function handleRequest(request, env, runtimeConfig, url, path, basePath) {
  const routeSecret = resolveRouteSecret(path, basePath, runtimeConfig);

  if (path !== basePath && !path.startsWith(`${basePath}/`)) {
    return await encryptedJsonResponse(404, { success: false, message: "Not Found" }, routeSecret);
  }

  if (request.method === "OPTIONS") {
    return corsPreflightResponse();
  }

  if (request.method === "GET" && path === `${basePath}/admin`) {
    return handleAdminPage(basePath, runtimeConfig);
  }

  if (path.startsWith(`${basePath}/admin/`)) {
    if (!runtimeConfig.adminAuthorized) ensureAdminPassword(request, runtimeConfig);
  }

  if (request.method === "POST" && path === `${basePath}/send-cookies`) {
    return await handleSendCookies(request, env, runtimeConfig.transportSecret);
  }

  const receivePrefix = `${basePath}/receive-cookies/`;
  if (request.method === "GET" && path.startsWith(receivePrefix)) {
    return await handleReceiveCookies(path.slice(receivePrefix.length), env, runtimeConfig.transportSecret);
  }

  const publicHostPrefix = `${basePath}/list-cookies-by-host/`;
  if (request.method === "GET" && path.startsWith(publicHostPrefix)) {
    return await handleListCookiesByHost(path.slice(publicHostPrefix.length), env, runtimeConfig.transportSecret);
  }

  if (request.method === "DELETE" && path === `${basePath}/delete`) {
    return await handlePublicDelete(request, env, runtimeConfig.transportSecret);
  }

  if (request.method === "GET" && path === `${basePath}/admin/list-cookies`) {
    return await handleListCookies(env, runtimeConfig.adminPassword);
  }

  const hostPrefix = `${basePath}/admin/list-cookies-by-host/`;
  if (request.method === "GET" && path.startsWith(hostPrefix)) {
    return await handleListCookiesByHost(path.slice(hostPrefix.length), env, runtimeConfig.adminPassword);
  }

  if (request.method === "POST" && path === `${basePath}/admin/create`) {
    return await handleSendCookies(request, env, runtimeConfig.adminPassword);
  }

  if (request.method === "PUT" && path === `${basePath}/admin/update`) {
    return await handleUpdate(request, env, runtimeConfig.adminPassword);
  }

  if (request.method === "DELETE" && path === `${basePath}/admin/delete`) {
    return await handleDelete(url, env, runtimeConfig.adminPassword);
  }

  if (request.method === "GET" && path === `${basePath}/admin/export-all`) {
    return await handleExportAll(env, runtimeConfig.adminPassword);
  }

  if (request.method === "POST" && path === `${basePath}/admin/import-all`) {
    return await handleImportAll(request, env, runtimeConfig.adminPassword);
  }

  return jsonResponse(404, { success: false, message: "Not Found" });
}

function resolveRouteSecret(path, basePath, runtimeConfig) {
  if (path.startsWith(`${basePath}/admin/`)) {
    return runtimeConfig.adminPassword;
  }
  return runtimeConfig.transportSecret;
}

function ensureAdminPassword(request, runtimeConfig) {
  const providedPassword = request.headers.get("X-Admin-Password");
  if (!providedPassword || !timingSafeEqual(providedPassword, runtimeConfig.adminPassword)) {
    throw new HttpError(401, "Unauthorized", {
      success: false,
      message: "Unauthorized",
    });
  }
}

function timingSafeEqual(left, right) {
  if (typeof left !== "string" || typeof right !== "string") {
    return false;
  }

  const leftBytes = encoder.encode(left);
  const rightBytes = encoder.encode(right);

  let diff = leftBytes.length ^ rightBytes.length;
  for (let index = 0; index < leftBytes.length; index += 1) {
    diff |= leftBytes[index] ^ (rightBytes[index] ?? 0);
  }
  return diff === 0;
}

async function handleSendCookies(request, env, encryptionSecret) {
  const body = await readEncryptedRequestBody(request, encryptionSecret);
  const id = validateId(body?.id, "Invalid ID. Only letters and numbers are allowed.");
  const normalizedUrl = normalizeUrl(body?.url);
  const cookies = normalizeCookies(body?.cookies);
  authorizeRecord(encryptionSecret, id, 'write');

  await ensureSchema(env.COOKIE_DB);
  await upsertCookieRecord(env.COOKIE_DB, {
    id,
    url: normalizedUrl,
    host: extractHost(normalizedUrl),
    cookies,
    createOnly: body.createOnly === true,
    expectedRevision: body.expectedRevision,
  });

  return await encryptedJsonResponse(200, {
    success: true,
    message: "Cookies saved successfully",
  }, encryptionSecret);
}

async function handleReceiveCookies(cookieId, env, encryptionSecret) {
  const id = validateId(cookieId, "Invalid cookie ID");
  authorizeRecord(encryptionSecret, id, 'read');
  await ensureSchema(env.COOKIE_DB);
  const record = await getCookieRecord(env.COOKIE_DB, id);

  if (!record) {
    return await encryptedJsonResponse(404, {
      success: false,
      message: "Cookies not found",
    }, encryptionSecret);
  }

  return await encryptedJsonResponse(200, {
    success: true,
    url: record.url, host: record.host, revision: record.revision,
    cookies: record.cookies.map((cookie) => formatCookieForResponse(cookie)),
  }, encryptionSecret);
}

async function handleListCookies(env, encryptionSecret) {
  await ensureSchema(env.COOKIE_DB);
  return await encryptedJsonResponse(200, {
    success: true,
    cookies: (await listCookieRecordsWithPayload(env.COOKIE_DB)).map((record) => ({
      id: record.id,
      url: record.url,
      host: record.host,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
      cookies: record.cookies,
      cookiesJson: JSON.stringify(record.cookies, null, 2),
    })),
  }, encryptionSecret);
}

async function handleListCookiesByHost(encodedHost, env, encryptionSecret) {
  const host = normalizeHostParameter(encodedHost);
  if (encryptionSecret?.credential && !encryptionSecret.credential.permissions.includes('read')) throw plainError(403, 'Record access denied');
  await ensureSchema(env.COOKIE_DB);
  return await encryptedJsonResponse(200, {
    success: true,
    cookies: await listCookieRecordsByHost(env.COOKIE_DB, host, encryptionSecret?.credential),
  }, encryptionSecret);
}

async function handleUpdate(request, env, encryptionSecret) {
  const body = await readEncryptedRequestBody(request, encryptionSecret);
  const key = validateId(body?.key, "Invalid key. Only letters and numbers are allowed.");
  const cookies = normalizeCookies(body?.value);

  await ensureSchema(env.COOKIE_DB);
  const existingRecord = await getCookieRecord(env.COOKIE_DB, key);
  if (!existingRecord) {
    return await encryptedJsonResponse(404, {
      success: false,
      message: "Cookie not found",
    }, encryptionSecret);
  }

  const nextUrl =
    typeof body?.url === "string" && body.url.trim()
      ? normalizeUrl(body.url)
      : existingRecord.url;

  await upsertCookieRecord(env.COOKIE_DB, {
    id: key,
    url: nextUrl,
    host: extractHost(nextUrl),
    cookies,
    expectedRevision: body.expectedRevision,
  });

  return await encryptedJsonResponse(200, {
    success: true,
    message: "Cookies and URL updated successfully",
  }, encryptionSecret);
}

async function handleDelete(url, env, encryptionSecret) {
  const key = validateId(url.searchParams.get("key"), "Invalid key. Only letters and numbers are allowed.");
  await ensureSchema(env.COOKIE_DB);
  await deleteCookieRecord(env.COOKIE_DB, key);
  return await encryptedJsonResponse(200, {
    success: true,
    message: "Data deleted successfully",
  }, encryptionSecret);
}

// Public delete reads the key from an encrypted body so the caller must prove
// knowledge of the transport secret (knowing PATH_SECRET alone is not enough).
async function handlePublicDelete(request, env, encryptionSecret) {
  const body = await readEncryptedRequestBody(request, encryptionSecret);
  const key = validateId(body?.key, "Invalid key. Only letters and numbers are allowed.");
  authorizeRecord(encryptionSecret, key, 'delete');
  await ensureSchema(env.COOKIE_DB);
  await deleteCookieRecord(env.COOKIE_DB, key);
  return await encryptedJsonResponse(200, {
    success: true,
    message: "Data deleted successfully",
  }, encryptionSecret);
}

async function handleExportAll(env, encryptionSecret) {
  await ensureSchema(env.COOKIE_DB);
  return await encryptedJsonResponse(200, {
    version: ENCRYPTION_VERSION,
    exportedAt: new Date().toISOString(),
    records: await listCookieRecordsWithPayload(env.COOKIE_DB),
  }, encryptionSecret);
}

async function handleImportAll(request, env, encryptionSecret) {
  const body = await readEncryptedRequestBody(request, encryptionSecret);
  if (!Array.isArray(body?.records)) {
    throw new HttpError(400, "Invalid import payload", {
      success: false,
      message: "Invalid import payload",
    });
  }

  if (body.records.length > 10000) throw plainError(413, 'Too many import records; split the backup');
  const records = body.records.map((record) => normalizeImportRecord(record));
  await ensureSchema(env.COOKIE_DB);
  await upsertCookieRecords(env.COOKIE_DB, records);

  return await encryptedJsonResponse(200, {
    success: true,
    message: "Import completed",
    total: body.records.length,
    imported: records.length,
  }, encryptionSecret);
}

async function ensureSchema(database) {
  let promise = schemaPromises.get(database);
  if (!promise) {
    promise = (async () => {
      await database.batch(SCHEMA_STATEMENTS.map((statement) => database.prepare(statement)));
      const { results } = await database.prepare('PRAGMA table_info(cookie_records)').all();
      if (!results.some((column) => column.name === 'revision')) {
        try { await database.prepare('ALTER TABLE cookie_records ADD COLUMN revision INTEGER NOT NULL DEFAULT 1').run(); }
        catch (error) {
          const check = await database.prepare('PRAGMA table_info(cookie_records)').all();
          if (!check.results.some((column) => column.name === 'revision')) throw error;
        }
      }
    })();
    schemaPromises.set(database, promise);
    promise.catch(() => schemaPromises.delete(database));
  }
  return promise;
}

async function buildUpsertStatement(database, record, now) {
  const revision = record.expectedRevision;
  if (revision !== undefined && (!Number.isSafeInteger(revision) || revision < 1)) throw plainError(400, 'Invalid expectedRevision');
  const conflict = record.createOnly ? 'ON CONFLICT(id) DO NOTHING' : `ON CONFLICT(id) DO UPDATE SET
    url = excluded.url, host = excluded.host, cookies_json = excluded.cookies_json,
    updated_at = excluded.updated_at, revision = cookie_records.revision + 1
    ${revision !== undefined ? 'WHERE cookie_records.revision = ?' : ''}`;
  // A conditional update must not recreate a concurrently deleted record.
  if (revision !== undefined && !record.createOnly) {
    return database.prepare('UPDATE cookie_records SET url = ?, host = ?, cookies_json = ?, updated_at = ?, revision = revision + 1 WHERE id = ? AND revision = ?')
      .bind(record.url, record.host, await encodeStoredCookies(database, record.id, record.cookies), now, record.id, revision);
  }
  return database.prepare(`INSERT INTO cookie_records (id, url, host, cookies_json, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?) ${conflict}`)
    .bind(record.id, record.url, record.host, await encodeStoredCookies(database, record.id, record.cookies), record.createdAt || now, record.updatedAt || now);
}

async function upsertCookieRecord(database, record) {
  const result = await (await buildUpsertStatement(database, record, new Date().toISOString())).run();
  if (!result.meta.changes) throw plainError(409, 'Record already exists or changed; reload before overwriting');
}

async function upsertCookieRecords(database, records) {
  if (!records.length) return;
  const now = new Date().toISOString();
  const statements = [];
  for (const record of records) statements.push(await buildUpsertStatement(database, record, now));
  // D1 batch executes the prepared statements transactionally.
  await database.batch(statements);
}

async function getCookieRecord(database, id) {
  const row = await database.prepare(
    `SELECT id, url, host, cookies_json, created_at, updated_at, revision
     FROM cookie_records
     WHERE id = ?`
  ).bind(id).first();

  if (!row) {
    return null;
  }

  return {
    id: row.id,
    url: row.url,
    host: row.host,
    cookies: await parseStoredCookies(row.cookies_json, row.id, database),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    revision: row.revision,
  };
}

async function listCookieRecordsByHost(database, host, credential) {
  let sql = 'SELECT id, url FROM cookie_records WHERE host = ?';
  const bindings = [host];
  if (credential && !credential.records.includes('*')) {
    if (!credential.records.length) return [];
    // Keep below D1's 100-bound-parameter limit even at the token's 100-record cap.
    sql += ' AND id IN (SELECT value FROM json_each(?))';
    bindings.push(JSON.stringify(credential.records));
  }
  sql += ' ORDER BY updated_at DESC, id ASC';
  const { results } = await database.prepare(sql).bind(...bindings).all();
  return results.map((row) => ({ id: row.id, url: row.url }));
}

async function listCookieRecordsWithPayload(database) {
  const { results } = await database.prepare(
    `SELECT id, url, host, cookies_json, created_at, updated_at, revision
     FROM cookie_records
     ORDER BY updated_at DESC`
  ).all();

  return await Promise.all(results.map(async (row) => ({
    id: row.id,
    url: row.url,
    host: row.host,
    cookies: await parseStoredCookies(row.cookies_json, row.id, database),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    revision: row.revision,
  })));
}

async function deleteCookieRecord(database, id) {
  await database.prepare("DELETE FROM cookie_records WHERE id = ?").bind(id).run();
}

function normalizeImportRecord(record) {
  const id = validateId(record?.id, "Invalid ID. Only letters and numbers are allowed.");
  const url = normalizeUrl(record?.url);
  const cookies = normalizeCookies(record?.cookies);
  return {
    id,
    url,
    host: extractHost(url),
    cookies,
    createdAt: normalizeTimestamp(record?.createdAt),
    updatedAt: normalizeTimestamp(record?.updatedAt),
  };
}

function normalizeTimestamp(value) {
  if (typeof value !== "string" || !value.trim() || value.length > 8192) {
    return null;
  }

  const timestamp = new Date(value);
  return Number.isNaN(timestamp.getTime()) ? null : timestamp.toISOString();
}

async function parseStoredCookies(rawCookies, recordId, database) {
  try {
    return await decodeStoredCookies(database, recordId, JSON.parse(rawCookies));
  } catch (error) {
    console.error("Failed to parse stored cookie record", {
      recordId,
      error: error instanceof Error ? error.message : String(error),
    });
    throw new HttpError(500, "Stored cookie data is invalid", {
      success: false,
      message: "Stored cookie data is invalid",
    });
  }
}

function validateId(value, message) {
  if (typeof value !== "string" || !ID_PATTERN.test(value)) {
    throw new HttpError(400, message, { success: false, message });
  }
  return value;
}

function normalizeUrl(value) {
  if (typeof value !== "string" || !value.trim() || value.length > 8192) {
    throw new HttpError(400, "Invalid URL", { success: false, message: "Invalid URL" });
  }

  const trimmedValue = value.trim();
  const candidate = /^[a-zA-Z][a-zA-Z\d+\-.]*:\/\//.test(trimmedValue) ? trimmedValue : `https://${trimmedValue}`;
  try {
    const url = new URL(candidate);
    if (!['http:', 'https:'].includes(url.protocol)) throw new Error('Unsupported protocol');
    url.username = ''; url.password = ''; url.search = ''; url.hash = '';
    return url.toString();
  } catch {
    throw new HttpError(400, "Invalid URL", { success: false, message: "Invalid URL" });
  }
}

function extractHost(url) {
  return new URL(url).hostname.toLowerCase();
}

function normalizeHostParameter(value) {
  if (typeof value !== "string" || !value) {
    throw new HttpError(400, "Invalid host", { success: false, message: "Invalid host" });
  }

  let decodedValue;
  try {
    decodedValue = decodeURIComponent(value);
  } catch {
    throw new HttpError(400, "Invalid host", { success: false, message: "Invalid host" });
  }

  const normalizedHost = decodedValue.trim().toLowerCase();
  if (!normalizedHost) {
    throw new HttpError(400, "Invalid host", { success: false, message: "Invalid host" });
  }
  return normalizedHost;
}

function normalizeCookies(value) {
  if (!Array.isArray(value) || value.length > 1000) {
    throw new HttpError(400, "Invalid cookie format", { success: false, message: "Invalid cookie format" });
  }
  return value.map((cookie) => normalizeCookie(cookie));
}

function normalizeCookie(cookie) {
  if (!cookie || typeof cookie !== "object") {
    throw invalidCookieError();
  }
  if (typeof cookie.name !== "string" || !cookie.name || cookie.name.length > 1024) {
    throw invalidCookieError();
  }
  if (typeof cookie.value !== "string" || cookie.value.length > 16384) {
    throw invalidCookieError();
  }
  if (typeof cookie.domain !== "string" || !cookie.domain.trim() || cookie.domain.length > 253) {
    throw invalidCookieError();
  }
  if (typeof cookie.httpOnly !== "boolean" || typeof cookie.secure !== "boolean") {
    throw invalidCookieError();
  }

  const sameSite = cookie.sameSiteUnspecified === true ? 'unspecified' : normalizeSameSite(cookie.sameSite);
  const attributes = {};
  if (cookie.partitionKey !== undefined) {
    if (!cookie.partitionKey || typeof cookie.partitionKey !== 'object' || typeof cookie.partitionKey.topLevelSite !== 'string') throw invalidCookieError();
    try {
      const site = new URL(cookie.partitionKey.topLevelSite);
      if (!['http:', 'https:'].includes(site.protocol)) throw new Error('Invalid partition site');
      attributes.partitionKey = { topLevelSite: site.origin };
      if (typeof cookie.partitionKey.hasCrossSiteAncestor === 'boolean') attributes.partitionKey.hasCrossSiteAncestor = cookie.partitionKey.hasCrossSiteAncestor;
    } catch { throw invalidCookieError(); }
  }
  if (cookie.firstPartyDomain !== undefined) {
    if (typeof cookie.firstPartyDomain !== 'string' || cookie.firstPartyDomain.length > 253) throw invalidCookieError();
    attributes.firstPartyDomain = cookie.firstPartyDomain;
  }
  const hasLeadingDot = cookie.domain.trim().startsWith(".");
  const expirationDate =
    cookie.expirationDate === undefined || cookie.expirationDate === null
      ? undefined
      : Number(cookie.expirationDate);

  if (expirationDate !== undefined && !Number.isFinite(expirationDate)) {
    throw invalidCookieError();
  }

  return {
    ...attributes,
    domain: cookie.domain.trim().replace(/^\./, "").toLowerCase(),
    expirationDate,
    hostOnly: typeof cookie.hostOnly === "boolean" ? cookie.hostOnly : !hasLeadingDot,
    httpOnly: cookie.httpOnly,
    name: cookie.name,
    path: typeof cookie.path === "string" && cookie.path ? cookie.path : "/",
    sameSite,
    secure: cookie.secure,
    session: Boolean(cookie.session),
    storeId: null,
    value: cookie.value,
  };
}

function normalizeSameSite(value) {
  if (typeof value !== "string" || !value.trim()) {
    throw invalidCookieError();
  }

  const normalizedValue = value.trim().toLowerCase();
  if (!SAME_SITE_VALUES.has(normalizedValue)) {
    throw invalidCookieError();
  }
  return normalizedValue;
}

function invalidCookieError() {
  return new HttpError(400, "Invalid cookie format", {
    success: false,
    message: "Invalid cookie format",
  });
}

function formatCookieForResponse(cookie) {
  const responseCookie = {
    domain: cookie.domain,
    hostOnly: Boolean(cookie.hostOnly),
    httpOnly: Boolean(cookie.httpOnly),
    name: cookie.name,
    path: cookie.path || "/",
    sameSite: cookie.sameSite,
    secure: Boolean(cookie.secure),
    session: Boolean(cookie.session),
    storeId: null,
    value: cookie.value,
  };

  if (cookie.partitionKey) responseCookie.partitionKey = cookie.partitionKey;
  if (cookie.firstPartyDomain !== undefined) responseCookie.firstPartyDomain = cookie.firstPartyDomain;
  if (cookie.expirationDate !== undefined) {
    responseCookie.expirationDate = cookie.expirationDate;
  }
  return responseCookie;
}

async function readEncryptedRequestBody(request, secret) {
  let rawText;
  try {
    rawText = await readLimitedBody(request);
  } catch (error) {
    if (error instanceof HttpError) throw error;
    throw new HttpError(400, "Invalid encrypted payload", {
      success: false,
      message: "Invalid encrypted payload",
    });
  }

  if (!rawText) {
    throw new HttpError(400, "Invalid encrypted payload", {
      success: false,
      message: "Invalid encrypted payload",
    });
  }

  let envelope;
  try {
    envelope = JSON.parse(rawText);
  } catch {
    throw new HttpError(400, "Invalid encrypted payload", {
      success: false,
      message: "Invalid encrypted payload",
    });
  }

  const body = await decryptPayload(secret, envelope);
  await preventReplay(secret);
  return body;
}

async function encryptPayload(secret, data) {
  const salt = crypto.getRandomValues(new Uint8Array(SALT_LENGTH));
  const iv = crypto.getRandomValues(new Uint8Array(IV_LENGTH));
  const key = protocolVersion(secret) === 2 ? await deriveV2Key(secret, salt) : await deriveAesKey(secretValue(secret), salt);
  const ciphertext = new Uint8Array(
    await crypto.subtle.encrypt(
      { name: "AES-GCM", iv, ...(protocolVersion(secret) === 2 ? { additionalData: protocolAAD(secret, "response") } : {}) },
      key,
      encoder.encode(JSON.stringify(data))
    )
  );

  return {
    version: protocolVersion(secret),
    salt: base64UrlEncode(salt),
    iv: base64UrlEncode(iv),
    payload: base64UrlEncode(ciphertext),
  };
}

async function decryptPayload(secret, envelope) {
  if (!isEncryptedEnvelope(envelope) || envelope.version !== protocolVersion(secret)) {
    throw new HttpError(400, "Invalid encrypted payload", {
      success: false,
      message: "Invalid encrypted payload",
    });
  }

  try {
    const salt = base64UrlDecode(envelope.salt);
    const iv = base64UrlDecode(envelope.iv);
    const payload = base64UrlDecode(envelope.payload);
    const key = protocolVersion(secret) === 2 ? await deriveV2Key(secret, salt) : await deriveAesKey(secretValue(secret), salt);
    if (salt.length !== 16 || iv.length !== 12 || payload.length < 16 || payload.length > MAX_BODY_BYTES) throw new Error('Invalid envelope lengths');
    const plaintext = await crypto.subtle.decrypt({ name: "AES-GCM", iv,
      ...(protocolVersion(secret) === 2 ? { additionalData: protocolAAD(secret, 'request') } : {}) }, key, payload);
    return JSON.parse(decoder.decode(plaintext));
  } catch {
    throw new HttpError(400, "Transport secret mismatch or corrupted payload", {
      success: false,
      message: "Transport secret mismatch or corrupted payload",
    });
  }
}

function isEncryptedEnvelope(value) {
  return Boolean(
    value &&
    typeof value === "object" &&
    (value.version === ENCRYPTION_VERSION || value.version === 2) &&
    typeof value.salt === "string" && /^[A-Za-z0-9_-]{22}$/.test(value.salt) &&
    typeof value.iv === "string" && /^[A-Za-z0-9_-]{16}$/.test(value.iv) &&
    typeof value.payload === "string" && value.payload.length <= Math.ceil(MAX_BODY_BYTES * 4 / 3) &&
    /^[A-Za-z0-9_-]+$/.test(value.payload)
  );
}

async function deriveAesKey(secret, salt) {
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    "PBKDF2",
    false,
    ["deriveKey"]
  );

  return await crypto.subtle.deriveKey(
    {
      name: "PBKDF2",
      hash: "SHA-256",
      salt,
      iterations: PBKDF2_ITERATIONS,
    },
    keyMaterial,
    { name: "AES-GCM", length: AES_KEY_LENGTH },
    false,
    ["encrypt", "decrypt"]
  );
}

function base64UrlEncode(bytes) {
  let binary = "";
  for (const value of bytes) {
    binary += String.fromCharCode(value);
  }
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function base64UrlDecode(value) {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized + "=".repeat((4 - (normalized.length % 4 || 4)) % 4);
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes;
}

async function encryptedJsonResponse(status, body, secret) {
  return jsonResponse(status, await encryptPayload(secret, body));
}

async function handleRequestError(error, routeSecret, useEncryptedResponse) {
  if (!(error instanceof HttpError)) {
    console.error("Unhandled worker error", error);
    error = new HttpError(500, "Internal Server Error", {
      success: false,
      error: "Internal Server Error",
    });
  }

  if (!useEncryptedResponse || error.plain) {
    return jsonResponse(error.status, error.payload || { success: false, message: error.message });
  }

  return await encryptedJsonResponse(
    error.status,
    error.payload || { success: false, message: error.message },
    routeSecret
  );
}

function handleAdminPage(basePath, runtimeConfig) {
  const nonce = base64UrlEncode(crypto.getRandomValues(new Uint8Array(18)));
  const devHint = runtimeConfig.isLocalDevFallback
    ? '<p class="text-sm opacity-60">localhost dev 默认值：<code>PATH_SECRET=dev</code>、<code>ADMIN_PASSWORD=dev-password</code>、<code>TRANSPORT_SECRET=dev-transport-secret</code>。</p>'
    : "";

  return htmlResponse(`<!doctype html>
<html lang="zh-CN" data-theme="nord">
  <head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>Cookie Share Admin</title>
<style>:root{color-scheme:light;--bg:#f3f5f7;--surface:#fff;--fg:#202a36;--muted:#546274;--line:#d7dee6;--accent:#285a86;--danger:#a12929}
:root[data-theme=dark],:root[data-theme=dracula]{color-scheme:dark;--bg:#151922;--surface:#202733;--fg:#edf1f7;--muted:#afb9c7;--line:#445066;--accent:#91bee5;--danger:#f69b9b}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--fg);font:16px/1.6 system-ui,-apple-system,sans-serif}main{max-width:1050px;margin:auto;padding:24px 20px}h2,h3{margin:0 0 12px}p{margin:8px 0}button,input,select,textarea{font:inherit}button{cursor:pointer}button:disabled{opacity:.5;cursor:wait}button:focus-visible,input:focus-visible,textarea:focus-visible,select:focus-visible{outline:3px solid var(--accent);outline-offset:3px}.navbar{display:flex;align-items:center;justify-content:space-between;padding:12px 20px;background:var(--surface);border-bottom:1px solid var(--line)}.card{background:var(--surface);border:1px solid var(--line);border-radius:14px;margin-bottom:22px}.card-body{padding:24px}.flex{display:flex}.flex-col{flex-direction:column}.flex-1{flex:1;min-width:0}.flex-wrap{flex-wrap:wrap}.items-center{align-items:center}.justify-between{justify-content:space-between}.gap-2{gap:8px}.gap-3{gap:12px}.input,.textarea,.select,.file-input{max-width:100%;padding:10px;border:1px solid var(--line);border-radius:8px;background:var(--surface);color:var(--fg)}.textarea{min-height:130px;font-family:ui-monospace,monospace}.btn{padding:9px 16px;border:1px solid var(--accent);border-radius:8px;background:transparent;color:var(--accent)}.btn-primary{background:var(--accent);color:var(--surface)}.btn-error,.text-error{color:var(--danger);border-color:var(--danger)}.btn-sm,.btn-xs{padding:5px 10px;font-size:14px}.btn+.btn{margin-left:6px}.label{display:block;margin:8px 0 4px}.w-full{width:100%}.max-w-lg{max-width:650px}.text-sm{font-size:14px}.text-xl{font-size:21px}.text-lg{font-size:18px}.font-bold{font-weight:700}.opacity-60{color:var(--muted)}.hidden,[hidden]{display:none!important}.space-y-3>*+*{margin-top:12px}.tabs{display:flex;gap:8px;margin-bottom:20px;border-bottom:1px solid var(--line)}.tab{padding:10px 18px;border:0;background:transparent;color:var(--muted)}.tab-active{color:var(--accent);border-bottom:3px solid var(--accent)}.overflow-x-auto{overflow-x:auto}.table{width:100%;border-collapse:collapse;table-layout:fixed}.table th,.table td{padding:12px;text-align:left;vertical-align:top;border-bottom:1px solid var(--line);overflow-wrap:anywhere}.table th:first-child{width:22%}.table th:last-child{width:24%}.mt-2{margin-top:8px}.mt-3{margin-top:12px}.mt-4{margin-top:16px}.mb-4{margin-bottom:16px}.badge,.kbd{padding:2px 6px;background:var(--bg);border:1px solid var(--line);border-radius:5px}.modal{border:1px solid var(--line);border-radius:14px;padding:24px;width:min(900px,94vw);background:var(--surface);color:var(--fg)}.modal::backdrop{background:rgba(0,0,0,.55)}.modal-box{max-width:100%}.modal-action{text-align:right;margin-top:16px}.modal-backdrop{display:none}.modal pre{background:var(--bg);padding:16px;max-height:55vh;overflow:auto;white-space:pre-wrap;overflow-wrap:anywhere}.text-center{text-align:center}.text-success{color:var(--accent)}@media(min-width:640px){.sm\\:flex-row{flex-direction:row}}@media(prefers-reduced-motion:reduce){*{scroll-behavior:auto!important;transition:none!important}}
</style>
  </head>
  <body class="min-h-screen bg-base-200">
    <div class="navbar bg-base-100 shadow-sm sticky top-0 z-50">
      <div class="flex-1">
        <span class="text-xl font-bold px-2">Cookie Share</span>
        <span class="badge badge-soft badge-primary ml-2">Admin</span>
      </div>
      <div class="flex-none">
        <select id="themeSelect" class="select select-bordered select-sm w-auto">
          <option value="nord">Nord</option>
          <option value="corporate">Corporate</option>
          <option value="cupcake">Cupcake</option>
          <option value="emerald">Emerald</option>
          <option value="dark">Dark</option>
          <option value="dracula">Dracula</option>
        </select>
      </div>
    </div>

    <main class="container mx-auto px-4 py-6 max-w-5xl">
      ${devHint}

      <div class="card bg-base-100 shadow-sm mb-6">
        <div class="card-body">
          <h2 class="card-title text-lg">凭据</h2>
          <p class="text-sm opacity-60">登录后使用 30 分钟会话；管理员密码不再持久保存。旧 API 密码认证可由部署者单独关闭。</p>
          <div class="flex flex-col sm:flex-row gap-3 mt-2">
            <input id="adminPassword" type="password" placeholder="管理员密码" class="input input-bordered flex-1">
            <button id="saveCredentials" type="button" class="btn btn-primary">登录并加载</button>
            <button id="logout" type="button" class="btn">退出并清除页面数据</button>
          </div>
          <p id="status" role="status" class="text-sm mt-2"></p>
        </div>
      </div>

      <section id="panels" hidden>
        <div class="card bg-base-100 shadow-sm mb-6">
          <div class="card-body">
            <div role="tablist" class="tabs tabs-bordered mb-4">
              <button role="tab" class="tab tab-active" data-tab="create">创建</button>
              <button role="tab" class="tab" data-tab="update">更新</button>
              <button role="tab" class="tab" data-tab="delete">删除</button>
            </div>

            <div id="tab-create" class="tab-panel">
              <form id="createForm" class="space-y-3 max-w-lg">
                <div class="form-control">
                  <label class="label"><span class="label-text">ID</span></label>
                  <input id="createId" required class="input input-bordered w-full">
                </div>
                <div class="form-control">
                  <label class="label"><span class="label-text">URL</span></label>
                  <input id="createUrl" required class="input input-bordered w-full">
                </div>
                <div class="form-control">
                  <label class="label"><span class="label-text">Cookies JSON</span></label>
                  <textarea id="createCookies" required class="textarea textarea-bordered w-full h-28" placeholder="[...]"></textarea>
                </div>
                <button type="submit" class="btn btn-primary">创建</button>
              </form>
            </div>

            <div id="tab-update" class="tab-panel hidden">
              <form id="updateForm" class="space-y-3 max-w-lg">
                <div class="form-control">
                  <label class="label"><span class="label-text">ID</span></label>
                  <input id="updateId" required class="input input-bordered w-full">
                </div>
                <div class="form-control">
                  <label class="label"><span class="label-text">URL</span></label>
                  <input id="updateUrl" class="input input-bordered w-full" placeholder="留空则保留原值">
                </div>
                <div class="form-control">
                  <label class="label"><span class="label-text">Cookies JSON</span></label>
                  <textarea id="updateCookies" required class="textarea textarea-bordered w-full h-28" placeholder="[...]"></textarea>
                </div>
                <button type="submit" class="btn btn-primary">更新</button>
              </form>
            </div>

            <div id="tab-delete" class="tab-panel hidden">
              <form id="deleteForm" class="space-y-3 max-w-lg">
                <div class="form-control">
                  <label class="label"><span class="label-text">ID</span></label>
                  <input id="deleteId" required class="input input-bordered w-full">
                </div>
                <button type="submit" class="btn btn-error">删除</button>
              </form>
            </div>
          </div>
        </div>

        <div class="card bg-base-100 shadow-sm mb-6">
          <div class="card-body">
            <h2 class="card-title text-lg">导入 / 导出</h2>
<p class="text-sm opacity-60">新备份使用独立备份密码；旧备份仍可使用导出时的管理员密码导入。导入前请确认覆盖范围。</p>
            <div class="flex flex-col sm:flex-row gap-3 mt-3 items-center">
              <button id="exportAll" type="button" class="btn btn-outline">导出全部数据</button>
              <input id="importFile" type="file" accept=".json,application/json" class="file-input file-input-bordered flex-1">
              <button id="importAll" type="button" class="btn btn-primary">导入全部数据</button>
            </div>
          </div>
        </div>

        <div class="card bg-base-100 shadow-sm mb-6">
          <div class="card-body">
            <div class="flex items-center justify-between flex-wrap gap-2">
              <div>
                <h2 class="card-title text-lg">已存储记录</h2>
                <p class="text-sm opacity-60">按最近更新时间倒序排列；列表不预加载 Cookie 原文</p>
              </div>
              <button id="refreshList" type="button" class="btn btn-outline btn-sm">刷新列表</button>
              <button id="previousPage" type="button" class="btn btn-outline btn-sm">上一页</button>
              <button id="nextPage" type="button" class="btn btn-outline btn-sm">下一页</button>
            </div>
            <div class="overflow-x-auto mt-4">
              <table class="table table-zebra">
                <thead>
                  <tr>
                    <th>ID</th>
                    <th>URL</th>
                    <th>Cookie 原文</th>
                    <th>操作</th>
                  </tr>
                </thead>
                <tbody id="cookieTableBody"></tbody>
              </table>
            </div>
          </div>
        </div>
      </section>
    </main>

    <dialog id="cookieRawDialog" class="modal">
      <div class="modal-box w-11/12 max-w-4xl">
        <h3 id="cookieRawTitle" class="text-lg font-bold">Cookie 原文</h3>
        <div class="mt-3">
          <button id="copyRawDialog" type="button" class="btn btn-outline btn-sm">复制原文</button>
        </div>
        <pre id="cookieRawContent" class="bg-base-200 p-4 rounded-lg mt-4 overflow-auto max-h-96 text-sm whitespace-pre-wrap break-all"></pre>
        <div class="modal-action">
          <button id="closeRawDialog" class="btn">关闭</button>
        </div>
      </div>
      <form method="dialog" class="modal-backdrop"><button>close</button></form>
    </dialog>

    <script nonce="${nonce}">
      (function() {
        var sel = document.getElementById("themeSelect");
        var saved = localStorage.getItem("cookie-share-theme");
        if (saved) {
          document.documentElement.setAttribute("data-theme", saved);
          sel.value = saved;
        }
        sel.addEventListener("change", function() {
          document.documentElement.setAttribute("data-theme", this.value);
          localStorage.setItem("cookie-share-theme", this.value);
        });
      })();

      document.querySelectorAll("[data-tab]").forEach(function(tab) {
        tab.addEventListener("click", function() {
          document.querySelectorAll("[data-tab]").forEach(function(t) { t.classList.remove("tab-active"); });
          document.querySelectorAll(".tab-panel").forEach(function(c) { c.classList.add("hidden"); });
          this.classList.add("tab-active");
          document.getElementById("tab-" + this.dataset.tab).classList.remove("hidden");
        });
      });

      const API_BASE = ${JSON.stringify(basePath).replace(/</g, "\\u003c")};
      const PASSWORD_KEY = "cookie-share-admin-password";
      const VERSION = ${JSON.stringify(ENCRYPTION_VERSION)};
      const ITERATIONS = ${JSON.stringify(PBKDF2_ITERATIONS)};
      const encoder = new TextEncoder();
      const decoder = new TextDecoder();
      let adminPassword = ""; // Session encryption key only, never the administrator password.
      let csrfToken = '';
      let expiryTimer;
      let listOffset = 0;
      let nextOffset = null;
      let editRevision = null;
      let editId = null;
      let rawDialog;
      let rawTitle;
      let rawContent;

      document.addEventListener("DOMContentLoaded", () => {
        // Upgrade an old saved credential once without putting it into the DOM.
        const previousPassword = localStorage.getItem(PASSWORD_KEY) || '';
        localStorage.removeItem(PASSWORD_KEY);
        rawDialog = document.getElementById("cookieRawDialog");
        rawTitle = document.getElementById("cookieRawTitle");
        rawContent = document.getElementById("cookieRawContent");
        document.getElementById("adminPassword").value = '';
        document.getElementById('logout').addEventListener('click', () => logout().catch(showError));
        document.getElementById('previousPage').addEventListener('click', () => { listOffset = Math.max(0, listOffset - 50); loadCookies().catch(showError); });
        document.getElementById('nextPage').addEventListener('click', () => { if (nextOffset !== null) { listOffset = nextOffset; loadCookies().catch(showError); } });
        document.getElementById("saveCredentials").addEventListener("click", () => saveCredentials().catch(showError));
        document.getElementById("closeRawDialog").addEventListener("click", () => {
          rawDialog.close();
        });
        document.getElementById("copyRawDialog").addEventListener("click", async () => {
          try {
            await navigator.clipboard.writeText(rawContent.textContent || "");
            setStatus("原文已复制。");
          } catch {
            setStatus("复制失败，请手动复制。", true);
          }
        });
        document.getElementById("createForm").addEventListener("submit", createCookie);
        document.getElementById("updateForm").addEventListener("submit", updateCookie);
        document.getElementById("deleteForm").addEventListener("submit", deleteCookie);
        document.getElementById("refreshList").addEventListener("click", () => loadCookies().catch(showError));
        document.getElementById("exportAll").addEventListener("click", () => exportAll().catch(showError));
        document.getElementById("importAll").addEventListener("click", () => importAll().catch(showError));

        if (previousPassword) login(previousPassword).then(loadCookies).catch(showError);
      });

      function setStatus(message, isError = false) {
        const node = document.getElementById("status");
        node.textContent = message || "";
        node.className = "text-sm mt-2 " + (isError ? "text-error" : "text-success");
      }

      function showError(error) {
        setStatus(error && error.message ? error.message : "请求失败", true);
      }

      function showPanels() {
        document.getElementById("panels").hidden = false;
      }

      function ensureCredentials() {
        if (!adminPassword) {
          throw new Error("请先输入管理员密码。");
        }
      }

      async function login(password) {
        const response = await fetch(API_BASE + '/admin/login', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ password }), credentials: 'same-origin', signal: AbortSignal.timeout(15000),
        });
        const result = await response.json();
        if (!response.ok) throw new Error(result.message || '登录失败');
        adminPassword = result.encryptionSecret;
        csrfToken = result.csrfToken;
        clearTimeout(expiryTimer);
        expiryTimer = setTimeout(() => logout().catch(showError), Math.max(0, result.expiresAt - Date.now()));
        document.getElementById('adminPassword').value = '';
        showPanels();
        setStatus('已登录；会话最长 30 分钟。');
      }
      async function saveCredentials() {
        const password = document.getElementById('adminPassword').value;
        if (!password) throw new Error('管理员密码不能为空。');
        await login(password);
        await loadCookies();
      }
      async function logout() {
        const headers = adminHeaders();
        adminPassword = ''; csrfToken = ''; clearTimeout(expiryTimer);
        localStorage.removeItem(PASSWORD_KEY);
        document.getElementById('panels').hidden = true;
        document.getElementById('cookieTableBody').replaceChildren();
        document.querySelectorAll('textarea, input').forEach((element) => { element.value = ''; });
        if (rawContent) rawContent.textContent = '';
        if (rawDialog?.open) rawDialog.close();
        editId = null; editRevision = null;
        setStatus('页面数据已清除。');
        const response = await fetch(API_BASE + '/admin/logout', { method: 'POST', headers,
          credentials: 'same-origin', signal: AbortSignal.timeout(15000) });
        if (!response.ok && response.status !== 401) throw new Error('本地已退出；服务端注销失败，会话将在到期时失效。');
      }
      function adminHeaders() {
        return { 'Content-Type': 'application/json', 'X-CSRF-Token': csrfToken };
      }

      function base64UrlEncode(bytes) {
        let binary = "";
        for (const value of bytes) {
          binary += String.fromCharCode(value);
        }
        return btoa(binary).replace(/\\+/g, "-").replace(/\\//g, "_").replace(/=+$/g, "");
      }

      function base64UrlDecode(value) {
        const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
        const padded = normalized + "=".repeat((4 - (normalized.length % 4 || 4)) % 4);
        const binary = atob(padded);
        const bytes = new Uint8Array(binary.length);
        for (let index = 0; index < binary.length; index += 1) {
          bytes[index] = binary.charCodeAt(index);
        }
        return bytes;
      }

      function isEnvelope(value) {
        return Boolean(
          value &&
          typeof value === "object" &&
          value.version === VERSION &&
          typeof value.salt === "string" &&
          typeof value.iv === "string" &&
          typeof value.payload === "string"
        );
      }

      async function deriveKey(secret, salt) {
        const material = await crypto.subtle.importKey(
          "raw",
          encoder.encode(secret),
          "PBKDF2",
          false,
          ["deriveKey"]
        );

        return await crypto.subtle.deriveKey(
          {
            name: "PBKDF2",
            hash: "SHA-256",
            salt,
            iterations: ITERATIONS,
          },
          material,
          {
            name: "AES-GCM",
            length: 256,
          },
          false,
          ["encrypt", "decrypt"]
        );
      }

      async function encryptClientPayload(secret, data) {
        const salt = crypto.getRandomValues(new Uint8Array(16));
        const iv = crypto.getRandomValues(new Uint8Array(12));
        const key = await deriveKey(secret, salt);
        const payload = new Uint8Array(
          await crypto.subtle.encrypt(
            { name: "AES-GCM", iv },
            key,
            encoder.encode(JSON.stringify(data))
          )
        );

        return {
          version: VERSION,
          salt: base64UrlEncode(salt),
          iv: base64UrlEncode(iv),
          payload: base64UrlEncode(payload),
        };
      }

      async function decryptClientPayload(secret, envelope) {
        if (!isEnvelope(envelope)) {
          throw new Error("Invalid encrypted payload");
        }

        try {
          const key = await deriveKey(secret, base64UrlDecode(envelope.salt));
          const plaintext = await crypto.subtle.decrypt(
            { name: "AES-GCM", iv: base64UrlDecode(envelope.iv) },
            key,
            base64UrlDecode(envelope.payload)
          );
          return JSON.parse(decoder.decode(plaintext));
        } catch {
          throw new Error("Transport secret mismatch or corrupted payload");
        }
      }

      async function requestEncryptedJson(path, options = {}) {
        ensureCredentials();

        const init = {
          method: options.method || "GET",
          headers: adminHeaders(),
          signal: AbortSignal.timeout(15000),
        };

        if (options.body !== undefined) {
          init.body = JSON.stringify(await encryptClientPayload(adminPassword, options.body));
        }

        const response = await fetch(API_BASE + path, init);
        const responseText = await response.text();
        let payload;

        try {
          payload = responseText ? JSON.parse(responseText) : {};
        } catch {
          throw new Error(responseText || "响应不是合法 JSON");
        }

        if (!response.ok) {
          if (isEnvelope(payload)) {
            const decryptedError = await decryptClientPayload(adminPassword, payload);
            throw new Error(decryptedError.message || decryptedError.error || "请求失败");
          }
          throw new Error(payload.message || payload.error || "请求失败");
        }

        return await decryptClientPayload(adminPassword, payload);
      }

      function parseCookieJson(id) {
        try {
          return JSON.parse(document.getElementById(id).value);
        } catch {
          throw new Error("Cookies 必须是合法 JSON 数组。");
        }
      }

      function showRawCookie(id, cookiesJson) {
        rawTitle.textContent = "Cookie 原文: " + id;
        rawContent.textContent = cookiesJson || "[]";
        rawDialog.showModal();
      }

      async function loadCookies() {
        const data = await requestEncryptedJson('/admin/list-cookies?summary=1&limit=50&offset=' + listOffset);
        nextOffset = data.nextOffset;
        document.getElementById('previousPage').disabled = listOffset === 0;
        document.getElementById('nextPage').disabled = nextOffset === null;
        const tbody = document.getElementById("cookieTableBody");
        tbody.replaceChildren();
        const rows = Array.isArray(data.cookies) ? data.cookies : [];

        if (rows.length === 0) {
          const row = document.createElement("tr");
          const cell = document.createElement("td");
          cell.colSpan = 4;
          cell.textContent = "暂无数据";
          cell.className = "text-center opacity-60";
          row.appendChild(cell);
          tbody.appendChild(row);
          setStatus("列表已刷新。");
          return;
        }

        for (const cookie of rows) {
          const row = document.createElement("tr");
          const idCell = document.createElement("td");
          const urlCell = document.createElement("td");
          const rawCell = document.createElement("td");
          const actionCell = document.createElement("td");
          const rawButton = document.createElement("button");
          const button = document.createElement("button");

          idCell.textContent = cookie.id;
          urlCell.textContent = cookie.url;
          rawButton.type = "button";
          rawButton.className = "btn btn-ghost btn-xs";
          rawButton.textContent = "查看原文";
          rawButton.addEventListener('click', () => {
            requestEncryptedJson('/admin/record/' + encodeURIComponent(cookie.id))
              .then((data) => showRawCookie(cookie.id, JSON.stringify(data.record.cookies, null, 2))).catch(showError);
          });
          rawCell.appendChild(rawButton);
          button.type = "button";
          button.className = "btn btn-error btn-xs";
          button.textContent = "删除";
          button.addEventListener("click", () => deleteCookieById(cookie.id).catch(showError));
          actionCell.appendChild(button);
          const edit = document.createElement('button');
          edit.className = 'btn btn-xs'; edit.type = 'button'; edit.textContent = '编辑';
          edit.onclick = () => requestEncryptedJson('/admin/record/' + encodeURIComponent(cookie.id)).then((data) => {
            editId = data.record.id; editRevision = data.record.revision;
            document.getElementById('updateId').value = editId;
            document.getElementById('updateUrl').value = data.record.url;
            document.getElementById('updateCookies').value = JSON.stringify(data.record.cookies, null, 2);
            document.querySelector('[data-tab="update"]').click();
            document.getElementById('updateId').focus();
          }).catch(showError);
          actionCell.appendChild(edit);
          row.append(idCell, urlCell, rawCell, actionCell);
          tbody.appendChild(row);
        }

        setStatus("列表已刷新。");
      }

      async function createCookie(event) {
        event.preventDefault();
        try {
          const result = await requestEncryptedJson("/admin/create", {
            method: "POST",
            body: {
              id: document.getElementById("createId").value.trim(),
              url: document.getElementById("createUrl").value.trim(),
              cookies: parseCookieJson("createCookies"),
              createOnly: true,
            },
          });
          document.getElementById("createForm").reset();
          setStatus("创建成功。");
          await loadCookies();
        } catch (error) {
          showError(error);
        }
      }

      async function updateCookie(event) {
        event.preventDefault();
        try {
          const key = document.getElementById('updateId').value.trim();
          const existing = await requestEncryptedJson('/admin/record/' + encodeURIComponent(key));
          const revision = editId === key && editRevision !== null ? editRevision : existing.record.revision;
          const result = await requestEncryptedJson("/admin/update", {
            method: "PUT",
            body: {
              key: document.getElementById("updateId").value.trim(),
              url: document.getElementById("updateUrl").value.trim(),
              value: parseCookieJson("updateCookies"),
              expectedRevision: revision,
            },
          });
          document.getElementById("updateForm").reset();
          setStatus("更新成功。");
          await loadCookies();
        } catch (error) {
          showError(error);
        }
      }

      async function deleteCookie(event) {
        event.preventDefault();
        await deleteCookieById(document.getElementById("deleteId").value.trim());
        document.getElementById("deleteForm").reset();
      }

      async function deleteCookieById(id) {
        if (!id) {
          throw new Error("请输入要删除的 ID。");
        }
        if (!window.confirm("确定删除 " + id + " 吗？")) {
          return;
        }

        const result = await requestEncryptedJson("/admin/delete?key=" + encodeURIComponent(id), {
          method: "DELETE",
        });
        setStatus("删除成功。");
        await loadCookies();
      }

      function exportFilename() {
        const now = new Date();
        const pad = (value) => String(value).padStart(2, "0");
        return "cookie-share-export-" +
          now.getFullYear() +
          pad(now.getMonth() + 1) +
          pad(now.getDate()) +
          "-" +
          pad(now.getHours()) +
          pad(now.getMinutes()) +
          pad(now.getSeconds()) +
          ".json";
      }

      async function exportAll() {
        ensureCredentials();
        const response = await fetch(API_BASE + "/admin/export-all", {
          method: "GET",
          headers: adminHeaders(),
        });
        const responseText = await response.text();
        let payload;

        try {
          payload = responseText ? JSON.parse(responseText) : {};
        } catch {
          throw new Error("导出响应格式无效");
        }

        if (!response.ok) {
          if (isEnvelope(payload)) {
            const decryptedError = await decryptClientPayload(adminPassword, payload);
            throw new Error(decryptedError.message || decryptedError.error || "导出失败");
          }
          throw new Error(payload.message || payload.error || "导出失败");
        }

        if (!isEnvelope(payload)) {
          throw new Error("导出内容不是合法加密文件");
        }

        const password = window.prompt('请设置独立备份密码（至少 12 位）；不保存此密码将无法恢复。', '');
        if (password === null) return;
        if (password.length < 12) throw new Error('备份密码至少需要 12 位。');
        const backup = { format: 'cookie-share-backup', backupVersion: 2,
          envelope: await encryptClientPayload(password, await decryptClientPayload(adminPassword, payload)) };
        const blob = new Blob([JSON.stringify(backup, null, 2)], { type: "application/json" });
        const blobUrl = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = blobUrl;
        link.download = exportFilename();
        document.body.appendChild(link);
        link.click();
        link.remove();
        URL.revokeObjectURL(blobUrl);
        setStatus("导出成功。");
      }

      async function importAll() {
        const file = document.getElementById("importFile").files[0];
        if (!file) {
          throw new Error("请先选择导入文件。");
        }

        let payload;
        try {
          payload = JSON.parse(await file.text());
        } catch {
          throw new Error("导入文件不是合法 JSON。");
        }

        const isNewBackup = payload?.format === 'cookie-share-backup' && payload.backupVersion === 2;
        const envelope = isNewBackup ? payload.envelope : payload;
        if (!isEnvelope(envelope)) throw new Error('导入文件不是合法加密信封。');
        const password = window.prompt(isNewBackup ? '请输入备份密码' : '请输入创建旧备份时的管理员密码', '');
        if (password === null) return;
        const backup = await decryptClientPayload(password, envelope);
        if (!Array.isArray(backup.records)) throw new Error('备份记录格式错误');
        if (!window.confirm('将按 ID 合并/覆盖 ' + backup.records.length + ' 条记录。确认已备份现有数据？')) return;
        const result = await requestEncryptedJson('/admin/import-all', { method: 'POST', body: backup });
        setStatus("导入成功，已导入 " + result.imported + " 条。");
        await loadCookies();
      }
    </script>
  </body>
</html>`, nonce);
}

function createResponse(body, init = {}) {
  const response = new Response(body, init);
  applyCorsHeaders(response.headers);
  response.headers.set('Cache-Control', 'no-store');
  response.headers.set('Referrer-Policy', 'no-referrer');
  response.headers.set('X-Content-Type-Options', 'nosniff');
  response.headers.set('X-Frame-Options', 'DENY');
  return response;
}

function jsonResponse(status, body) {
  return createResponse(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json; charset=UTF-8" },
  });
}

function htmlResponse(body, nonce) {
  return createResponse(body, {
    status: 200,
    headers: { "Content-Type": "text/html; charset=UTF-8",
      "Content-Security-Policy": `default-src 'none'; script-src 'nonce-${nonce}'; style-src 'unsafe-inline'; connect-src 'self'; img-src 'self' data:; frame-ancestors 'none'; base-uri 'none'; form-action 'self'` },
  });
}

function corsPreflightResponse() {
  return createResponse(null, { status: 204 });
}

function applyCorsHeaders(headers) {
  headers.set("Access-Control-Allow-Origin", "*");
  headers.set("Access-Control-Allow-Methods", CORS_METHODS);
  headers.set("Access-Control-Allow-Headers", CORS_HEADERS);
}

// Additive hardening: v1 remains available unless explicitly disabled by the owner.
const MAX_BODY_BYTES = 8 * 1024 * 1024;
const schemaPromises = new WeakMap();
const databaseSettings = new WeakMap();
const localRateWindows = new Map();
const CLIENT_PERMISSIONS = new Set(['read', 'write', 'delete']);

function plainError(status, message) {
  return new HttpError(status, message, { success: false, message }, { plain: true });
}

async function readLimitedBody(request, limit = MAX_BODY_BYTES) {
  const declared = request.headers.get('Content-Length');
  if (declared && Number(declared) > limit) throw plainError(413, 'Request body is too large');
  if (!request.body) return '';
  const reader = request.body.getReader();
  let size = 0;
  const chunks = [];
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > limit) { await reader.cancel(); throw plainError(413, 'Request body is too large'); }
      chunks.push(value);
    }
  } finally { reader.releaseLock(); }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; }
  return decoder.decode(bytes);
}

async function limitRequest(request, env, login = false) {
  const ip = request.headers.get('CF-Connecting-IP') || 'local';
  const key = (login ? 'login:' : 'api:') + ip;
  if (env.RATE_LIMITER && typeof env.RATE_LIMITER.limit === 'function') {
    if (!(await env.RATE_LIMITER.limit({ key })).success) throw plainError(429, 'Too many requests; retry later');
  }
  // Bounded, best-effort fallback only. Configure RATE_LIMITER/WAF for enforcement
  // across isolates; shared networks may need higher limits.
  const now = Date.now();
  let entry = localRateWindows.get(key);
  if (!entry || now >= entry.until) {
    if (localRateWindows.size >= 2048) localRateWindows.delete(localRateWindows.keys().next().value);
    entry = { count: 0, until: now + 60000 };
    localRateWindows.set(key, entry);
  }
  if (++entry.count > (login ? 30 : 600)) throw plainError(429, 'Too many requests; retry later');
}

function readDeviceCredentials(env) {
  if (!env.DEVICE_TOKENS) return [];
  let values;
  try { values = JSON.parse(env.DEVICE_TOKENS); } catch { throw plainError(500, 'Invalid DEVICE_TOKENS configuration'); }
  if (!Array.isArray(values) || values.length > 100) throw plainError(500, 'Invalid DEVICE_TOKENS configuration');
  for (const item of values) {
    if (!item || typeof item.token !== 'string' || !/^[A-Za-z0-9_-]{43,128}$/.test(item.token) ||
        !Array.isArray(item.records) || item.records.length > 100 ||
        !item.records.every((id) => id === '*' || ID_PATTERN.test(id)) ||
        !Array.isArray(item.permissions) || !item.permissions.every((p) => CLIENT_PERMISSIONS.has(p)) ||
        (item.expiresAt !== undefined && (typeof item.expiresAt !== 'string' || !Number.isFinite(Date.parse(item.expiresAt))))) {
      throw plainError(500, 'Invalid DEVICE_TOKENS configuration');
    }
  }
  return values;
}

function authorizeRecord(secret, id, permission) {
  if (!secret || typeof secret !== 'object' || !secret.credential) return;
  const access = secret.credential;
  if (!access.permissions.includes(permission) ||
      (!access.records.includes('*') && !access.records.includes(id))) throw plainError(403, 'Record access denied');
}

function clientSecret(request, env, config, url) {
  const authorization = request.headers.get('Authorization');
  const token = authorization?.startsWith('Bearer ') ? authorization.slice(7) : '';
  if (authorization && !token) throw plainError(401, 'Invalid client authorization');
  if (!token) {
    if (String(env.REQUIRE_CLIENT_AUTH).toLowerCase() === 'true') throw plainError(401, 'A device token is required');
    return config.transportSecret;
  }
  const credential = readDeviceCredentials(env).find((c) => timingSafeEqual(token, c.token));
  if (!credential || (credential.expiresAt && Date.parse(credential.expiresAt) <= Date.now())) throw plainError(401, 'Invalid or expired device token');
  const version = request.headers.get('X-Cookie-Protocol') === '2' ? 2 : 1;
  const secret = { secret: token, version, credential, database: env.COOKIE_DB };
  if (version === 2) {
    const requestId = request.headers.get('X-Request-Id') || '';
    const timestamp = Number(request.headers.get('X-Request-Time'));
    if (!/^[A-Za-z0-9_-]{22,64}$/.test(requestId) || !Number.isSafeInteger(timestamp) ||
        Math.abs(Date.now() - timestamp) > 300000) throw plainError(400, 'Invalid request context or clock skew');
    secret.context = { method: request.method, path: url.pathname, requestId, timestamp };
  }
  return secret;
}

function secretValue(secret) { return typeof secret === 'string' ? secret : secret.secret; }
function protocolVersion(secret) { return typeof secret === 'object' ? secret.version : 1; }
function protocolAAD(secret, direction) {
  return encoder.encode(JSON.stringify({ ...secret.context, direction }));
}
async function deriveV2Key(secret, salt) {
  const material = await crypto.subtle.importKey('raw', encoder.encode(secretValue(secret)), 'HKDF', false, ['deriveKey']);
  return crypto.subtle.deriveKey({ name: 'HKDF', hash: 'SHA-256', salt,
    info: encoder.encode('cookie-share/device-protocol/v2') }, material,
    { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
}

async function preventReplay(secret) {
  if (protocolVersion(secret) !== 2 || ['GET', 'HEAD'].includes(secret.context.method)) return;
  await ensureSchema(secret.database);
  const digest = base64UrlEncode(new Uint8Array(await crypto.subtle.digest('SHA-256',
    encoder.encode(secretValue(secret) + ':' + secret.context.requestId))));
  const results = await secret.database.batch([
    secret.database.prepare('DELETE FROM request_nonces WHERE expires_at < ?').bind(Date.now()),
    secret.database.prepare('INSERT INTO request_nonces (id, expires_at) VALUES (?, ?) ON CONFLICT(id) DO NOTHING')
      .bind(digest, secret.context.timestamp + 300001),
  ]);
  if (!results[1].meta.changes) throw plainError(409, 'Request already used; refresh the record before retrying');
}

async function sessionHash(token) {
  return base64UrlEncode(new Uint8Array(await crypto.subtle.digest('SHA-256', encoder.encode(token))));
}
async function sessionSecret(password, token, purpose) {
  const key = await crypto.subtle.importKey('raw', encoder.encode(password), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return base64UrlEncode(new Uint8Array(await crypto.subtle.sign('HMAC', key, encoder.encode('cookie-share/' + purpose + '/' + token))));
}
function sessionCookie(basePath, token, secure, maxAge = 1800) {
  return `cookie_share_admin=${token}; Path=${basePath}/admin; HttpOnly; SameSite=Strict; Max-Age=${maxAge}${secure ? '; Secure' : ''}`;
}
function sameOriginRequest(request) {
  const origin = request.headers.get('Origin');
  if (origin && origin !== new URL(request.url).origin) throw plainError(403, 'Cross-origin admin request denied');
  if (request.headers.get('Sec-Fetch-Site') === 'cross-site') throw plainError(403, 'Cross-origin admin request denied');
}
async function handleAdminLogin(request, env, config, basePath) {
  sameOriginRequest(request);
  const url = new URL(request.url);
  if (url.protocol !== 'https:' && !['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)) throw plainError(403, 'Admin login requires HTTPS');
  let body;
  try { body = JSON.parse(await readLimitedBody(request, 8192)); } catch (error) {
    if (error instanceof HttpError) throw error;
    throw plainError(400, 'Invalid login request');
  }
  if (!body || typeof body.password !== 'string' || !timingSafeEqual(body.password, config.adminPassword)) throw plainError(401, 'Unauthorized');
  await ensureSchema(env.COOKIE_DB);
  const token = base64UrlEncode(crypto.getRandomValues(new Uint8Array(32)));
  const expiresAt = Date.now() + 1800000;
  await env.COOKIE_DB.batch([
    env.COOKIE_DB.prepare('DELETE FROM admin_sessions WHERE expires_at < ?').bind(Date.now()),
    env.COOKIE_DB.prepare('INSERT INTO admin_sessions (token_hash, expires_at) VALUES (?, ?)').bind(await sessionHash(token), expiresAt),
  ]);
  const response = jsonResponse(200, { success: true, expiresAt,
    encryptionSecret: await sessionSecret(config.adminPassword, token, 'encryption'),
    csrfToken: await sessionSecret(config.adminPassword, token, 'csrf') });
  response.headers.set('Set-Cookie', sessionCookie(basePath, token, url.protocol === 'https:'));
  return response;
}
async function authorizeAdmin(request, env, config) {
  const legacy = request.headers.get('X-Admin-Password');
  if (legacy && String(env.DISABLE_LEGACY_ADMIN).toLowerCase() !== 'true') {
    ensureAdminPassword(request, config);
    return config.adminPassword;
  }
  const token = (request.headers.get('Cookie') || '').split(';').map((s) => s.trim()).find((s) => s.startsWith('cookie_share_admin='))?.slice('cookie_share_admin='.length);
  if (!token || !/^[A-Za-z0-9_-]{43}$/.test(token)) throw plainError(401, 'Unauthorized');
  sameOriginRequest(request);
  const expected = await sessionSecret(config.adminPassword, token, 'csrf');
  if (!timingSafeEqual(request.headers.get('X-CSRF-Token') || '', expected)) throw plainError(403, 'Invalid CSRF token');
  await ensureSchema(env.COOKIE_DB);
  const hash = await sessionHash(token);
  const session = await env.COOKIE_DB.prepare('SELECT expires_at FROM admin_sessions WHERE token_hash = ?').bind(hash).first();
  if (!session || session.expires_at <= Date.now()) throw plainError(401, 'Session expired');
  config.sessionHash = hash;
  return sessionSecret(config.adminPassword, token, 'encryption');
}

async function storageKey(database, keyId) {
  const env = databaseSettings.get(database) || {};
  let keys;
  try { keys = JSON.parse(env.STORAGE_KEYS || '{}'); } catch { throw plainError(500, 'Invalid storage key configuration'); }
  const encoded = keys[keyId];
  if (typeof encoded !== 'string') throw plainError(500, 'Storage decryption key unavailable');
  const bytes = base64UrlDecode(encoded);
  if (bytes.byteLength !== 32) throw plainError(500, 'Storage keys must contain 32 random bytes');
  return crypto.subtle.importKey('raw', bytes, 'AES-GCM', false, ['encrypt', 'decrypt']);
}
async function encodeStoredCookies(database, id, cookies) {
  const env = databaseSettings.get(database) || {};
  const plaintext = JSON.stringify(cookies);
  if (encoder.encode(plaintext).byteLength > 1300000) throw plainError(413, 'Cookie record is too large; split it before saving');
  if (!env.STORAGE_KEY_ID) return plaintext;
  const keyId = env.STORAGE_KEY_ID;
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await storageKey(database, keyId);
  const ciphertext = await crypto.subtle.encrypt({ name: 'AES-GCM', iv,
    additionalData: encoder.encode('cookie-share/storage/' + id) }, key, encoder.encode(plaintext));
  return JSON.stringify({ storageVersion: 1, keyId, iv: base64UrlEncode(iv), payload: base64UrlEncode(new Uint8Array(ciphertext)) });
}
async function decodeStoredCookies(database, id, value) {
  if (Array.isArray(value)) return value; // Existing D1 rows and old exports remain readable.
  if (!value || value.storageVersion !== 1) throw new Error('Invalid stored cookie format');
  const key = await storageKey(database, value.keyId);
  const data = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: base64UrlDecode(value.iv),
    additionalData: encoder.encode('cookie-share/storage/' + id) }, key, base64UrlDecode(value.payload));
  const cookies = JSON.parse(decoder.decode(data));
  if (!Array.isArray(cookies)) throw new Error('Invalid stored cookies');
  return cookies;
}

function pagination(url) {
  const limit = Number(url.searchParams.get('limit') || 50);
  const offset = Number(url.searchParams.get('offset') || 0);
  if (!Number.isSafeInteger(limit) || limit < 1 || limit > 200 || !Number.isSafeInteger(offset) || offset < 0) throw plainError(400, 'Invalid pagination');
  return { limit, offset };
}
async function handleAdminSummary(env, url, secret) {
  await ensureSchema(env.COOKIE_DB);
  const { limit, offset } = pagination(url);
  const { results } = await env.COOKIE_DB.prepare('SELECT id, url, host, created_at AS createdAt, updated_at AS updatedAt, revision FROM cookie_records ORDER BY updated_at DESC, id ASC LIMIT ? OFFSET ?').bind(limit + 1, offset).all();
  return encryptedJsonResponse(200, { success: true, cookies: results.slice(0, limit), nextOffset: results.length > limit ? offset + limit : null }, secret);
}
async function handleAdminRecord(id, env, secret) {
  validateId(id, 'Invalid cookie ID');
  await ensureSchema(env.COOKIE_DB);
  const record = await getCookieRecord(env.COOKIE_DB, id);
  return encryptedJsonResponse(record ? 200 : 404, record ? { success: true, record } : { success: false, message: 'Cookies not found' }, secret);
}
