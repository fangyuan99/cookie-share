// Generates contract/vectors.json — the shared protocol fixtures that both
// backends (_worker.js and server/) must satisfy. Run with:
//   node contract/generate-vectors.mjs
// Regenerate only when the protocol itself changes (PBKDF2 params, envelope
// format, validation rules). The envelope below is produced by this reference
// implementation; both backends must be able to decrypt it byte-for-byte.
import { writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ENCRYPTION_VERSION = 1;
const PBKDF2_ITERATIONS = 100000;
const AES_KEY_LENGTH = 256;
const IV_LENGTH = 12;
const SALT_LENGTH = 16;
const encoder = new TextEncoder();

function base64UrlEncode(bytes) {
  return Buffer.from(bytes).toString("base64url");
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
    { name: "AES-GCM", length: AES_KEY_LENGTH },
    false,
    ["encrypt", "decrypt"]
  );
}

async function encryptPayload(secret, data) {
  const salt = crypto.getRandomValues(new Uint8Array(SALT_LENGTH));
  const iv = crypto.getRandomValues(new Uint8Array(IV_LENGTH));
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

const transportSecret = "contract-transport-secret";

// A valid send-cookies request body exercising the normalization rules:
// scheme-less mixed-case URL, dotted mixed-case cookie domain, missing path,
// mixed-case sameSite, numeric expirationDate.
const sendPlaintext = {
  id: "contractVector1",
  url: "Example.com/Login?next=%2Fhome",
  cookies: [
    {
      name: "session",
      value: "token-value",
      domain: ".Example.com",
      httpOnly: true,
      secure: true,
      sameSite: "Lax",
      expirationDate: 1893456000,
    },
  ],
};

const expectedCookie = {
  domain: "example.com",
  expirationDate: 1893456000,
  hostOnly: false,
  httpOnly: true,
  name: "session",
  path: "/",
  sameSite: "lax",
  secure: true,
  session: false,
  storeId: null,
  value: "token-value",
};

const vectors = {
  description:
    "Cross-implementation contract fixtures for the cookie-share protocol. Both _worker.js and server/ must pass every case. Regenerate with: node contract/generate-vectors.mjs",
  secret: transportSecret,
  send: {
    envelope: await encryptPayload(transportSecret, sendPlaintext),
    plaintext: sendPlaintext,
    expected: {
      id: "contractVector1",
      url: "https://example.com/Login",
      host: "example.com",
      cookie: expectedCookie,
    },
  },
  invalidEnvelopes: [
    {},
    { version: 2, salt: "AAAA", iv: "AAAA", payload: "AAAA" },
    { version: 1, salt: "AAAA", iv: "AAAA" },
    { version: 1, salt: 1, iv: "AAAA", payload: "AAAA" },
    "not-an-object",
  ],
  ids: {
    valid: ["a", "ABC123xyz", "Z".repeat(64)],
    invalid: ["", "bad-id!", "with space", "a".repeat(65), "under_score"],
  },
  urls: {
    valid: [
      { input: "Example.com/Login?next=%2Fhome", normalized: "https://example.com/Login", host: "example.com" },
      { input: "  https://Sub.Example.com:8443/x?q=1  ", normalized: "https://sub.example.com:8443/x", host: "sub.example.com" },
      { input: "example.com", normalized: "https://example.com/", host: "example.com" },
    ],
    invalid: ["", "   ", "http://", "https://exa mple.com"],
  },
  cookies: {
    invalid: [
      { name: "session" },
      { name: "", value: "v", domain: "example.com", httpOnly: true, secure: true, sameSite: "lax" },
      { name: "n", value: "v", domain: "  ", httpOnly: true, secure: true, sameSite: "lax" },
      { name: "n", value: "v", domain: "example.com", httpOnly: "yes", secure: true, sameSite: "lax" },
      { name: "n", value: "v", domain: "example.com", httpOnly: true, secure: true, sameSite: "sometimes" },
      { name: "n", value: "v", domain: "example.com", httpOnly: true, secure: true, sameSite: "lax", expirationDate: "not-a-number" },
    ],
  },
};

const outPath = join(dirname(fileURLToPath(import.meta.url)), "vectors.json");
writeFileSync(outPath, JSON.stringify(vectors, null, 2) + "\n");
console.log(`Wrote ${outPath}`);
