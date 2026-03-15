const CORS_METHODS = "GET, POST, PUT, DELETE, OPTIONS";
const CORS_HEADERS = "Content-Type, X-Admin-Password";
const ID_PATTERN = /^[A-Za-z0-9]{1,64}$/;
const SAME_SITE_VALUES = new Set(["lax", "strict", "none"]);
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
  constructor(status, message, payload) {
    super(message);
    this.name = "HttpError";
    this.status = status;
    this.payload = payload;
  }
}

export default {
  async fetch(request, env) {
    try {
      validateDatabaseBinding(env);
      const runtimeConfig = resolveRuntimeConfig(env, request.url);
      return await handleRequest(request, env, runtimeConfig);
    } catch (error) {
      if (error instanceof HttpError) {
        return jsonResponse(
          error.status,
          error.payload || { success: false, message: error.message }
        );
      }

      console.error("Unhandled worker error", error);
      return jsonResponse(500, {
        success: false,
        error: error instanceof Error ? error.message : "Internal Server Error",
      });
    }
  },
};

function validateDatabaseBinding(env) {
  if (!env || typeof env !== "object") {
    throw new HttpError(500, "Missing environment bindings", {
      success: false,
      error: "Missing environment bindings",
    });
  }

  if (!env.COOKIE_DB || typeof env.COOKIE_DB.prepare !== "function") {
    throw new HttpError(
      500,
      "Missing required bindings: COOKIE_DB",
      {
        success: false,
        error: "Missing required bindings: COOKIE_DB",
      }
    );
  }
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

  const missing = [];
  if (!adminPassword) {
    missing.push("ADMIN_PASSWORD");
  }
  if (!pathSecret) {
    missing.push("PATH_SECRET");
  }

  if (missing.length > 0) {
    throw new HttpError(
      500,
      `Missing required bindings: ${missing.join(", ")}`,
      {
        success: false,
        error: `Missing required bindings: ${missing.join(", ")}`,
      }
    );
  }

  return {
    adminPassword,
    pathSecret,
    isLocalDevFallback:
      isLocalDevHost &&
      (!(typeof env.ADMIN_PASSWORD === "string" && env.ADMIN_PASSWORD) ||
        !(typeof env.PATH_SECRET === "string" && env.PATH_SECRET.trim())),
  };
}

async function handleRequest(request, env, runtimeConfig) {
  const url = new URL(request.url);
  const path = url.pathname;
  const basePath = `/${runtimeConfig.pathSecret}`;

  if (path !== basePath && !path.startsWith(`${basePath}/`)) {
    return jsonResponse(404, { success: false, message: "Not Found" });
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
    return handleSendCookies(request, env);
  }

  const receivePrefix = `${basePath}/receive-cookies/`;
  if (request.method === "GET" && path.startsWith(receivePrefix)) {
    return handleReceiveCookies(path.slice(receivePrefix.length), env);
  }

  if (request.method === "GET" && path === `${basePath}/admin/list-cookies`) {
    return handleListCookies(env);
  }

  const hostPrefix = `${basePath}/admin/list-cookies-by-host/`;
  if (request.method === "GET" && path.startsWith(hostPrefix)) {
    return handleListCookiesByHost(path.slice(hostPrefix.length), env);
  }

  if (request.method === "DELETE" && path === `${basePath}/admin/delete`) {
    return handleDelete(url, env);
  }

  if (request.method === "PUT" && path === `${basePath}/admin/update`) {
    return handleUpdate(request, env);
  }

  return jsonResponse(404, { success: false, message: "Not Found" });
}

