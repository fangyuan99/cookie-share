import crypto from "node:crypto";
import { HttpError } from "./errors";
import type { EncryptedEnvelope } from "./types";

export const ENCRYPTION_VERSION = 1;
export const PBKDF2_ITERATIONS = 100000;
const AES_KEY_LENGTH = 32;
const IV_LENGTH = 12;
const SALT_LENGTH = 16;
const AUTH_TAG_LENGTH = 16;

function base64UrlEncode(buffer: Uint8Array): string {
  return Buffer.from(buffer).toString("base64url");
}

function base64UrlDecode(value: string): Buffer {
  return Buffer.from(value, "base64url");
}

function deriveAesKey(secret: string, salt: Uint8Array): Buffer {
  return crypto.pbkdf2Sync(secret, Buffer.from(salt), PBKDF2_ITERATIONS, AES_KEY_LENGTH, "sha256");
}

export function isEncryptedEnvelope(value: unknown): value is EncryptedEnvelope {
  if (!value || typeof value !== "object") {
    return false;
  }

  const candidate = value as Record<string, unknown>;
  return (
    candidate.version === ENCRYPTION_VERSION &&
    typeof candidate.salt === "string" &&
    typeof candidate.iv === "string" &&
    typeof candidate.payload === "string"
  );
}

export function encryptPayload(secret: string, data: unknown): EncryptedEnvelope {
  const salt = crypto.randomBytes(SALT_LENGTH);
  const iv = crypto.randomBytes(IV_LENGTH);
  const key = deriveAesKey(secret, salt);
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  const plaintext = Buffer.from(JSON.stringify(data), "utf8");
  const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  const payload = Buffer.concat([ciphertext, cipher.getAuthTag()]);

  return {
    version: ENCRYPTION_VERSION,
    salt: base64UrlEncode(salt),
    iv: base64UrlEncode(iv),
    payload: base64UrlEncode(payload),
  };
}

export function decryptPayload(secret: string, envelope: unknown): unknown {
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
    const ciphertext = payload.subarray(0, payload.length - AUTH_TAG_LENGTH);
    const authTag = payload.subarray(payload.length - AUTH_TAG_LENGTH);
    const key = deriveAesKey(secret, salt);
    const decipher = crypto.createDecipheriv("aes-256-gcm", key, iv);
    decipher.setAuthTag(authTag);
    const plaintext = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
    return JSON.parse(plaintext.toString("utf8")) as unknown;
  } catch {
    throw new HttpError(400, "Transport secret mismatch or corrupted payload", {
      success: false,
      message: "Transport secret mismatch or corrupted payload",
    });
  }
}
