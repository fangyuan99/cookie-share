# Security and compatibility upgrade (0.7.0)

## Upgrade without resetting existing installations

Deploy the new Worker first, then update the userscript. **Do not change existing `PATH_SECRET`, `TRANSPORT_SECRET`, `ADMIN_PASSWORD`, D1 binding, or userscript storage keys just to upgrade.** New settings are optional. There is no bulk rewrite or deletion of old cookie records. The new `revision` column and supporting tables/indexes are initialized additively, including when an old D1 schema already exists. The existing migration remains valid; manual schema initialization is not required.

| Combination | Behavior |
| --- | --- |
| Old v0.6.3 client + new Worker, defaults | Existing v1 envelopes and endpoints continue to work, including legacy same-ID overwrite. |
| New client + old Worker/Node | Capability probe falls back to v1. Ordinary cookies remain supported. Old backends cannot preserve partition metadata; refuse instead of silently losing it. Saving unspecified SameSite as Lax requires explicit consent. |
| New client + new Worker, shared secret | Existing settings work; safer cookie replacement, metadata, and conditional writes are used. The existing shared secret is still an instance-wide credential. |
| New client + new Worker, device token | Uses authenticated v2 (HKDF + AES-GCM), record/operation restrictions, expiry and request replay rejection. No silent fallback to v1. |
| New client + updated Node server | v1 with additive cookie attributes/metadata. Device tokens, v2, D1 storage encryption and Worker admin sessions are Worker-only. |

Changes a user will notice: saved secrets/backend paths are no longer filled into page controls; configuration buttons use browser-native prompts without displaying the old secret. Normal configuration export omits credentials and backend addresses; use the separate encrypted backup option to migrate them. Existing Base64 configurations still import with a confirmation. The additional optional clipboard grant may require script-manager approval. Cookie replacement/overwrites now require confirmation and verified results; refresh is explicit rather than an unconditional 500 ms reload. The main Receive button now follows the local/cloud preference. Errors (including expired cookies) are surfaced instead of reported as success.

The existing administrator password can still authenticate old API clients. The new Worker management page upgrades an old localStorage password once, removes it from persistent storage and uses a 30-minute HttpOnly/SameSite=Strict session. Sessions on HTTPS also carry Secure. Refresh/reopening the page may require signing in again; this is intentional. New exports use a separate backup password, not the short-lived session key. Old export files remain importable with the administrator password used when they were created. Do not discard the old backup password after rotating credentials.

**No universal zero-regression guarantee is possible across browsers/script managers.** Automated compatibility and fault-injection tests are provided; the browser acceptance checklist below remains required before releasing. A Cookie API that ignores/rejects an attribute must now cause a failed verification, not a misleading success. Cookie expiry, server-side session rotation, device binding and non-cookie login state cannot be repaired by copying cookies.

## Optional per-device / per-record authorization

Set `DEVICE_TOKENS` as a Worker **secret**, containing a JSON array. Each token must be generated from at least 32 random bytes, encoded as unpadded base64url (43 characters for 32 bytes). Validation of token length cannot measure entropy; do not use repeated characters or human passwords. Example schema (replace the placeholder with a generated random token):

```json
[
  {
    "token": "<32-random-bytes-as-base64url>",
    "records": ["accountA", "accountB"],
    "permissions": ["read"],
    "expiresAt": "2027-01-01T00:00:00Z"
  }
]
```

`records: ["*"]` grants all record IDs. Permissions are independently `read`, `write`, `delete`. Omit expiry only for deliberately long-lived devices. The userscript manager menu has **Configure device token**; no shared transport secret is needed for that device. Generate separate tokens for different people/devices. Remove a token from the configured array to revoke it; changing `ADMIN_PASSWORD` does not revoke device tokens.

First provision and test all devices; only then set `REQUIRE_CLIENT_AUTH=true` to disable uncredentialed v1 client endpoints. **Enabling this flag intentionally blocks old clients.** Do not enable it during a compatibility-first rollout. A read-only sharing credential is not an administrator credential. Device mode rejects remote HTTP backends before sending a token. The server checks record restrictions on read/write/delete and filters host listings in SQL, rather than treating client-side filtering as authorization. A write-only token can create records but cannot discover revisions for an overwrite through the UI; use read+write for account-management devices.

