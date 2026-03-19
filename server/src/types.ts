export type SameSiteValue = "lax" | "strict" | "none";

export interface RuntimeConfig {
  host: string;
  port: number;
  serverRoot: string;
  dbPath: string;
  pathSecret: string;
  basePath: string;
  adminPassword: string;
  transportSecret: string;
}

export interface NormalizedCookie {
  domain: string;
  expirationDate?: number;
  hostOnly: boolean;
  httpOnly: boolean;
  name: string;
  path: string;
  sameSite: SameSiteValue;
  secure: boolean;
  session: boolean;
  storeId: null;
  value: string;
}

export interface CookieRecord {
  id: string;
  url: string;
  host: string;
  cookies: NormalizedCookie[];
  createdAt: string;
  updatedAt: string;
}

export interface CookieSummary {
  id: string;
  url: string;
}

export interface AdminCookieRecord extends CookieRecord {
  cookiesJson: string;
}

export interface ImportRecord {
  id: string;
  url: string;
  host: string;
  cookies: NormalizedCookie[];
  createdAt: string | null;
  updatedAt: string | null;
}

export interface EncryptedEnvelope {
  version: number;
  salt: string;
  iv: string;
  payload: string;
}

export interface SuccessPayload {
  success?: boolean;
  message?: string;
  [key: string]: unknown;
}

export interface ErrorPayload {
  success: false;
  message?: string;
  error?: string;
  [key: string]: unknown;
}

export interface SendCookiesRequestBody {
  id: string;
  url: string;
  cookies: NormalizedCookie[];
}

export interface UpdateCookiesRequestBody {
  key: string;
  url?: string;
  value: NormalizedCookie[];
}

export interface ImportAllRequestBody {
  records: ImportRecord[];
}
