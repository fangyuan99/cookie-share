# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Cookie-share enables cross-device cookie sharing via a Tampermonkey userscript and a self-hosted backend. Users send/receive browser cookies through a shared ID. Two backend options exist: a Cloudflare Worker (D1 database) and a Node.js server (built-in `node:sqlite`).

## Key Files

- `_worker.js` — Cloudflare Worker backend (single-file, plain JS, ~1500 lines). Contains routing, D1 database operations, PBKDF2/AES-GCM encryption, admin page HTML, and all API handlers. This is the primary backend.
- `tampermonkey/cookie-share.user.js` — Tampermonkey userscript (~2900 lines). The client-side script users install. Uses Shadow DOM for UI isolation, GM_* APIs for cookie access, and implements the same encryption protocol.
- `server/` — Alternative Node.js backend (TypeScript, Express, `node:sqlite`). Mirrors the Worker's API surface.
- `contract/vectors.json` — shared protocol fixtures consumed by both backends' test suites (see Testing below).

## Commands

### Cloudflare Worker (root directory)
```
npm run dev          # wrangler dev (local Worker)
npm test             # vitest run (integration + contract tests inside workerd)
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

## Testing

Two suites, both gated in CI on every PR:

- **Worker integration tests** (`test/worker.test.js`, config in `vitest.config.mjs`) — run inside workerd via `@cloudflare/vitest-pool-workers`. `SELF.fetch()` exercises the real fetch handler with a real D1 binding. Test secrets are injected as miniflare bindings in `vitest.config.mjs`; `TRANSPORT_SECRET` must equal `contract/vectors.json`'s `secret`. Storage is not isolated between tests — the shared `beforeEach` wipes `cookie_records`.
- **Server tests** (`server/test/*.test.ts`, config in `server/vitest.config.ts`) — spin up the Express app on an ephemeral port with a temp SQLite file.

**Contract vectors** (`contract/vectors.json`): shared fixtures — a fixed encrypted envelope both backends must decrypt, plus ID/URL/cookie validation cases and invalid-envelope cases. Both suites replay them, which is what keeps the two backends' protocol in sync. When the protocol or validation rules change intentionally, regenerate with `node contract/generate-vectors.mjs` and make sure **both** suites pass; a vector failing on one backend but not the other means the implementations have drifted.

## CI/CD

- `.github/workflows/ci.yml` — On every PR and push to `main`: Worker tests + `wrangler deploy --dry-run`, and server build + tests.
- `.github/workflows/release.yml` — Auto-creates a GitHub Release when `tampermonkey/cookie-share.user.js` is pushed to `main` with a new `@version`. Tag extracted from the userscript header.

## Development Workflow

- GitHub Flow: create short-lived branches off `main`, named `feat/*`, `fix/*`, `chore/*`, or `docs/*`.
- Features and fixes go through a PR to `main`. Both CI checks ("Worker tests + deploy dry-run" and "Node server build + tests") must pass; they are enforced by branch protection.
- Default merge strategy is **squash merge** (one commit per feature on `main`). Head branches are auto-deleted after merge.
- The maintainer may push directly to `main` only for docs/trivial changes; code changes always go through a PR.
- Abandoned branches: tag the tip as `archive/<name>`, then delete the branch.
- Use `gh` CLI for all GitHub operations (PRs, issues, releases).

## Commit & Branch Conventions

- Conventional Commits: `type(scope): subject`. Common scopes: `userscript`, `server`, `worker`. Types: `feat`, `fix`, `chore`, `docs`, `refactor`, `test`.
- Keep commits atomic — do not mix security fixes, features, and cleanup in one commit.
- Commit messages are written in English.
- Do NOT add AI co-author trailers (e.g. `Co-authored-by: Cursor`).
- Never force-push `main`; force-pushing your own feature branch is fine.

## Important Conventions

- The Worker admin page in `_worker.js` embeds its HTML inline using template literals with `${variable}` interpolation. The Node.js `server/src/admin-page.ts` uses string token replacement (`${devHint}`, `${JSON.stringify(basePath)}`, etc.) — when the template is a JS template literal, these tokens must be escaped as `\${...}`.
- Cookie IDs are alphanumeric only, max 64 chars (`/^[A-Za-z0-9]{1,64}$/`).
- All three secrets (`ADMIN_PASSWORD`, `PATH_SECRET`, `TRANSPORT_SECRET`) serve different purposes and must be distinct values.
- The encryption protocol (PBKDF2 iterations, AES-GCM params) must stay in sync across `_worker.js`, `server/src/crypto.ts`, and the userscript. Any intentional protocol change also requires regenerating `contract/vectors.json` (see Testing).
- When modifying the userscript (`tampermonkey/cookie-share.user.js`), always bump the `@version` in the UserScript header. The CI auto-creates a GitHub Release when a new version is pushed to main.
- Versioning: `update.md` tracks one project-wide version line in semver order. Backend-only changes still get a new version number (marked "backend only, no userscript release") but no git tag — tags/Releases exist only for userscript versions. Never number a new entry below an already-shipped version. Current line: userscript is at 0.6.1, changelog at 0.6.2, so the next release is 0.6.3+.
- For major changes, update both `README.md` (English) and `README_CN.md` (Chinese), and add an entry to `update.md`.
- Unless specifically asked, do not modify files under `server/` — the primary backend is `_worker.js`. Exception: when a protocol change requires it, keep `server/` in sync and prove it via the contract tests (`server/test/contract.test.ts`).
