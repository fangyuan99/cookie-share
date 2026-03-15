const CORS_METHODS = "GET, POST, PUT, DELETE, OPTIONS";
const CORS_HEADERS = "Content-Type, X-Admin-Password";
const ID_PATTERN = /^[A-Za-z0-9]{1,64}$/;
const SAME_SITE_VALUES = new Set(["lax", "strict", "none"]);
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
    updated_at TEXT NOT NULL
  )`,
  "CREATE INDEX IF NOT EXISTS idx_cookie_records_host ON cookie_records(host)",
  "CREATE INDEX IF NOT EXISTS idx_cookie_records_updated_at ON cookie_records(updated_at DESC)",
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

      const runtimeConfig = resolveRuntimeConfig(env, request.url);
      const url = new URL(request.url);
      const path = url.pathname;
      const basePath = `/${runtimeConfig.pathSecret}`;
      const isHtmlRoute = request.method === "GET" && path === `${basePath}/admin`;
      const isOptions = request.method === "OPTIONS";
      const useEncryptedResponse = !isHtmlRoute && !isOptions;
      const routeSecret = resolveRouteSecret(path, basePath, runtimeConfig);

      try {
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

  const message = error instanceof Error ? error.message : "Internal Server Error";
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
    hostname === "::1";

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
    ensureAdminPassword(request, runtimeConfig);
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
    return await handleDelete(url, env, runtimeConfig.transportSecret);
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

  return await encryptedJsonResponse(404, { success: false, message: "Not Found" }, routeSecret);
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
  if (leftBytes.length !== rightBytes.length) {
    return false;
  }

  let diff = 0;
  for (let index = 0; index < leftBytes.length; index += 1) {
    diff |= leftBytes[index] ^ rightBytes[index];
  }
  return diff === 0;
}

async function handleSendCookies(request, env, encryptionSecret) {
  const body = await readEncryptedRequestBody(request, encryptionSecret);
  const id = validateId(body?.id, "Invalid ID. Only letters and numbers are allowed.");
  const normalizedUrl = normalizeUrl(body?.url);
  const cookies = normalizeCookies(body?.cookies);

  await ensureSchema(env.COOKIE_DB);
  await upsertCookieRecord(env.COOKIE_DB, {
    id,
    url: normalizedUrl,
    host: extractHost(normalizedUrl),
    cookies,
  });

  return await encryptedJsonResponse(200, {
    success: true,
    message: "Cookies saved successfully",
  }, encryptionSecret);
}

async function handleReceiveCookies(cookieId, env, encryptionSecret) {
  const id = validateId(cookieId, "Invalid cookie ID");
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
  await ensureSchema(env.COOKIE_DB);
  return await encryptedJsonResponse(200, {
    success: true,
    cookies: await listCookieRecordsByHost(env.COOKIE_DB, host),
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
  await database.batch(SCHEMA_STATEMENTS.map((statement) => database.prepare(statement)));
}

async function upsertCookieRecord(database, record) {
  const now = new Date().toISOString();
  await database.prepare(
    `INSERT INTO cookie_records (id, url, host, cookies_json, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET
       url = excluded.url,
       host = excluded.host,
       cookies_json = excluded.cookies_json,
       updated_at = excluded.updated_at`
  ).bind(
    record.id,
    record.url,
    record.host,
    JSON.stringify(record.cookies),
    record.createdAt || now,
    record.updatedAt || now
  ).run();
}

async function upsertCookieRecords(database, records) {
  for (const record of records) {
    await upsertCookieRecord(database, record);
  }
}

async function getCookieRecord(database, id) {
  const row = await database.prepare(
    `SELECT id, url, host, cookies_json, created_at, updated_at
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
    cookies: parseStoredCookies(row.cookies_json, row.id),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

async function listCookieRecords(database) {
  const { results } = await database.prepare(
    `SELECT id, url FROM cookie_records ORDER BY updated_at DESC`
  ).all();

  return results.map((row) => ({ id: row.id, url: row.url }));
}

async function listCookieRecordsByHost(database, host) {
  const { results } = await database.prepare(
    `SELECT id, url FROM cookie_records WHERE host = ? ORDER BY updated_at DESC`
  ).bind(host).all();

  return results.map((row) => ({ id: row.id, url: row.url }));
}

async function listCookieRecordsWithPayload(database) {
  const { results } = await database.prepare(
    `SELECT id, url, host, cookies_json, created_at, updated_at
     FROM cookie_records
     ORDER BY updated_at DESC`
  ).all();

  return results.map((row) => ({
    id: row.id,
    url: row.url,
    host: row.host,
    cookies: parseStoredCookies(row.cookies_json, row.id),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }));
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
  if (typeof value !== "string" || !value.trim()) {
    return null;
  }

  const timestamp = new Date(value);
  return Number.isNaN(timestamp.getTime()) ? null : timestamp.toISOString();
}

function parseStoredCookies(rawCookies, recordId) {
  try {
    const parsed = JSON.parse(rawCookies);
    if (!Array.isArray(parsed)) {
      throw new Error("cookies_json is not an array");
    }
    return parsed;
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
  if (typeof value !== "string" || !value.trim()) {
    throw new HttpError(400, "Invalid URL", { success: false, message: "Invalid URL" });
  }

  const trimmedValue = value.trim();
  const candidate = /^[a-zA-Z][a-zA-Z\d+\-.]*:\/\//.test(trimmedValue) ? trimmedValue : `https://${trimmedValue}`;
  try {
    return new URL(candidate).toString();
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
  if (!Array.isArray(value)) {
    throw new HttpError(400, "Invalid cookie format", { success: false, message: "Invalid cookie format" });
  }
  return value.map((cookie) => normalizeCookie(cookie));
}

function normalizeCookie(cookie) {
  if (!cookie || typeof cookie !== "object") {
    throw invalidCookieError();
  }
  if (typeof cookie.name !== "string" || !cookie.name) {
    throw invalidCookieError();
  }
  if (typeof cookie.value !== "string") {
    throw invalidCookieError();
  }
  if (typeof cookie.domain !== "string" || !cookie.domain.trim()) {
    throw invalidCookieError();
  }
  if (typeof cookie.httpOnly !== "boolean" || typeof cookie.secure !== "boolean") {
    throw invalidCookieError();
  }

  const sameSite = normalizeSameSite(cookie.sameSite);
  const hasLeadingDot = cookie.domain.trim().startsWith(".");
  const expirationDate =
    cookie.expirationDate === undefined || cookie.expirationDate === null
      ? undefined
      : Number(cookie.expirationDate);

  if (expirationDate !== undefined && !Number.isFinite(expirationDate)) {
    throw invalidCookieError();
  }

  return {
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

  if (cookie.expirationDate !== undefined) {
    responseCookie.expirationDate = cookie.expirationDate;
  }
  return responseCookie;
}

async function readEncryptedRequestBody(request, secret) {
  let rawText;
  try {
    rawText = await request.text();
  } catch {
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

  return await decryptPayload(secret, envelope);
}

async function encryptPayload(secret, data) {
  const salt = crypto.getRandomValues(new Uint8Array(SALT_LENGTH));
  const iv = crypto.getRandomValues(new Uint8Array(IV_LENGTH));
  const key = await deriveAesKey(secret, salt);
  const ciphertext = new Uint8Array(
    await crypto.subtle.encrypt(
      { name: "AES-GCM", iv },
      key,
      encoder.encode(JSON.stringify(data))
    )
  );

  return {
    version: ENCRYPTION_VERSION,
    salt: base64UrlEncode(salt),
    iv: base64UrlEncode(iv),
    payload: base64UrlEncode(ciphertext),
  };
}

async function decryptPayload(secret, envelope) {
  if (!isEncryptedEnvelope(envelope)) {
    throw new HttpError(400, "Invalid encrypted payload", {
      success: false,
      message: "Invalid encrypted payload",
    });
  }

  try {
    const salt = base64UrlDecode(envelope.salt);
    const iv = base64UrlDecode(envelope.iv);
    const payload = base64UrlDecode(envelope.payload);
    const key = await deriveAesKey(secret, salt);
    const plaintext = await crypto.subtle.decrypt({ name: "AES-GCM", iv }, key, payload);
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
    value.version === ENCRYPTION_VERSION &&
    typeof value.salt === "string" &&
    typeof value.iv === "string" &&
    typeof value.payload === "string"
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
      error: error instanceof Error ? error.message : "Internal Server Error",
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
  const devHint = runtimeConfig.isLocalDevFallback
    ? "<p><small>localhost dev 默认值：<code>PATH_SECRET=dev</code>、<code>ADMIN_PASSWORD=dev-password</code>、<code>TRANSPORT_SECRET=dev-transport-secret</code>。</small></p>"
    : "";

  return htmlResponse(`<!doctype html>
<html lang="zh-CN">
  <head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>Cookie Share Admin</title>
    <link
      rel="stylesheet"
      href="https://cdn.jsdelivr.net/npm/@picocss/pico@2/css/pico.min.css"
    >
  </head>
  <body>
    <main class="container">
      <header>
        <h1>Cookie Share 管理页</h1>
        <p>管理页 HTML 明文返回，所有 <code>/admin/*</code> JSON API 都使用 <code>ADMIN_PASSWORD</code> 做鉴权与加密。</p>
        ${devHint}
      </header>

      <section>
        <h2>凭据</h2>
        <label>
          管理员密码
          <input id="adminPassword" type="password" placeholder="X-Admin-Password">
        </label>
        <button id="saveCredentials" type="button">保存并加载</button>
        <p id="status" role="status"></p>
      </section>

      <section id="panels" hidden>
        <div class="grid">
          <article>
            <h3>创建</h3>
            <form id="createForm">
              <label>
                ID
                <input id="createId" required>
              </label>
              <label>
                URL
                <input id="createUrl" required>
              </label>
              <label>
                Cookies JSON
                <textarea id="createCookies" required></textarea>
              </label>
              <button type="submit">创建</button>
            </form>
          </article>

          <article>
            <h3>更新</h3>
            <form id="updateForm">
              <label>
                ID
                <input id="updateId" required>
              </label>
              <label>
                URL
                <input id="updateUrl" placeholder="留空则保留原值">
              </label>
              <label>
                Cookies JSON
                <textarea id="updateCookies" required></textarea>
              </label>
              <button type="submit">更新</button>
            </form>
          </article>

          <article>
            <h3>删除</h3>
            <form id="deleteForm">
              <label>
                ID
                <input id="deleteId" required>
              </label>
              <button type="submit" class="contrast">删除</button>
            </form>
          </article>
        </div>

        <article>
          <h3>导入 / 导出</h3>
          <div class="grid">
            <button id="exportAll" type="button" class="secondary">导出全部数据</button>
            <input id="importFile" type="file" accept=".json,application/json">
            <button id="importAll" type="button">导入全部数据</button>
          </div>
          <p><small>导出文件为加密 JSON；导入策略为按 ID 覆盖合并，不会清空现有数据。</small></p>
        </article>

        <article>
          <div class="grid">
            <div>
              <h3>已存储记录</h3>
              <p><small>按最近更新时间倒序排列。</small></p>
            </div>
            <div>
              <button id="refreshList" type="button" class="secondary">刷新列表</button>
            </div>
          </div>
          <figure>
            <table>
              <thead>
                <tr>
                  <th scope="col">ID</th>
                  <th scope="col">URL</th>
                  <th scope="col">Cookie 原文</th>
                  <th scope="col">操作</th>
                </tr>
              </thead>
              <tbody id="cookieTableBody"></tbody>
            </table>
          </figure>
        </article>
      </section>

      <dialog id="cookieRawDialog">
        <article style="width:min(1200px, 92vw); max-width:1200px;">
          <header>
            <button id="closeRawDialog" aria-label="Close" rel="prev"></button>
            <h3 id="cookieRawTitle">Cookie 原文</h3>
          </header>
          <p>
            <button id="copyRawDialog" type="button" class="secondary">复制原文</button>
          </p>
          <pre id="cookieRawContent"></pre>
        </article>
      </dialog>
    </main>

    <script>
      const API_BASE = ${JSON.stringify(basePath)};
      const PASSWORD_KEY = "cookie-share-admin-password";
      const VERSION = ${JSON.stringify(ENCRYPTION_VERSION)};
      const ITERATIONS = ${JSON.stringify(PBKDF2_ITERATIONS)};
      const encoder = new TextEncoder();
      const decoder = new TextDecoder();
      let adminPassword = "";
      let rawDialog;
      let rawTitle;
      let rawContent;

      document.addEventListener("DOMContentLoaded", () => {
        adminPassword = localStorage.getItem(PASSWORD_KEY) || "";
        rawDialog = document.getElementById("cookieRawDialog");
        rawTitle = document.getElementById("cookieRawTitle");
        rawContent = document.getElementById("cookieRawContent");
        document.getElementById("adminPassword").value = adminPassword;
        document.getElementById("saveCredentials").addEventListener("click", saveCredentials);
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

        if (adminPassword) {
          showPanels();
          loadCookies().catch(showError);
        }
      });

      function setStatus(message, isError = false) {
        const node = document.getElementById("status");
        node.textContent = message || "";
        node.dataset.state = isError ? "error" : "ok";
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

      function saveCredentials() {
        const password = document.getElementById("adminPassword").value.trim();
        if (!password) {
          setStatus("管理员密码不能为空。", true);
          return;
        }

        adminPassword = password;
        localStorage.setItem(PASSWORD_KEY, password);
        showPanels();
        setStatus("凭据已保存，正在加载列表。");
        loadCookies().catch(showError);
      }

      function adminHeaders() {
        return {
          "Content-Type": "application/json",
          "X-Admin-Password": adminPassword,
        };
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
        const data = await requestEncryptedJson("/admin/list-cookies");
        const tbody = document.getElementById("cookieTableBody");
        tbody.replaceChildren();
        const rows = Array.isArray(data.cookies) ? data.cookies : [];

        if (rows.length === 0) {
          const row = document.createElement("tr");
          const cell = document.createElement("td");
          cell.colSpan = 4;
          cell.textContent = "暂无数据";
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
          rawButton.className = "secondary";
          rawButton.textContent = "查看原文";
          rawButton.addEventListener("click", () => {
            showRawCookie(cookie.id, cookie.cookiesJson);
          });
          rawCell.appendChild(rawButton);
          button.type = "button";
          button.className = "contrast";
          button.textContent = "删除";
          button.addEventListener("click", () => deleteCookieById(cookie.id).catch(showError));
          actionCell.appendChild(button);
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
          const result = await requestEncryptedJson("/admin/update", {
            method: "PUT",
            body: {
              key: document.getElementById("updateId").value.trim(),
              url: document.getElementById("updateUrl").value.trim(),
              value: parseCookieJson("updateCookies"),
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

        const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
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

        if (!isEnvelope(payload)) {
          throw new Error("导入文件不是合法加密信封。");
        }

        const result = await requestEncryptedJson("/admin/import-all", {
          method: "POST",
          body: await decryptClientPayload(adminPassword, payload),
        });
        setStatus("导入成功，已导入 " + result.imported + " 条。");
        await loadCookies();
      }
    </script>
  </body>
</html>`);
}

function createResponse(body, init = {}) {
  const response = new Response(body, init);
  applyCorsHeaders(response.headers);
  return response;
}

function jsonResponse(status, body) {
  return createResponse(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json; charset=UTF-8" },
  });
}

function htmlResponse(body) {
  return createResponse(body, {
    status: 200,
    headers: { "Content-Type": "text/html; charset=UTF-8" },
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
