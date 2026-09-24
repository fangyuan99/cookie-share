// Integration tests for _worker.js, run inside workerd via
// @cloudflare/vitest-pool-workers. SELF is the Worker under test; requests go
// through the real fetch handler with a real (isolated) D1 binding.
import { env, SELF } from "cloudflare:test";
import { beforeEach, describe, expect, it } from "vitest";
import vectors from "../contract/vectors.json";

const PATH_SECRET = "test-path-secret";
const ADMIN_PASSWORD = "test-admin-password";
const TRANSPORT_SECRET = vectors.secret;
const BASE = `https://cookie-share.test/${PATH_SECRET}`;

const ENCRYPTION_VERSION = 1;
const PBKDF2_ITERATIONS = 100000;
const encoder = new TextEncoder();
const decoder = new TextDecoder();

// --- crypto helpers mirroring the protocol (kept independent of _worker.js
// internals so the tests fail if the Worker drifts from the protocol) ---

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

async function deriveAesKey(secret, salt) {
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    "PBKDF2",
    false,
    ["deriveKey"]
  );
  return await crypto.subtle.deriveKey(
    { name: "PBKDF2", hash: "SHA-256", salt, iterations: PBKDF2_ITERATIONS },
    keyMaterial,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"]
  );
}

async function encrypt(secret, data) {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await deriveAesKey(secret, salt);
  const ciphertext = new Uint8Array(
    await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, encoder.encode(JSON.stringify(data)))
  );
  return {
    version: ENCRYPTION_VERSION,
    salt: base64UrlEncode(salt),
    iv: base64UrlEncode(iv),
    payload: base64UrlEncode(ciphertext),
  };
}

async function decrypt(secret, envelope) {
  expect(envelope).toMatchObject({
    version: ENCRYPTION_VERSION,
    salt: expect.any(String),
    iv: expect.any(String),
    payload: expect.any(String),
  });
  const key = await deriveAesKey(secret, base64UrlDecode(envelope.salt));
  const plaintext = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: base64UrlDecode(envelope.iv) },
    key,
    base64UrlDecode(envelope.payload)
  );
  return JSON.parse(decoder.decode(plaintext));
}

async function decryptResponse(secret, response) {
  return await decrypt(secret, await response.json());
}

async function request(path, { method = "GET", secret, body, headers = {} } = {}) {
  const init = { method, headers: { "Content-Type": "application/json", ...headers } };
  if (body !== undefined) {
    init.body = JSON.stringify(secret ? await encrypt(secret, body) : body);
  }
  return await SELF.fetch(BASE + path, init);
}

function adminHeaders() {
  return { "X-Admin-Password": ADMIN_PASSWORD };
}

const sampleCookies = [
  {
    name: "session",
    value: "token",
    domain: "example.com",
    httpOnly: true,
    secure: true,
    sameSite: "lax",
  },
];

async function sendCookies(id, url = "https://example.com/login", cookies = sampleCookies) {
  return await request("/send-cookies", {
    method: "POST",
    secret: TRANSPORT_SECRET,
    body: { id, url, cookies },
  });
}

beforeEach(async () => {
  // Create the schema directly on the binding (the Worker's own ensureSchema
  // runs once per isolate) and wipe rows so tests never see each other's data.
  await env.COOKIE_DB.prepare(
    `CREATE TABLE IF NOT EXISTS cookie_records (
      id TEXT PRIMARY KEY,
      url TEXT NOT NULL,
      host TEXT NOT NULL,
      cookies_json TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    )`
  ).run();
  await env.COOKIE_DB.prepare("DELETE FROM cookie_records").run();
});