`DISABLE_LEGACY_ADMIN=true` optionally disables raw `X-Admin-Password` API authentication after external admin tools are migrated. Never set it merely to upgrade an existing installation.

### Protocol v2

The device token authenticates the request in `Authorization: Bearer ...`; TLS is still required. Additional headers are `X-Cookie-Protocol: 2`, `X-Request-Id` (16+ random bytes as base64url), and `X-Request-Time` (Unix milliseconds, accepted within 5 minutes). AES-256-GCM uses a random 16-byte salt and 12-byte IV, HKDF-SHA256 with info `cookie-share/device-protocol/v2`. The AAD is the UTF-8 JSON of `{method,path,requestId,timestamp,direction}` in that field order, with direction `request` or `response`. The four envelope fields remain `{version,salt,iv,payload}`; v2's version is 2. Response contexts must match the request.

Mutating v2 requests consume their request ID in D1 before the mutation. Retrying the same ID returns 409; it does not silently replay the change. A network timeout therefore requires re-reading the record before deciding to submit another mutation. This is **at-most-once acceptance**, not cached idempotent result replay. GET uses bearer authentication/context binding but no replay nonce entry. Legacy v1 envelopes/PBKDF2 parameters are unchanged and cannot gain replay protection without changing old clients.

`createOnly: true` and `expectedRevision: n` are additive encrypted request-body fields. The revision predicate is evaluated atomically in the SQL write; a stale update cannot recreate a deleted record. The v1 compatibility path still allows the old unconditional upsert when these fields are absent.

## Optional application-layer encryption of D1 cookie payloads

Set `STORAGE_KEYS` to a secret JSON object mapping key IDs to base64url-encoded **32 random bytes**, and set `STORAGE_KEY_ID` to the active ID. Example shape (not actual keys):

```text
STORAGE_KEYS={"2026-09":"<32-random-bytes-as-base64url>"}
STORAGE_KEY_ID=2026-09
```

New/updated cookie payloads are encrypted with AES-GCM and bound to their record ID. Old plaintext JSON rows remain readable; enabling the option does not silently rewrite them. Keep historical keys while any old row or backup may require them. Missing keys cause explicit errors; there is no destructive fallback to empty cookies. Export/import through the authenticated admin page can migrate existing records: first download a verified backup, enable/test the storage key, then import the backup while writers are paused. Import replaces records by ID, so **do not use bulk import concurrently with active writers**. Versioned background re-encryption and per-record TTL are not implemented.

Rollback to an old Worker is safe only while storage encryption has never been enabled (or after restoring decrypted logical records into a separate old-compatible database). An old Worker cannot read encrypted storage rows. Preserve the new Worker, database backup and all keys before opting in. This encryption protects a database-only leak, **not** a compromised Worker/runtime administrator; it is not end-to-end encryption. Host, record ID, URL path and timestamps remain metadata outside the encrypted cookie payload.

## Resource protection and data minimization

Unknown paths return inexpensive plaintext errors instead of executing PBKDF2. JSON/HTML responses use `Cache-Control: no-store`, no-referrer and nosniff; the Worker admin page has a nonce CSP, blocks framing and loads no third-party scripts/styles. The Node page likewise removes the CDN dependency/password persistence, but retains v1 admin authentication.

New URL metadata is limited to 8,192 characters. The Worker caps encrypted requests at 8 MiB, cookies at 1,000 per record, a cookie name at 1,024 characters and a value at 16,384 characters; bulk imports at 10,000 records still share the byte limit. Serialized cookies per record are capped at 1,300,000 UTF-8 bytes, leaving room for optional encryption/base64 under D1's 2 MB row limit. D1's per-invocation query limits still apply to bulk imports. Split oversized backups; do not remove limits just to process untrusted input. The existing Node body limit is unchanged (2 MiB). New writes strip URL username/password/query/fragment. Previously persisted full URLs are not silently rewritten.

An optional `RATE_LIMITER` Worker binding is honored. Configure a Cloudflare rate-limit binding/WAF for enforcement across isolates. The built-in bounded fallback (600 requests/minute/IP; 30/minute on login) is **best effort, per isolate**, not global abuse protection. Shared NATs can affect multiple users. Default observability disables full invocation URL logs and traces; existing account/dashboard overrides and old logs must be reviewed separately. No secrets should appear in custom logs.

