import type { DatabaseSync } from "node:sqlite";
import { HttpError } from "./errors";
import { SCHEMA_STATEMENTS } from "./schema";
import type { AdminCookieRecord, CookieRecord, CookieSummary, ImportRecord, NormalizedCookie } from "./types";
import { validateId } from "./validation";

interface CookieRecordRow {
  id: string;
  url: string;
  host: string;
  cookies_json: string;
  created_at: string;
  updated_at: string;
}

interface CookieSummaryRow {
  id: string;
  url: string;
}

function parseStoredCookies(rawCookies: string, recordId: string): NormalizedCookie[] {
  try {
    const parsed = JSON.parse(rawCookies) as unknown;
    if (!Array.isArray(parsed)) {
      throw new Error("cookies_json is not an array");
    }

    return parsed as NormalizedCookie[];
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

export class CookieStore {
  private readonly database: DatabaseSync;

  public constructor(database: DatabaseSync) {
    this.database = database;
  }

  public ensureSchema(): void {
    for (const statement of SCHEMA_STATEMENTS) {
      this.database.prepare(statement).run();
    }
  }

  public upsertCookieRecord(record: {
    id: string;
    url: string;
    host: string;
    cookies: NormalizedCookie[];
    createdAt?: string | null;
    updatedAt?: string | null;
  }): void {
    const now = new Date().toISOString();
    this.database.prepare(
      `INSERT INTO cookie_records (id, url, host, cookies_json, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET
         url = excluded.url,
         host = excluded.host,
         cookies_json = excluded.cookies_json,
         updated_at = excluded.updated_at`,
    ).run(
      record.id,
      record.url,
      record.host,
      JSON.stringify(record.cookies),
      record.createdAt ?? now,
      record.updatedAt ?? now,
    );
  }

  public upsertCookieRecords(records: ImportRecord[]): void {
    for (const record of records) {
      this.upsertCookieRecord(record);
    }
  }

  public getCookieRecord(id: string): CookieRecord | null {
    const row = this.database.prepare(
      `SELECT id, url, host, cookies_json, created_at, updated_at
       FROM cookie_records
       WHERE id = ?`,
    ).get(id) as unknown as CookieRecordRow | undefined;

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

  public listCookieRecords(): CookieSummary[] {
    const rows = this.database.prepare(
      "SELECT id, url FROM cookie_records ORDER BY updated_at DESC",
    ).all() as unknown as CookieSummaryRow[];

    return rows.map((row) => ({ id: row.id, url: row.url }));
  }

  public listCookieRecordsByHost(host: string): CookieSummary[] {
    const rows = this.database.prepare(
      "SELECT id, url FROM cookie_records WHERE host = ? ORDER BY updated_at DESC",
    ).all(host) as unknown as CookieSummaryRow[];

    return rows.map((row) => ({ id: row.id, url: row.url }));
  }

  public listCookieRecordsWithPayload(): AdminCookieRecord[] {
    const rows = this.database.prepare(
      `SELECT id, url, host, cookies_json, created_at, updated_at
       FROM cookie_records
       ORDER BY updated_at DESC`,
    ).all() as unknown as CookieRecordRow[];

    return rows.map((row) => {
      const cookies = parseStoredCookies(row.cookies_json, row.id);
      return {
        id: row.id,
        url: row.url,
        host: row.host,
        cookies,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
        cookiesJson: JSON.stringify(cookies, null, 2),
      };
    });
  }

  public deleteCookieRecord(id: string): void {
    const normalizedId = validateId(id, "Invalid key. Only letters and numbers are allowed.");
    this.database.prepare("DELETE FROM cookie_records WHERE id = ?").run(normalizedId);
  }

  public close(): void {
    this.database[Symbol.dispose]();
  }
}