describe("userscript endpoints (TRANSPORT_SECRET)", () => {
  it("stores and receives cookies end-to-end", async () => {
    const sendResponse = await sendCookies("abc123");
    expect(sendResponse.status).toBe(200);
    expect(await decryptResponse(TRANSPORT_SECRET, sendResponse)).toMatchObject({
      success: true,
      message: "Cookies saved successfully",
    });

    const receiveResponse = await request("/receive-cookies/abc123");
    expect(receiveResponse.status).toBe(200);
    const received = await decryptResponse(TRANSPORT_SECRET, receiveResponse);
    expect(received.success).toBe(true);
    expect(received.cookies).toHaveLength(1);
    expect(received.cookies[0]).toMatchObject({
      name: "session",
      value: "token",
      domain: "example.com",
      path: "/",
      sameSite: "lax",
    });
  });

  it("returns encrypted 404 for unknown cookie id", async () => {
    const response = await request("/receive-cookies/missing1");
    expect(response.status).toBe(404);
    expect(await decryptResponse(TRANSPORT_SECRET, response)).toMatchObject({
      success: false,
      message: "Cookies not found",
    });
  });

  it("lists cookie ids by host", async () => {
    await sendCookies("hostA1", "https://example.com/a");
    await sendCookies("hostB1", "https://another.com/b");

    const response = await request("/list-cookies-by-host/example.com");
    expect(response.status).toBe(200);
    expect(await decryptResponse(TRANSPORT_SECRET, response)).toMatchObject({
      success: true,
      cookies: [{ id: "hostA1", url: "https://example.com/a" }],
    });
  });

  it("rejects invalid host parameter", async () => {
    const response = await request("/list-cookies-by-host/%E0%A4%A");
    expect(response.status).toBe(400);
    expect(await decryptResponse(TRANSPORT_SECRET, response)).toMatchObject({
      success: false,
      message: "Invalid host",
    });
  });

  it("public delete requires an encrypted body proving the transport secret", async () => {
    await sendCookies("todelete1");

    const plainDelete = await request("/delete?key=todelete1", { method: "DELETE" });
    expect(plainDelete.status).toBe(400);

    const wrongSecretDelete = await request("/delete", {
      method: "DELETE",
      secret: "wrong-secret",
      body: { key: "todelete1" },
    });
    expect(wrongSecretDelete.status).toBe(400);
    expect(await decryptResponse(TRANSPORT_SECRET, wrongSecretDelete)).toMatchObject({
      success: false,
      message: "Transport secret mismatch or corrupted payload",
    });

    const validDelete = await request("/delete", {
      method: "DELETE",
      secret: TRANSPORT_SECRET,
      body: { key: "todelete1" },
    });
    expect(validDelete.status).toBe(200);

    const receiveResponse = await request("/receive-cookies/todelete1");
    expect(receiveResponse.status).toBe(404);
  });
});

describe("admin endpoints (ADMIN_PASSWORD)", () => {
  it("rejects missing and wrong admin passwords (plain unauthenticated rejection)", async () => {
    const missing = await request("/admin/list-cookies");
    expect(missing.status).toBe(401);
    expect(await missing.json()).toMatchObject({
      success: false,
      message: "Unauthorized",
    });

    const wrong = await request("/admin/list-cookies", {
      headers: { "X-Admin-Password": "nope" },
    });
    expect(wrong.status).toBe(401);
  });

  it("supports create, list, update, delete", async () => {
    const createResponse = await request("/admin/create", {
      method: "POST",
      secret: ADMIN_PASSWORD,
      headers: adminHeaders(),
      body: { id: "admin1", url: "https://example.com/login", cookies: sampleCookies },
    });
    expect(createResponse.status).toBe(200);

    const listResponse = await request("/admin/list-cookies", { headers: adminHeaders() });
    expect(listResponse.status).toBe(200);
    const listPayload = await decryptResponse(ADMIN_PASSWORD, listResponse);
    expect(listPayload.cookies).toHaveLength(1);
    expect(listPayload.cookies[0]).toMatchObject({
      id: "admin1",
      url: "https://example.com/login",
      host: "example.com",
    });

    const updateResponse = await request("/admin/update", {
      method: "PUT",
      secret: ADMIN_PASSWORD,
      headers: adminHeaders(),
      body: { key: "admin1", url: "https://example.com/updated", value: sampleCookies },
    });
    expect(updateResponse.status).toBe(200);
    expect(await decryptResponse(ADMIN_PASSWORD, updateResponse)).toMatchObject({
      success: true,
      message: "Cookies and URL updated successfully",
    });

    const deleteResponse = await request("/admin/delete?key=admin1", {
      method: "DELETE",
      headers: adminHeaders(),
    });
    expect(deleteResponse.status).toBe(200);

    const afterDelete = await decryptResponse(
      ADMIN_PASSWORD,
      await request("/admin/list-cookies", { headers: adminHeaders() })
    );
    expect(afterDelete.cookies).toHaveLength(0);
  });

  it("updating a missing record returns 404", async () => {
    const response = await request("/admin/update", {
      method: "PUT",
      secret: ADMIN_PASSWORD,
      headers: adminHeaders(),
      body: { key: "nothere1", value: sampleCookies },
    });
    expect(response.status).toBe(404);
    expect(await decryptResponse(ADMIN_PASSWORD, response)).toMatchObject({
      success: false,
      message: "Cookie not found",
    });
  });

  it("export/import roundtrip preserves records", async () => {
    await sendCookies("export1");

    const exportResponse = await request("/admin/export-all", { headers: adminHeaders() });
    expect(exportResponse.status).toBe(200);
    const exported = await decryptResponse(ADMIN_PASSWORD, exportResponse);
    expect(exported.records).toHaveLength(1);

    await request("/admin/delete?key=export1", { method: "DELETE", headers: adminHeaders() });

    const importResponse = await request("/admin/import-all", {
      method: "POST",
      secret: ADMIN_PASSWORD,
      headers: adminHeaders(),
      body: exported,
    });
    expect(importResponse.status).toBe(200);
    expect(await decryptResponse(ADMIN_PASSWORD, importResponse)).toMatchObject({
      success: true,
      imported: 1,
      total: 1,
    });

    const receiveResponse = await request("/receive-cookies/export1");
    expect(receiveResponse.status).toBe(200);
  });

  it("serves the admin page as plain html", async () => {
    const response = await request("/admin");
    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toContain("text/html");
    expect(await response.text()).toContain("Cookie Share Admin");
  });
});

