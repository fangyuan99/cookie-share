import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import type { AddressInfo } from "node:net";
import type { Server } from "node:http";
import { afterEach, beforeEach, describe, expect, test } from "vitest";
import { createApp } from "../src/app";
import { ENCRYPTION_VERSION, decryptPayload, encryptPayload } from "../src/crypto";
import { createDatabase } from "../src/db";
import { CookieStore } from "../src/store";
import type { RuntimeConfig } from "../src/types";

const sampleCookies = [
  {
    domain: "example.com",
    hostOnly: true,
    httpOnly: true,
    name: "session",
    path: "/",
    sameSite: "lax",
    secure: true,
    session: false,
    storeId: null,
    value: "token",
  },
];

async function readJson(response: Response): Promise<unknown> {
  const text = await response.text();
  return text ? JSON.parse(text) : null;
}

describe("cookie-share server", () => {
  let tempDir: string;
  let config: RuntimeConfig;
  let store: CookieStore;
  let server: Server;
  let baseUrl: string;

  beforeEach(async () => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "cookie-share-server-"));
    config = {
      host: "127.0.0.1",
      port: 3000,
      serverRoot: tempDir,
      dbPath: path.join(tempDir, "cookie-share.db"),
      pathSecret: "secret-path",
      basePath: "/secret-path",
      adminPassword: "admin-secret",
      transportSecret: "transport-secret",
    };

    store = new CookieStore(createDatabase(config));
    const app = createApp(config, store);
    server = await new Promise<Server>((resolve) => {
      const nextServer = app.listen(0, config.host, () => resolve(nextServer));
    });
    const address = server.address() as AddressInfo;
    baseUrl = `http://${config.host}:${address.port}`;
  });

  afterEach(async () => {
    await new Promise<void>((resolve, reject) => {
      server.close((error) => {
        if (error) {
          reject(error);
          return;
        }
        resolve();
      });
    });
    store.close();
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  async function postEncrypted(url: string, secret: string, payload: unknown, headers?: Record<string, string>): Promise<Response> {
    return fetch(baseUrl + url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(headers ?? {}),
      },
      body: JSON.stringify(encryptPayload(secret, payload)),
    });
  }

  async function putEncrypted(url: string, secret: string, payload: unknown, headers?: Record<string, string>): Promise<Response> {
    return fetch(baseUrl + url, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        ...(headers ?? {}),
      },
      body: JSON.stringify(encryptPayload(secret, payload)),
    });
  }

  test("stores and receives cookies with transport secret", async () => {
    const createResponse = await postEncrypted(`${config.basePath}/send-cookies`, config.transportSecret, {
      id: "abc123",
      url: "https://example.com/login",
      cookies: sampleCookies,
    });

    expect(createResponse.status).toBe(200);
    expect(decryptPayload(config.transportSecret, await readJson(createResponse))).toMatchObject({
      success: true,
      message: "Cookies saved successfully",
    });

    const receiveResponse = await fetch(`${baseUrl}${config.basePath}/receive-cookies/abc123`);
    expect(receiveResponse.status).toBe(200);
    expect(decryptPayload(config.transportSecret, await readJson(receiveResponse))).toMatchObject({
      success: true,
      cookies: sampleCookies,
    });
  });

  test("lists by host and deletes records on public endpoints", async () => {
    await postEncrypted(`${config.basePath}/send-cookies`, config.transportSecret, {
      id: "host1",
      url: "https://example.com/account",
      cookies: sampleCookies,
    });
    await postEncrypted(`${config.basePath}/send-cookies`, config.transportSecret, {
      id: "host2",
      url: "https://another.com/account",
      cookies: sampleCookies,
    });

    const listResponse = await fetch(`${baseUrl}${config.basePath}/list-cookies-by-host/example.com`);
    expect(listResponse.status).toBe(200);
    expect(decryptPayload(config.transportSecret, await readJson(listResponse))).toMatchObject({
      success: true,
      cookies: [{ id: "host1", url: "https://example.com/account" }],
    });

    const deleteResponse = await fetch(`${baseUrl}${config.basePath}/delete?key=host1`, {
      method: "DELETE",
    });
    expect(deleteResponse.status).toBe(200);
    expect(decryptPayload(config.transportSecret, await readJson(deleteResponse))).toMatchObject({
      success: true,
      message: "Data deleted successfully",
    });

    const receiveResponse = await fetch(`${baseUrl}${config.basePath}/receive-cookies/host1`);
    expect(receiveResponse.status).toBe(404);
    expect(decryptPayload(config.transportSecret, await readJson(receiveResponse))).toMatchObject({
      success: false,
      message: "Cookies not found",
    });
  });

  test("serves plain admin html and requires admin password for admin json", async () => {
    const htmlResponse = await fetch(`${baseUrl}${config.basePath}/admin`);
    expect(htmlResponse.status).toBe(200);
    expect(htmlResponse.headers.get("content-type")).toContain("text/html");
    expect(await htmlResponse.text()).toContain("Cookie Share Admin");

    const unauthorizedResponse = await fetch(`${baseUrl}${config.basePath}/admin/list-cookies`);
    expect(unauthorizedResponse.status).toBe(401);
    expect(decryptPayload(config.adminPassword, await readJson(unauthorizedResponse))).toMatchObject({
      success: false,
      message: "Unauthorized",
    });
  });

  test("supports admin create, update, list, export, import, and delete", async () => {
    const adminHeaders = { "X-Admin-Password": config.adminPassword };

    const createResponse = await postEncrypted(`${config.basePath}/admin/create`, config.adminPassword, {
      id: "admin1",
      url: "https://example.com/login",
      cookies: sampleCookies,
    }, adminHeaders);
    expect(createResponse.status).toBe(200);

    const listResponse = await fetch(`${baseUrl}${config.basePath}/admin/list-cookies`, {
      headers: adminHeaders,
    });
    const listPayload = decryptPayload(config.adminPassword, await readJson(listResponse)) as Record<string, unknown>;
    expect(listResponse.status).toBe(200);
    expect(Array.isArray(listPayload.cookies)).toBe(true);
    expect((listPayload.cookies as Array<Record<string, unknown>>)[0]?.id).toBe("admin1");

    const updateResponse = await putEncrypted(`${config.basePath}/admin/update`, config.adminPassword, {
      key: "admin1",
      url: "https://example.com/updated",
      value: sampleCookies,
    }, adminHeaders);
    expect(updateResponse.status).toBe(200);
    expect(decryptPayload(config.adminPassword, await readJson(updateResponse))).toMatchObject({
      success: true,
      message: "Cookies and URL updated successfully",
    });

    const exportResponse = await fetch(`${baseUrl}${config.basePath}/admin/export-all`, {
      headers: adminHeaders,
    });
    expect(exportResponse.status).toBe(200);
    const exportPayload = decryptPayload(config.adminPassword, await readJson(exportResponse)) as Record<string, unknown>;
    expect(exportPayload.version).toBe(ENCRYPTION_VERSION);
    expect(Array.isArray(exportPayload.records)).toBe(true);

    store.deleteCookieRecord("admin1");

    const importResponse = await postEncrypted(
      `${config.basePath}/admin/import-all`,
      config.adminPassword,
      exportPayload,
      adminHeaders,
    );
    expect(importResponse.status).toBe(200);
    expect(decryptPayload(config.adminPassword, await readJson(importResponse))).toMatchObject({
      success: true,
      imported: 1,
      total: 1,
    });

    const deleteResponse = await fetch(`${baseUrl}${config.basePath}/admin/delete?key=admin1`, {
      method: "DELETE",
      headers: adminHeaders,
    });
    expect(deleteResponse.status).toBe(200);
    expect(decryptPayload(config.adminPassword, await readJson(deleteResponse))).toMatchObject({
      success: true,
      message: "Data deleted successfully",
    });
  });

  test("rejects invalid envelopes and invalid payload values", async () => {
    const invalidEnvelopeResponse = await fetch(`${baseUrl}${config.basePath}/send-cookies`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ version: 1, foo: "bar" }),
    });
    expect(invalidEnvelopeResponse.status).toBe(400);
    expect(decryptPayload(config.transportSecret, await readJson(invalidEnvelopeResponse))).toMatchObject({
      success: false,
      message: "Invalid encrypted payload",
    });

    const invalidIdResponse = await postEncrypted(`${config.basePath}/send-cookies`, config.transportSecret, {
      id: "bad-id!",
      url: "https://example.com/login",
      cookies: sampleCookies,
    });
    expect(invalidIdResponse.status).toBe(400);
    expect(decryptPayload(config.transportSecret, await readJson(invalidIdResponse))).toMatchObject({
      success: false,
      message: "Invalid ID. Only letters and numbers are allowed.",
    });

    const invalidHostResponse = await fetch(`${baseUrl}${config.basePath}/list-cookies-by-host/%E0%A4%A`);
    expect(invalidHostResponse.status).toBe(400);
    expect(decryptPayload(config.transportSecret, await readJson(invalidHostResponse))).toMatchObject({
      success: false,
      message: "Invalid host",
    });

    const invalidCookieResponse = await postEncrypted(`${config.basePath}/send-cookies`, config.transportSecret, {
      id: "valid123",
      url: "https://example.com/login",
      cookies: [{ name: "session" }],
    });
    expect(invalidCookieResponse.status).toBe(400);
    expect(decryptPayload(config.transportSecret, await readJson(invalidCookieResponse))).toMatchObject({
      success: false,
      message: "Invalid cookie format",
    });
  });

  test("returns plain cors preflight", async () => {
    const response = await fetch(`${baseUrl}${config.basePath}/send-cookies`, {
      method: "OPTIONS",
    });
    expect(response.status).toBe(204);
    expect(await response.text()).toBe("");
    expect(response.headers.get("access-control-allow-headers")).toContain("X-Admin-Password");
  });
});
