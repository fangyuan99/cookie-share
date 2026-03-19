import type { Response } from "express";
import { encryptPayload } from "./crypto";

export const CORS_METHODS = "GET, POST, PUT, DELETE, OPTIONS";
export const CORS_HEADERS = "Content-Type, X-Admin-Password";

export function applyCorsHeaders(response: Response): void {
  response.setHeader("Access-Control-Allow-Origin", "*");
  response.setHeader("Access-Control-Allow-Methods", CORS_METHODS);
  response.setHeader("Access-Control-Allow-Headers", CORS_HEADERS);
}

export function sendJson(response: Response, status: number, body: unknown): void {
  applyCorsHeaders(response);
  response.status(status).type("application/json; charset=UTF-8").send(JSON.stringify(body));
}

export function sendHtml(response: Response, html: string): void {
  applyCorsHeaders(response);
  response.status(200).type("text/html; charset=UTF-8").send(html);
}

export function sendEncryptedJson(response: Response, status: number, body: unknown, secret: string): void {
  sendJson(response, status, encryptPayload(secret, body));
}

export function sendCorsPreflight(response: Response): void {
  applyCorsHeaders(response);
  response.status(204).end();
}