describe("routing and CORS", () => {
  it("answers OPTIONS preflight with 204 and CORS headers", async () => {
    const response = await request("/send-cookies", { method: "OPTIONS" });
    expect(response.status).toBe(204);
    expect(response.headers.get("Access-Control-Allow-Origin")).toBe("*");
    expect(response.headers.get("Access-Control-Allow-Headers")).toContain("X-Admin-Password");
  });

  it("returns cheap plain 404 outside the path secret", async () => {
    const response = await SELF.fetch("https://cookie-share.test/wrong-path/send-cookies", {
      method: "POST",
      body: "{}",
    });
    expect(response.status).toBe(404);
    expect(await response.json()).toMatchObject({
      success: false,
      message: "Not Found",
    });
  });

  it("returns plain 404 for unknown routes under the base path", async () => {
    const response = await request("/nonexistent");
    expect(response.status).toBe(404);
  });
});

describe("protocol contract vectors", () => {
  it("decrypts the reference envelope and applies documented normalization", async () => {
    const sendResponse = await request("/send-cookies", {
      method: "POST",
      body: vectors.send.envelope,
    });
    expect(sendResponse.status).toBe(200);

    const listResponse = await request("/admin/list-cookies", { headers: adminHeaders() });
    const listPayload = await decryptResponse(ADMIN_PASSWORD, listResponse);
    expect(listPayload.cookies).toHaveLength(1);
    expect(listPayload.cookies[0]).toMatchObject({
      id: vectors.send.expected.id,
      url: vectors.send.expected.url,
      host: vectors.send.expected.host,
    });

    const receiveResponse = await request(`/receive-cookies/${vectors.send.expected.id}`);
    const received = await decryptResponse(TRANSPORT_SECRET, receiveResponse);
    expect(received.cookies[0]).toEqual(vectors.send.expected.cookie);
  });

  it("rejects every invalid envelope fixture", async () => {
    for (const envelope of vectors.invalidEnvelopes) {
      const response = await request("/send-cookies", { method: "POST", body: envelope });
      expect(response.status).toBe(400);
      expect(await decryptResponse(TRANSPORT_SECRET, response)).toMatchObject({
        success: false,
        message: "Invalid encrypted payload",
      });
    }
  });

  it("accepts every valid id fixture", async () => {
    for (const id of vectors.ids.valid) {
      const response = await sendCookies(id);
      expect(response.status, `id: ${JSON.stringify(id)}`).toBe(200);
    }
  });

  it("rejects every invalid id fixture", async () => {
    for (const id of vectors.ids.invalid) {
      const response = await sendCookies(id);
      expect(response.status, `id: ${JSON.stringify(id)}`).toBe(400);
      expect(await decryptResponse(TRANSPORT_SECRET, response)).toMatchObject({
        success: false,
        message: "Invalid ID. Only letters and numbers are allowed.",
      });
    }
  });

  it("normalizes every valid url fixture", async () => {
    for (const [index, urlCase] of vectors.urls.valid.entries()) {
      const id = `urlcase${index}`;
      const sendResponse = await sendCookies(id, urlCase.input);
      expect(sendResponse.status, `url: ${JSON.stringify(urlCase.input)}`).toBe(200);

      const listResponse = await request(`/list-cookies-by-host/${encodeURIComponent(urlCase.host)}`);
      const listPayload = await decryptResponse(TRANSPORT_SECRET, listResponse);
      expect(
        listPayload.cookies.find((record) => record.id === id),
        `url: ${JSON.stringify(urlCase.input)}`
      ).toMatchObject({ url: urlCase.normalized });
    }
  });

  it("rejects every invalid url fixture", async () => {
    for (const url of vectors.urls.invalid) {
      const response = await sendCookies("urlinvalid1", url);
      expect(response.status, `url: ${JSON.stringify(url)}`).toBe(400);
      expect(await decryptResponse(TRANSPORT_SECRET, response)).toMatchObject({
        success: false,
        message: "Invalid URL",
      });
    }
  });

  it("rejects every invalid cookie fixture", async () => {
    for (const cookie of vectors.cookies.invalid) {
      const response = await sendCookies("cookieinvalid1", "https://example.com/", [cookie]);
      expect(response.status, `cookie: ${JSON.stringify(cookie)}`).toBe(400);
      expect(await decryptResponse(TRANSPORT_SECRET, response)).toMatchObject({
        success: false,
        message: "Invalid cookie format",
      });
    }
  });
});

