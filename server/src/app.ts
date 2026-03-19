import crypto from "node:crypto";
import type { ErrorRequestHandler, NextFunction, Request, RequestHandler, Response } from "express";
import express from "express";
import { renderAdminPage } from "./admin-page";
import { ENCRYPTION_VERSION, decryptPayload } from "./crypto";
import { HttpError } from "./errors";
import { sendCorsPreflight, sendEncryptedJson, sendHtml, sendJson } from "./http";
import { CookieStore } from "./store";
import type { ErrorPayload, RuntimeConfig } from "./types";
import {
  normalizeHostParameter,
  normalizeImportBody,
  normalizeSendCookiesBody,
  normalizeUpdateBody,
  validateId,
} from "./validation";

function timingSafeEqual(left: string, right: string): boolean {
  const leftBuffer = Buffer.from(left, "utf8");
  const rightBuffer = Buffer.from(right, "utf8");
  if (leftBuffer.length !== rightBuffer.length) {
    return false;
  }

  return crypto.timingSafeEqual(leftBuffer, rightBuffer);
}

function resolveRouteSecret(pathname: string, config: RuntimeConfig): string {
  if (pathname.startsWith(`${config.basePath}/admin/`)) {
    return config.adminPassword;
  }

  return config.transportSecret;
}

function isEncryptedRoute(request: Request, config: RuntimeConfig): boolean {
  return !(request.method === "GET" && request.path === `${config.basePath}/admin`) && request.method !== "OPTIONS";
}

function readEncryptedRequestBody(request: Request, secret: string): unknown {
  const bodyText = typeof request.body === "string" ? request.body : "";
  if (!bodyText) {
    throw new HttpError(400, "Invalid encrypted payload", {
      success: false,
      message: "Invalid encrypted payload",
    });
  }

  let envelope: unknown;
  try {
    envelope = JSON.parse(bodyText) as unknown;
  } catch {
    throw new HttpError(400, "Invalid encrypted payload", {
      success: false,
      message: "Invalid encrypted payload",
    });
  }

  return decryptPayload(secret, envelope);
}

function ensureAdminPassword(request: Request, config: RuntimeConfig): void {
  const providedPassword = request.header("X-Admin-Password");
  if (!providedPassword || !timingSafeEqual(providedPassword, config.adminPassword)) {
    throw new HttpError(401, "Unauthorized", {
      success: false,
      message: "Unauthorized",
    });
  }
}

function handleRoute(handler: (request: Request, response: Response, next: NextFunction) => Promise<void> | void): RequestHandler {
  return (request: Request, response: Response, next: NextFunction) => {
    Promise.resolve(handler(request, response, next)).catch(next);
  };
}

function buildError(error: unknown): HttpError {
  if (error instanceof HttpError) {
    return error;
  }

  if (error && typeof error === "object") {
    const candidate = error as { status?: unknown; message?: unknown };
    if (typeof candidate.status === "number" && typeof candidate.message === "string") {
      const message = candidate.status === 400 && candidate.message.includes("Failed to decode param")
        ? "Invalid host"
        : candidate.message;
      return new HttpError(candidate.status, candidate.message, {
        success: false,
        message,
      });
    }
  }

  console.error("Unhandled server error", error);
  return new HttpError(500, "Internal Server Error", {
    success: false,
    error: error instanceof Error ? error.message : "Internal Server Error",
  });
}

