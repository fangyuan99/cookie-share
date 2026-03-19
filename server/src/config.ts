import path from "node:path";
import dotenv from "dotenv";
import { HttpError } from "./errors";
import type { RuntimeConfig } from "./types";

const SERVER_ROOT = path.resolve(__dirname, "..");

dotenv.config({ path: path.join(SERVER_ROOT, ".env") });

function requireString(name: string): string {
  const value = process.env[name];
  if (!value || !value.trim()) {
    throw new HttpError(500, `Missing required environment variable: ${name}`, {
      success: false,
      error: `Missing required environment variable: ${name}`,
    }, { plain: true });
  }

  return value.trim();
}

function resolvePort(): number {
  const rawPort = process.env.PORT?.trim() ?? "3000";
  const port = Number(rawPort);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new HttpError(500, "Invalid PORT", {
      success: false,
      error: "Invalid PORT",
    }, { plain: true });
  }

  return port;
}

function resolveDbPath(rawPath: string): string {
  if (rawPath === ":memory:") {
    return rawPath;
  }

  return path.isAbsolute(rawPath) ? rawPath : path.resolve(SERVER_ROOT, rawPath);
}

export function loadRuntimeConfig(): RuntimeConfig {
  const pathSecret = requireString("PATH_SECRET");
  const dbPath = resolveDbPath(process.env.DB_PATH?.trim() ?? "./data/cookie_share.db");

  return {
    host: process.env.HOST?.trim() || "0.0.0.0",
    port: resolvePort(),
    serverRoot: SERVER_ROOT,
    dbPath,
    pathSecret,
    basePath: `/${pathSecret}`,
    adminPassword: requireString("ADMIN_PASSWORD"),
    transportSecret: requireString("TRANSPORT_SECRET"),
  };
}