describe('backward-compatible hardening', () => {
  it('supports atomic conditional writes without changing legacy upserts', async () => {
    await sendCookies('conditional1');
    const create = await request('/send-cookies', { method: 'POST', secret: TRANSPORT_SECRET,
      body: { id: 'conditional1', url: 'https://example.com/', cookies: sampleCookies, createOnly: true } });
    expect(create.status).toBe(409);
    const stale = await request('/send-cookies', { method: 'POST', secret: TRANSPORT_SECRET,
      body: { id: 'conditional1', url: 'https://example.com/', cookies: sampleCookies, expectedRevision: 99 } });
    expect(stale.status).toBe(409);
    const update = await request('/send-cookies', { method: 'POST', secret: TRANSPORT_SECRET,
      body: { id: 'conditional1', url: 'https://example.com/', cookies: sampleCookies, expectedRevision: 1 } });
    expect(update.status).toBe(200);
  });
  it('lists admin metadata without fetching cookie payloads', async () => {
    await sendCookies('summary1');
    const response = await request('/admin/list-cookies?summary=1&limit=1', { headers: adminHeaders() });
    const payload = await decryptResponse(ADMIN_PASSWORD, response);
    expect(payload.cookies).toHaveLength(1);
    expect(payload.cookies[0].cookies).toBeUndefined();
    expect(payload.cookies[0].cookiesJson).toBeUndefined();
    expect(payload.cookies[0].revision).toBe(1);
  });
  it('returns no-store and a self-contained nonce-protected management page', async () => {
    const response = await request('/admin');
    const html = await response.text();
    expect(response.headers.get('Cache-Control')).toBe('no-store');
    expect(response.headers.get('Content-Security-Policy')).toContain("frame-ancestors 'none'");
    expect(html).not.toContain('jsdelivr');
    expect(html).not.toContain('localStorage.setItem(PASSWORD_KEY');
  });
  it('preserves unspecified SameSite, empty values and partition attributes', async () => {
    const cookie = { ...sampleCookies[0], value: '', sameSite: 'unspecified',
      partitionKey: { topLevelSite: 'https://example.com', hasCrossSiteAncestor: false } };
    expect((await sendCookies('attributes1', 'https://example.com/', [cookie])).status).toBe(200);
    const payload = await decryptResponse(TRANSPORT_SECRET, await request('/receive-cookies/attributes1'));
    expect(payload.cookies[0]).toMatchObject(cookie);
  });
});