export function createApp(config: RuntimeConfig, store: CookieStore): express.Express {
  store.ensureSchema();

  const app = express();
  app.disable("x-powered-by");
  app.use(express.text({ type: "*/*", limit: "2mb" }));

  app.use((request, response, next) => {
    if (request.method === "OPTIONS") {
      sendCorsPreflight(response);
      return;
    }
    next();
  });

  app.get(`${config.basePath}/admin`, (_request, response) => {
    sendHtml(response, renderAdminPage(config.basePath));
  });

  app.use(`${config.basePath}/admin`, (request, _response, next) => {
    if (request.path === "/" || request.path === "") {
      next();
      return;
    }

    ensureAdminPassword(request, config);
    next();
  });

  app.post(`${config.basePath}/send-cookies`, handleRoute((request, response) => {
    const body = normalizeSendCookiesBody(readEncryptedRequestBody(request, config.transportSecret));
    store.upsertCookieRecord({
      id: body.id,
      url: body.url,
      host: new URL(body.url).hostname.toLowerCase(),
      cookies: body.cookies,
    });
    sendEncryptedJson(response, 200, {
      success: true,
      message: "Cookies saved successfully",
    }, config.transportSecret);
  }));

  app.get(`${config.basePath}/receive-cookies/:id`, handleRoute((request, response) => {
    const id = validateId(request.params.id, "Invalid cookie ID");
    const record = store.getCookieRecord(id);
    if (!record) {
      sendEncryptedJson(response, 404, {
        success: false,
        message: "Cookies not found",
      }, config.transportSecret);
      return;
    }

    sendEncryptedJson(response, 200, {
      success: true,
      cookies: record.cookies,
    }, config.transportSecret);
  }));

  app.get(`${config.basePath}/list-cookies-by-host/:host`, handleRoute((request, response) => {
    const host = normalizeHostParameter(request.params.host);
    sendEncryptedJson(response, 200, {
      success: true,
      cookies: store.listCookieRecordsByHost(host),
    }, config.transportSecret);
  }));

  app.delete(`${config.basePath}/delete`, handleRoute((request, response) => {
    const key = validateId(request.query.key, "Invalid key. Only letters and numbers are allowed.");
    store.deleteCookieRecord(key);
    sendEncryptedJson(response, 200, {
      success: true,
      message: "Data deleted successfully",
    }, config.transportSecret);
  }));

  app.get(`${config.basePath}/admin/list-cookies`, handleRoute((_request, response) => {
    sendEncryptedJson(response, 200, {
      success: true,
      cookies: store.listCookieRecordsWithPayload(),
    }, config.adminPassword);
  }));

  app.get(`${config.basePath}/admin/list-cookies-by-host/:host`, handleRoute((request, response) => {
    const host = normalizeHostParameter(request.params.host);
    sendEncryptedJson(response, 200, {
      success: true,
      cookies: store.listCookieRecordsByHost(host),
    }, config.adminPassword);
  }));

  app.post(`${config.basePath}/admin/create`, handleRoute((request, response) => {
    const body = normalizeSendCookiesBody(readEncryptedRequestBody(request, config.adminPassword));
    store.upsertCookieRecord({
      id: body.id,
      url: body.url,
      host: new URL(body.url).hostname.toLowerCase(),
      cookies: body.cookies,
    });
    sendEncryptedJson(response, 200, {
      success: true,
      message: "Cookies saved successfully",
    }, config.adminPassword);
  }));

  app.put(`${config.basePath}/admin/update`, handleRoute((request, response) => {
    const body = normalizeUpdateBody(readEncryptedRequestBody(request, config.adminPassword));
    const existingRecord = store.getCookieRecord(body.key);
    if (!existingRecord) {
      sendEncryptedJson(response, 404, {
        success: false,
        message: "Cookie not found",
      }, config.adminPassword);
      return;
    }

    const nextUrl = body.url ?? existingRecord.url;
    store.upsertCookieRecord({
      id: body.key,
      url: nextUrl,
      host: new URL(nextUrl).hostname.toLowerCase(),
      cookies: body.value,
    });
    sendEncryptedJson(response, 200, {
      success: true,
      message: "Cookies and URL updated successfully",
    }, config.adminPassword);
  }));

  app.delete(`${config.basePath}/admin/delete`, handleRoute((request, response) => {
    const key = validateId(request.query.key, "Invalid key. Only letters and numbers are allowed.");
    store.deleteCookieRecord(key);
    sendEncryptedJson(response, 200, {
      success: true,
      message: "Data deleted successfully",
    }, config.adminPassword);
  }));

  app.get(`${config.basePath}/admin/export-all`, handleRoute((_request, response) => {
    sendEncryptedJson(response, 200, {
      version: ENCRYPTION_VERSION,
      exportedAt: new Date().toISOString(),
      records: store.listCookieRecordsWithPayload().map((record) => ({
        id: record.id,
        url: record.url,
        host: record.host,
        cookies: record.cookies,
        createdAt: record.createdAt,
        updatedAt: record.updatedAt,
      })),
    }, config.adminPassword);
  }));

  app.post(`${config.basePath}/admin/import-all`, handleRoute((request, response) => {
    const body = normalizeImportBody(readEncryptedRequestBody(request, config.adminPassword));
    store.upsertCookieRecords(body.records);
    sendEncryptedJson(response, 200, {
      success: true,
      message: "Import completed",
      total: body.records.length,
      imported: body.records.length,
    }, config.adminPassword);
  }));

  app.use((_request, _response, next) => {
    next(new HttpError(404, "Not Found", {
      success: false,
      message: "Not Found",
    }));
  });

  const errorHandler: ErrorRequestHandler = (error, request, response, next) => {
    if (response.headersSent) {
      next(error);
      return;
    }

    const httpError = buildError(error);
    const payload: ErrorPayload = httpError.payload ?? { success: false, message: httpError.message };

    if (!isEncryptedRoute(request, config) || httpError.plain) {
      sendJson(response, httpError.status, payload);
      return;
    }

    sendEncryptedJson(response, httpError.status, payload, resolveRouteSecret(request.path, config));
  };

  app.use(errorHandler);

  return app;
}
