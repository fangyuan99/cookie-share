import { HttpError } from "./errors";
import type {
  ImportRecord,
  NormalizedCookie,
  SameSiteValue,
  SendCookiesRequestBody,
  UpdateCookiesRequestBody,
} from "./types";

const ID_PATTERN = /^[A-Za-z0-9]{1,64}$/;
const SAME_SITE_VALUES = new Set<SameSiteValue>(["lax", "strict", "none"]);

function asRecord(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new HttpError(400, "Invalid payload", {
      success: false,
      message: "Invalid payload",
    });
  }

  return value as Record<string, unknown>;
}

export function validateId(value: unknown, message: string): string {
  if (typeof value !== "string" || !ID_PATTERN.test(value)) {
    throw new HttpError(400, message, { success: false, message });
  }

  return value;
}

export function normalizeUrl(value: unknown): string {
  if (typeof value !== "string" || !value.trim()) {
    throw new HttpError(400, "Invalid URL", { success: false, message: "Invalid URL" });
  }

  const trimmedValue = value.trim();
  const candidate = /^[a-zA-Z][a-zA-Z\d+\-.]*:\/\//.test(trimmedValue)
    ? trimmedValue
    : `https://${trimmedValue}`;

  try {
    return new URL(candidate).toString();
  } catch {
    throw new HttpError(400, "Invalid URL", { success: false, message: "Invalid URL" });
  }
}

export function extractHost(url: string): string {
  return new URL(url).hostname.toLowerCase();
}

export function normalizeHostParameter(value: unknown): string {
  if (typeof value !== "string" || !value) {
    throw new HttpError(400, "Invalid host", { success: false, message: "Invalid host" });
  }

  let decodedValue = value;
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

function invalidCookieError(): HttpError {
  return new HttpError(400, "Invalid cookie format", {
    success: false,
    message: "Invalid cookie format",
  });
}

function normalizeSameSite(value: unknown): SameSiteValue {
  if (typeof value !== "string" || !value.trim()) {
    throw invalidCookieError();
  }

  const normalizedValue = value.trim().toLowerCase() as SameSiteValue;
  if (!SAME_SITE_VALUES.has(normalizedValue)) {
    throw invalidCookieError();
  }

  return normalizedValue;
}

function normalizeCookie(cookie: unknown): NormalizedCookie {
  if (!cookie || typeof cookie !== "object" || Array.isArray(cookie)) {
    throw invalidCookieError();
  }

  const record = cookie as Record<string, unknown>;
  if (typeof record.name !== "string" || !record.name) {
    throw invalidCookieError();
  }

  if (typeof record.value !== "string") {
    throw invalidCookieError();
  }

  if (typeof record.domain !== "string" || !record.domain.trim()) {
    throw invalidCookieError();
  }

  if (typeof record.httpOnly !== "boolean" || typeof record.secure !== "boolean") {
    throw invalidCookieError();
  }

  const sameSite = normalizeSameSite(record.sameSite);
  const hasLeadingDot = record.domain.trim().startsWith(".");
  const expirationDate = record.expirationDate;
  const normalizedExpirationDate = expirationDate === undefined || expirationDate === null
    ? undefined
    : Number(expirationDate);

  if (normalizedExpirationDate !== undefined && !Number.isFinite(normalizedExpirationDate)) {
    throw invalidCookieError();
  }

  const normalizedCookie: NormalizedCookie = {
    domain: record.domain.trim().replace(/^\./, "").toLowerCase(),
    hostOnly: typeof record.hostOnly === "boolean" ? record.hostOnly : !hasLeadingDot,
    httpOnly: record.httpOnly,
    name: record.name,
    path: typeof record.path === "string" && record.path ? record.path : "/",
    sameSite,
    secure: record.secure,
    session: Boolean(record.session),
    storeId: null,
    value: record.value,
  };

  if (normalizedExpirationDate !== undefined) {
    normalizedCookie.expirationDate = normalizedExpirationDate;
  }

  return normalizedCookie;
}

export function normalizeCookies(value: unknown): NormalizedCookie[] {
  if (!Array.isArray(value)) {
    throw invalidCookieError();
  }

  return value.map((cookie) => normalizeCookie(cookie));
}

function normalizeTimestamp(value: unknown): string | null {
  if (typeof value !== "string" || !value.trim()) {
    return null;
  }

  const timestamp = new Date(value);
  return Number.isNaN(timestamp.getTime()) ? null : timestamp.toISOString();
}

export function normalizeSendCookiesBody(payload: unknown): SendCookiesRequestBody {
  const body = asRecord(payload);
  return {
    id: validateId(body.id, "Invalid ID. Only letters and numbers are allowed."),
    url: normalizeUrl(body.url),
    cookies: normalizeCookies(body.cookies),
  };
}

export function normalizeUpdateBody(payload: unknown): UpdateCookiesRequestBody {
  const body = asRecord(payload);
  const normalized: UpdateCookiesRequestBody = {
    key: validateId(body.key, "Invalid key. Only letters and numbers are allowed."),
    value: normalizeCookies(body.value),
  };

  if (typeof body.url === "string" && body.url.trim()) {
    normalized.url = normalizeUrl(body.url);
  }

  return normalized;
}

export function normalizeImportRecord(record: unknown): ImportRecord {
  const payload = asRecord(record);
  const url = normalizeUrl(payload.url);

  return {
    id: validateId(payload.id, "Invalid ID. Only letters and numbers are allowed."),
    url,
    host: extractHost(url),
    cookies: normalizeCookies(payload.cookies),
    createdAt: normalizeTimestamp(payload.createdAt),
    updatedAt: normalizeTimestamp(payload.updatedAt),
  };
}

export function normalizeImportBody(payload: unknown): { records: ImportRecord[] } {
  const body = asRecord(payload);
  if (!Array.isArray(body.records)) {
    throw new HttpError(400, "Invalid import payload", {
      success: false,
      message: "Invalid import payload",
    });
  }

  return {
    records: body.records.map((record) => normalizeImportRecord(record)),
  };
}