The admin UI pages metadata (50 rows), fetches cookie bodies on demand and uses a composite `(host, updated_at DESC, id ASC)` index for host lists. The userscript renders local and cloud sections independently, cancels stale list requests, yields during large local scans and deduplicates with a Map. Local storage still scans legacy keys; it is not a transactional indexed database or a virtualized list.

## Cookie replacement and trust boundary

Validation precedes deletion: source host (when supplied), cookie domain, name/path, expiry, Secure/SameSite, __Host-/__Secure- prefixes, duplicate identity and optional partition attributes. Host-only cookies are restored without a Domain attribute. Empty string values and unspecified SameSite are preserved on updated backends.

Every GM_cookie callback error rejects. The previous state is persisted under a separate `cookie_share_recovery_<host>` key before mutation. Writes/deletions are verified by re-reading values and attributes; rollback is independently verified. Failure to restore is reported explicitly and the recovery backup is retained. Use the userscript menu to restore it. Recovery snapshots, like pre-existing local records, live in the script manager's local storage; they are not an encrypted local vault and may contain live credentials. Clear them after recovery when no longer needed. A successful manual Clear intentionally retains its recovery snapshot.

GM_cookie has no cancellation API. On an operation timeout the outcome is uncertain: no success/automatic rollback claim is made, and the backup remains. Wait for browser activity to settle and inspect/recover manually. Web Locks serialize cookie mutations across tabs of the same origin when supported; a per-tab guard remains the fallback. These locks do **not** coordinate parent-domain cookies across different subdomain origins, nor prevent websites/background network responses from changing cookies. The app preserves the historical current-URL scope rather than broadly clearing all subdomains/paths.

Secrets are not auto-filled or exported into the host document. Closed Shadow DOM and `isTrusted` checks are defense in depth, **not extension-origin security isolation**. A hostile page can still spoof/overlay UI. Use the script only on trusted sites/profiles; a dedicated extension settings/storage UI would be a separate installation/architecture change and is not included here. Browser-native configuration prompts show newly typed text but never prefill the old secret.

## Validation and acceptance

Automated:

```sh
npm ci
npm run test:security       # Native Node tests, real JS + SQLite adapter + GM callback fault injection
npm test                   # Original workerd/D1 integration + contract tests, extended regressions
npm run check              # Wrangler dry run; does not deploy
cd server && npm ci && npm run build && npm test
```

The old fixed v1 encrypted contract fixture is retained verbatim; only intentionally minimized URL-metadata expectations change. No timing benchmark is claimed from unit tests.

Manual acceptance before release:

- Upgrade a v0.6.3 profile without clearing storage; test local and cloud save/receive/delete, both update orders, and old encrypted backup import.
- Test Tampermonkey on supported Chrome/Edge/Firefox/Safari combinations; verify host-only, HttpOnly, Secure, unspecified/Lax/Strict/None SameSite, paths, partitioned cookies, expired records, empty values and API permission refusal.
- Check synthetic page events cannot trigger privileged handlers; page DOM cannot read saved secrets; native menu configuration, keyboard navigation, dialogs, fullscreen, drag and copy remain usable.
- Test two tabs, intermittent network, denied writes/deletes, partial failure, quota failure, reload mid-operation and manual recovery; never accept a success message without verified state.
- Test admin login/logout/expiry, no-CDN/offline styling, pagination, overwrite conflicts and backup restoration after logout/password rotation.
- On an isolated staging deployment, test strict device permissions/revocation, clock skew/replay, optional at-rest encryption/key rotation and planned rollback. Never test destructive cases against production login sessions.

## Validation recorded for this change

The dependency-free suite includes 27 regression tests against real SQLite SQL and the actual Worker/userscript code with browser callback test doubles. Offline Chromium smoke checks verified self-contained admin styling, rejected synthetic shortcuts, trusted shortcut open/close, and the absence of saved secrets/backend paths in userscript input values. This is **not** a real Tampermonkey extension/cookie-permission matrix. The actual workerd and Node/TypeScript suites must also pass in CI before merging.