function ensureAdminPassword(request, runtimeConfig) {
  const providedPassword = request.headers.get("X-Admin-Password");
  if (
    !providedPassword ||
    !timingSafeEqual(providedPassword, runtimeConfig.adminPassword)
  ) {
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

  const encoder = new TextEncoder();
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

async function handleSendCookies(request, env) {
  const body = await readJson(request);
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

  return jsonResponse(200, {
    success: true,
    message: "Cookies saved successfully",
  });
}

async function handleReceiveCookies(cookieId, env) {
  const id = validateId(cookieId, "Invalid cookie ID");

  await ensureSchema(env.COOKIE_DB);
  const record = await getCookieRecord(env.COOKIE_DB, id);

  if (!record) {
    return jsonResponse(404, {
      success: false,
      message: "Cookies not found",
    });
  }

  return jsonResponse(200, {
    success: true,
    cookies: record.cookies.map((cookie) => formatCookieForResponse(cookie)),
  });
}

async function handleDelete(url, env) {
  const key = validateId(
    url.searchParams.get("key"),
    "Invalid key. Only letters and numbers are allowed."
  );

  await ensureSchema(env.COOKIE_DB);
  await deleteCookieRecord(env.COOKIE_DB, key);

  return jsonResponse(200, {
    success: true,
    message: "Data deleted successfully",
  });
}

async function handleListCookies(env) {
  await ensureSchema(env.COOKIE_DB);
  const cookies = await listCookieRecords(env.COOKIE_DB);
  return jsonResponse(200, { success: true, cookies });
}

async function handleListCookiesByHost(encodedHost, env) {
  const host = normalizeHostParameter(encodedHost);

  await ensureSchema(env.COOKIE_DB);
  const cookies = await listCookieRecordsByHost(env.COOKIE_DB, host);
  return jsonResponse(200, { success: true, cookies });
}

async function handleUpdate(request, env) {
  const body = await readJson(request);
  const key = validateId(
    body?.key,
    "Invalid key. Only letters and numbers are allowed."
  );
  const cookies = normalizeCookies(body?.value);

  await ensureSchema(env.COOKIE_DB);
  const existingRecord = await getCookieRecord(env.COOKIE_DB, key);

  if (!existingRecord) {
    return jsonResponse(404, {
      success: false,
      message: "Cookie not found",
    });
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

  return jsonResponse(200, {
    success: true,
    message: "Cookies and URL updated successfully",
  });
}

async function ensureSchema(database) {
  await database.batch(SCHEMA_STATEMENTS.map((statement) => database.prepare(statement)));
}

async function upsertCookieRecord(database, record) {
  const now = new Date().toISOString();

  await database
    .prepare(
      `INSERT INTO cookie_records (id, url, host, cookies_json, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET
         url = excluded.url,
         host = excluded.host,
         cookies_json = excluded.cookies_json,
         updated_at = excluded.updated_at`
    )
    .bind(
      record.id,
      record.url,
      record.host,
      JSON.stringify(record.cookies),
      now,
      now
    )
    .run();
}

async function getCookieRecord(database, id) {
  const row = await database
    .prepare(
      `SELECT id, url, host, cookies_json, created_at, updated_at
       FROM cookie_records
       WHERE id = ?`
    )
    .bind(id)
    .first();

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
  const { results } = await database
    .prepare(
      `SELECT id, url
       FROM cookie_records
       ORDER BY updated_at DESC`
    )
    .all();

  return results.map((row) => ({
    id: row.id,
    url: row.url,
  }));
}

async function listCookieRecordsByHost(database, host) {
  const { results } = await database
    .prepare(
      `SELECT id, url
       FROM cookie_records
       WHERE host = ?
       ORDER BY updated_at DESC`
    )
    .bind(host)
    .all();

  return results.map((row) => ({
    id: row.id,
    url: row.url,
  }));
}

async function deleteCookieRecord(database, id) {
  await database.prepare("DELETE FROM cookie_records WHERE id = ?").bind(id).run();
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

async function readJson(request) {
  try {
    return await request.json();
  } catch {
    throw new HttpError(400, "Invalid JSON body", {
      success: false,
      message: "Invalid JSON body",
    });
  }
}

function validateId(value, message) {
  if (typeof value !== "string" || !ID_PATTERN.test(value)) {
    throw new HttpError(400, message, {
      success: false,
      message,
    });
  }

  return value;
}

function normalizeUrl(value) {
  if (typeof value !== "string" || !value.trim()) {
    throw new HttpError(400, "Invalid URL", {
      success: false,
      message: "Invalid URL",
    });
  }

  const trimmedValue = value.trim();
  const candidate = /^[a-zA-Z][a-zA-Z\d+\-.]*:\/\//.test(trimmedValue)
    ? trimmedValue
    : `https://${trimmedValue}`;

  try {
    const parsedUrl = new URL(candidate);
    return parsedUrl.toString();
  } catch {
    throw new HttpError(400, "Invalid URL", {
      success: false,
      message: "Invalid URL",
    });
  }
}

function extractHost(url) {
  return new URL(url).hostname.toLowerCase();
}

function normalizeHostParameter(value) {
  if (typeof value !== "string" || !value) {
    throw new HttpError(400, "Invalid host", {
      success: false,
      message: "Invalid host",
    });
  }

  let decodedValue = "";
  try {
    decodedValue = decodeURIComponent(value);
  } catch {
    throw new HttpError(400, "Invalid host", {
      success: false,
      message: "Invalid host",
    });
  }

  const normalizedHost = decodedValue.trim().toLowerCase();
  if (!normalizedHost) {
    throw new HttpError(400, "Invalid host", {
      success: false,
      message: "Invalid host",
    });
  }

  return normalizedHost;
}

function normalizeCookies(value) {
  if (!Array.isArray(value)) {
    throw new HttpError(400, "Invalid cookie format", {
      success: false,
      message: "Invalid cookie format",
    });
  }

  return value.map((cookie) => normalizeCookie(cookie));
}

function normalizeCookie(cookie) {
  if (!cookie || typeof cookie !== "object") {
    throw new HttpError(400, "Invalid cookie format", {
      success: false,
      message: "Invalid cookie format",
    });
  }

  if (typeof cookie.name !== "string" || !cookie.name) {
    throw new HttpError(400, "Invalid cookie format", {
      success: false,
      message: "Invalid cookie format",
    });
  }

  if (typeof cookie.value !== "string") {
    throw new HttpError(400, "Invalid cookie format", {
      success: false,
      message: "Invalid cookie format",
    });
  }

  if (typeof cookie.domain !== "string" || !cookie.domain.trim()) {
    throw new HttpError(400, "Invalid cookie format", {
      success: false,
      message: "Invalid cookie format",
    });
  }

  if (typeof cookie.httpOnly !== "boolean" || typeof cookie.secure !== "boolean") {
    throw new HttpError(400, "Invalid cookie format", {
      success: false,
      message: "Invalid cookie format",
    });
  }

  const sameSite = normalizeSameSite(cookie.sameSite);
  const hasLeadingDot = cookie.domain.trim().startsWith(".");
  const expirationDate =
    cookie.expirationDate === undefined || cookie.expirationDate === null
      ? undefined
      : Number(cookie.expirationDate);

  if (expirationDate !== undefined && !Number.isFinite(expirationDate)) {
    throw new HttpError(400, "Invalid cookie format", {
      success: false,
      message: "Invalid cookie format",
    });
  }

  return {
    domain: cookie.domain.trim().replace(/^\./, "").toLowerCase(),
    expirationDate,
    hostOnly:
      typeof cookie.hostOnly === "boolean" ? cookie.hostOnly : !hasLeadingDot,
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
    throw new HttpError(400, "Invalid cookie format", {
      success: false,
      message: "Invalid cookie format",
    });
  }

  const normalizedValue = value.trim().toLowerCase();
  if (!SAME_SITE_VALUES.has(normalizedValue)) {
    throw new HttpError(400, "Invalid cookie format", {
      success: false,
      message: "Invalid cookie format",
    });
  }

  return normalizedValue;
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

function handleAdminPage(basePath, runtimeConfig) {
  const devHint = runtimeConfig.isLocalDevFallback
    ? '<div class="status" style="margin-top: 0; margin-bottom: 16px;">本地 dev 模式正在使用默认凭据：PATH_SECRET = <code>dev</code>，管理员密码 = <code>dev-password</code>。如需自定义，请创建 <code>.dev.vars</code>。</div>'
    : "";

  return htmlResponse(`<!DOCTYPE html>
<html lang="zh-CN">
  <head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>Cookie 管理器</title>
    <style>
      :root {
        color-scheme: light;
        --bg: linear-gradient(135deg, #f3f7ff 0%, #eef8f3 100%);
        --card: rgba(255, 255, 255, 0.88);
        --border: rgba(15, 23, 42, 0.08);
        --text: #122033;
        --muted: #526275;
        --primary: #0b63ce;
        --primary-dark: #0a56b2;
        --danger: #c93c37;
        --danger-dark: #a92e2a;
      }

      * {
        box-sizing: border-box;
      }

      body {
        margin: 0;
        min-height: 100vh;
        font-family: "Segoe UI", sans-serif;
        background: var(--bg);
        color: var(--text);
      }

      .page {
        width: min(1080px, calc(100vw - 32px));
        margin: 24px auto;
        padding: 24px;
        border: 1px solid var(--border);
        border-radius: 24px;
        background: var(--card);
        backdrop-filter: blur(18px);
        box-shadow: 0 24px 80px rgba(15, 23, 42, 0.12);
      }

      .hero {
        display: grid;
        gap: 12px;
        margin-bottom: 24px;
      }

      .hero h1 {
        margin: 0;
        font-size: clamp(30px, 4vw, 42px);
      }

      .hero p {
        margin: 0;
        color: var(--muted);
      }

      .grid {
        display: grid;
        gap: 16px;
        grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
      }

      .card {
        border: 1px solid var(--border);
        border-radius: 18px;
        padding: 18px;
        background: rgba(255, 255, 255, 0.8);
      }

      .card h2 {
        margin-top: 0;
        margin-bottom: 12px;
        font-size: 20px;
      }

      label {
        display: block;
        font-size: 14px;
        color: var(--muted);
        margin-bottom: 8px;
      }

      input,
      textarea,
      button {
        font: inherit;
      }

      input,
      textarea {
        width: 100%;
        border: 1px solid rgba(15, 23, 42, 0.12);
        border-radius: 12px;
        padding: 12px 14px;
        background: rgba(255, 255, 255, 0.92);
        color: var(--text);
      }

      textarea {
        min-height: 120px;
        resize: vertical;
      }

      button {
        border: 0;
        border-radius: 12px;
        padding: 12px 16px;
        cursor: pointer;
        font-weight: 600;
      }

      .primary {
        background: var(--primary);
        color: #fff;
      }

      .primary:hover {
        background: var(--primary-dark);
      }

      .danger {
        background: var(--danger);
        color: #fff;
      }

      .danger:hover {
        background: var(--danger-dark);
      }

      .ghost {
        background: rgba(11, 99, 206, 0.08);
        color: var(--primary);
      }

      .row {
        display: flex;
        gap: 12px;
        align-items: center;
      }

      .row > * {
        flex: 1;
      }

      .hidden {
        display: none;
      }

      .toolbar {
        display: flex;
        justify-content: space-between;
        gap: 12px;
        align-items: center;
        margin-bottom: 12px;
        flex-wrap: wrap;
      }

      table {
        width: 100%;
        border-collapse: collapse;
      }

      th,
      td {
        padding: 12px;
        border-bottom: 1px solid rgba(15, 23, 42, 0.08);
        text-align: left;
        vertical-align: top;
      }

      th {
        color: var(--muted);
        font-weight: 600;
      }

      .muted {
        color: var(--muted);
        font-size: 14px;
      }

      .status {
        min-height: 20px;
        color: var(--muted);
        margin-top: 12px;
      }

      .table-actions {
        display: flex;
        gap: 8px;
        flex-wrap: wrap;
      }

      @media (max-width: 640px) {
        .page {
          width: calc(100vw - 20px);
          margin: 10px auto;
          padding: 16px;
        }

        .row {
          flex-direction: column;
          align-items: stretch;
        }

        th:nth-child(2),
        td:nth-child(2) {
          display: none;
        }
      }
    </style>
  </head>
  <body>
    <main class="page">
      <section class="hero">
        <h1>Cookie 管理器</h1>
        <p>管理 Cloudflare Worker 中保存的 Cookie 数据。页面本身可直接打开，真正的增删改查仍然需要管理员密码。</p>
      </section>
      ${devHint}

      <section class="card">
        <h2>管理员密码</h2>
        <div class="row">
          <div>
            <label for="adminPassword">X-Admin-Password</label>
            <input id="adminPassword" type="password" placeholder="输入管理员密码">
          </div>
          <div>
            <label>&nbsp;</label>
            <button id="savePassword" type="button" class="primary">保存并加载</button>
          </div>
        </div>
        <div id="status" class="status"></div>
      </section>

      <div id="managementPanels" class="grid hidden">
        <section class="card">
          <h2>创建 Cookie</h2>
          <form id="createForm">
            <label for="createId">ID</label>
            <input id="createId" type="text" required>
            <label for="createUrl">URL</label>
            <input id="createUrl" type="url" required>
            <label for="createCookies">Cookies (JSON 数组)</label>
            <textarea id="createCookies" required></textarea>
            <button type="submit" class="primary">创建</button>
          </form>
        </section>

        <section class="card">
          <h2>更新 Cookie</h2>
          <form id="updateForm">
            <label for="updateId">ID</label>
            <input id="updateId" type="text" required>
            <label for="updateUrl">URL (留空则保持原值)</label>
            <input id="updateUrl" type="text">
            <label for="updateCookies">Cookies (JSON 数组)</label>
            <textarea id="updateCookies" required></textarea>
            <button type="submit" class="primary">更新</button>
          </form>
        </section>

        <section class="card">
          <h2>删除 Cookie</h2>
          <form id="deleteForm">
            <label for="deleteId">ID</label>
            <input id="deleteId" type="text" required>
            <button type="submit" class="danger">删除</button>
          </form>
        </section>

        <section id="cookieListSection" class="card" style="grid-column: 1 / -1;">
          <div class="toolbar">
            <div>
              <h2 style="margin: 0;">已存储的 Cookies</h2>
              <div class="muted">列表按最近更新时间倒序排列。</div>
            </div>
            <button id="refreshList" type="button" class="ghost">刷新列表</button>
          </div>
          <table>
            <thead>
              <tr>
                <th>ID</th>
                <th>URL</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody id="cookieTableBody"></tbody>
          </table>
        </section>
      </div>
    </main>

    <script>
      const API_BASE = ${JSON.stringify(basePath)};
      const PASSWORD_KEY = "cookie-share-admin-password";
      let adminPassword = "";

      document.addEventListener("DOMContentLoaded", function () {
        adminPassword = localStorage.getItem(PASSWORD_KEY) || "";
        if (adminPassword) {
          document.getElementById("adminPassword").value = adminPassword;
          showPanels();
          loadCookies().catch(showError);
        }

        document.getElementById("savePassword").addEventListener("click", savePassword);
        document.getElementById("createForm").addEventListener("submit", createCookie);
        document.getElementById("updateForm").addEventListener("submit", updateCookie);
        document.getElementById("deleteForm").addEventListener("submit", deleteCookie);
        document.getElementById("refreshList").addEventListener("click", function () {
          loadCookies().catch(showError);
        });
      });

      function showPanels() {
        document.getElementById("managementPanels").classList.remove("hidden");
      }

      function setStatus(message, isError) {
        const status = document.getElementById("status");
        status.textContent = message || "";
        status.style.color = isError ? "#c93c37" : "#526275";
      }

      function savePassword() {
        const password = document.getElementById("adminPassword").value.trim();
        if (!password) {
          setStatus("请输入有效的管理员密码。", true);
          return;
        }

        adminPassword = password;
        localStorage.setItem(PASSWORD_KEY, password);
        showPanels();
        setStatus("管理员密码已保存，正在加载列表。", false);
        loadCookies().catch(showError);
      }

      function adminHeaders() {
        return {
          "Content-Type": "application/json",
          "X-Admin-Password": adminPassword,
        };
      }

      async function requestJson(path, options) {
        const response = await fetch(API_BASE + path, options || {});
        const responseText = await response.text();
        let payload = {};

        if (responseText) {
          try {
            payload = JSON.parse(responseText);
          } catch {
            payload = { message: responseText };
          }
        }

        if (!response.ok) {
          throw new Error(payload.message || payload.error || "请求失败");
        }

        return payload;
      }

      async function loadCookies() {
        if (!adminPassword) {
          setStatus("请先输入管理员密码。", true);
          return;
        }

        const tableBody = document.getElementById("cookieTableBody");
        tableBody.replaceChildren();

        try {
          const data = await requestJson("/admin/list-cookies", {
            method: "GET",
            headers: adminHeaders(),
          });

          if (!Array.isArray(data.cookies) || data.cookies.length === 0) {
            const row = document.createElement("tr");
            const cell = document.createElement("td");
            cell.colSpan = 3;
            cell.textContent = "暂无数据";
            row.appendChild(cell);
            tableBody.appendChild(row);
            setStatus("列表已刷新。", false);
            return;
          }

          data.cookies.forEach(function (cookie) {
            const row = document.createElement("tr");

            const idCell = document.createElement("td");
            idCell.textContent = cookie.id;
            row.appendChild(idCell);

            const urlCell = document.createElement("td");
            urlCell.textContent = cookie.url;
            row.appendChild(urlCell);

            const actionCell = document.createElement("td");
            const actionWrap = document.createElement("div");
            actionWrap.className = "table-actions";

            const deleteButton = document.createElement("button");
            deleteButton.type = "button";
            deleteButton.className = "danger";
            deleteButton.textContent = "删除";
            deleteButton.addEventListener("click", function () {
              deleteCookieById(cookie.id).catch(showError);
            });

            actionWrap.appendChild(deleteButton);
            actionCell.appendChild(actionWrap);
            row.appendChild(actionCell);

            tableBody.appendChild(row);
          });

          setStatus("列表已刷新。", false);
        } catch (error) {
          showError(error);
          throw error;
        }
      }

      async function createCookie(event) {
        event.preventDefault();

        const id = document.getElementById("createId").value.trim();
        const url = document.getElementById("createUrl").value.trim();
        let cookies;

        try {
          cookies = JSON.parse(document.getElementById("createCookies").value);
        } catch {
          setStatus("Cookies 必须是有效的 JSON 数组。", true);
          return;
        }

        const result = await requestJson("/send-cookies", {
          method: "POST",
          headers: adminHeaders(),
          body: JSON.stringify({ id: id, url: url, cookies: cookies }),
        });

        document.getElementById("createForm").reset();
        setStatus(result.message || "创建成功。", false);
        await loadCookies();
      }

      async function updateCookie(event) {
        event.preventDefault();

        const key = document.getElementById("updateId").value.trim();
        const url = document.getElementById("updateUrl").value.trim();
        let value;

        try {
          value = JSON.parse(document.getElementById("updateCookies").value);
        } catch {
          setStatus("Cookies 必须是有效的 JSON 数组。", true);
          return;
        }

        const result = await requestJson("/admin/update", {
          method: "PUT",
          headers: adminHeaders(),
          body: JSON.stringify({ key: key, value: value, url: url }),
        });

        document.getElementById("updateForm").reset();
        setStatus(result.message || "更新成功。", false);
        await loadCookies();
      }

      async function deleteCookie(event) {
        event.preventDefault();
        const key = document.getElementById("deleteId").value.trim();
        await deleteCookieById(key);
        document.getElementById("deleteForm").reset();
      }

      async function deleteCookieById(id) {
        if (!id) {
          setStatus("请输入要删除的 ID。", true);
          return;
        }

        if (!window.confirm("确定要删除 ID 为 " + id + " 的 Cookie 吗？")) {
          return;
        }

        const result = await requestJson("/admin/delete?key=" + encodeURIComponent(id), {
          method: "DELETE",
          headers: adminHeaders(),
        });

        setStatus(result.message || "删除成功。", false);
        await loadCookies();
      }

      function showError(error) {
        const message = error && error.message ? error.message : "请求失败";
        setStatus(message, true);
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
    headers: {
      "Content-Type": "application/json; charset=UTF-8",
    },
  });
}

function htmlResponse(body) {
  return createResponse(body, {
    status: 200,
    headers: {
      "Content-Type": "text/html; charset=UTF-8",
    },
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
