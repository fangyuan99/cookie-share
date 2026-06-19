# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Cookie-share enables cross-device cookie sharing via a Tampermonkey userscript and a self-hosted backend. Users send/receive browser cookies through a shared ID. Two backend options exist: a Cloudflare Worker (D1 database) and a Node.js server (built-in `node:sqlite`).

## Key Files

- `_worker.js` — Cloudflare Worker backend (single-file, plain JS, ~1500 lines). Contains routing, D1 database operations, PBKDF2/AES-GCM encryption, admin page HTML, and all API handlers. This is the primary backend.
- `tampermonkey/cookie-share.user.js` — Tampermonkey userscript (~2900 lines). The client-side script users install. Uses Shadow DOM for UI isolation, GM_* APIs for cookie access, and implements the same encryption protocol.
- `server/` — Alternative Node.js backend (TypeScript, Express, `node:sqlite`). Mirrors the Worker's API surface.

## Commands

### Cloudflare Worker (root directory)
```
npm run dev          # wrangler dev (local Worker)
npm run check        # wrangler deploy --dry-run (validate without deploying)
npm run deploy       # wrangler deploy
npm run db:migrate   # apply D1 migrations remotely
```

Local dev uses `.dev.vars` for secrets (copy from `.dev.vars.example`). If missing, localhost auto-falls back to `PATH_SECRET=dev`, `ADMIN_PASSWORD=dev-password`, `TRANSPORT_SECRET=dev-transport-secret`.

### Node.js Server (`server/`)
```
cd server
npm install
npm run dev          # tsx watch src/index.ts
npm run build        # tsc -p tsconfig.json
npm start            # node dist/index.js
npm test             # vitest run
```

Requires Node.js 22.5.0+ (for `node:sqlite`). Uses `.env` for config (copy from `.env.example`).

## Architecture

### Dual Backend, Shared Protocol

Both backends implement identical API endpoints under `/{PATH_SECRET}/`. All JSON payloads (except the admin HTML page and CORS preflight) are encrypted using PBKDF2-derived AES-256-GCM with a shared secret. The envelope format: `{version, salt, iv, payload}` (all base64url-encoded).

Two encryption contexts exist:
- **Userscript endpoints** (`send-cookies`, `receive-cookies`, `list-cookies-by-host`, `delete`) use `TRANSPORT_SECRET`
- **Admin endpoints** (`/admin/*` JSON APIs) use `ADMIN_PASSWORD` for both auth (via `X-Admin-Password` header) and payload encryption

### _worker.js Structure

Single-file, no build step. Key sections in order:
1. Constants and crypto params (lines 1-11)
2. D1 schema auto-initialization with `ensureSchema()` (lazy, once per isolate)
3. `HttpError` class for structured error responses
4. `fetch()` entry point → `handleRequest()` router
5. Route handlers (`handleSendCookies`, `handleReceiveCookies`, etc.)
6. Database helpers (`upsertCookieRecord`, `getCookieRecord`, etc.)
7. Validation/normalization (`validateId`, `normalizeUrl`, `normalizeCookie`)
8. Crypto layer (`encryptPayload`, `decryptPayload`, `deriveAesKey`)
9. Inline admin page HTML (DaisyUI + Tailwind CSS) with embedded JS that mirrors the server-side crypto

### Userscript Structure

IIFE wrapping all logic. Key layers:
- `STORAGE_KEYS` constants for `GM_getValue`/`GM_setValue` persistence
- i18n system (EN/ZH) with `TRANSLATIONS` object
- Two themes: Claude (warm light) and Dark (luxury gold)
- Shadow DOM for complete style isolation from host pages
- Floating button with drag & edge docking
- Crypto functions matching the backend's PBKDF2/AES-GCM protocol
- `GM_xmlhttpRequest` for cross-origin API calls
- `GM_cookie` for HTTPOnly cookie access

### Node.js Server Structure

TypeScript with modular files:
- `app.ts` — Express app with route registration
- `crypto.ts` — encryption/decryption (same PBKDF2/AES-GCM protocol)
- `db.ts` — `node:sqlite` wrapper
- `store.ts` — CRUD operations on cookie records
- `admin-page.ts` — inline HTML template (DaisyUI + Tailwind CSS)
- `validation.ts` — input normalization matching `_worker.js` logic

## CI/CD

- `.github/workflows/release.yml` — Auto-creates a GitHub Release when `tampermonkey/cookie-share.user.js` is pushed to `main` with a new `@version`. Tag extracted from the userscript header.

## Git Workflow

Use `gh` CLI for all GitHub operations (PRs, issues, releases).

## Important Conventions

- The Worker admin page in `_worker.js` embeds its HTML inline using template literals with `${variable}` interpolation. The Node.js `server/src/admin-page.ts` uses string token replacement (`${devHint}`, `${JSON.stringify(basePath)}`, etc.) — when the template is a JS template literal, these tokens must be escaped as `\${...}`.
- Cookie IDs are alphanumeric only, max 64 chars (`/^[A-Za-z0-9]{1,64}$/`).
- All three secrets (`ADMIN_PASSWORD`, `PATH_SECRET`, `TRANSPORT_SECRET`) serve different purposes and must be distinct values.
- The encryption protocol (PBKDF2 iterations, AES-GCM params) must stay in sync across `_worker.js`, `server/src/crypto.ts`, and the userscript.
- When modifying the userscript (`tampermonkey/cookie-share.user.js`), always bump the `@version` in the UserScript header. The CI auto-creates a GitHub Release when a new version is pushed to main.
- For major changes, update both `README.md` (English) and `README_CN.md` (Chinese), and add an entry to `update.md`.
- Unless specifically asked, do not modify files under `server/` — the primary backend is `_worker.js`.
