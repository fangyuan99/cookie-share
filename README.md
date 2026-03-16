# Cookie-share Tampermonkey Script

*Note: For learning and communication purposes only. Commercial use is strictly prohibited. Please delete within 24 hours. Distribution on social platforms is forbidden. If you find this project helpful, please give it a star. It helps a lot, thank you!*

[![GitHub Stars](https://img.shields.io/github/stars/fangyuan99/cookie-share?style=social)](https://github.com/fangyuan99/cookie-share)
![JavaScript](https://img.shields.io/badge/JavaScript-F7DF1E?style=flat-square&logo=javascript&logoColor=black) ![Node.js](https://img.shields.io/badge/Node.js-339933?style=flat-square&logo=node.js&logoColor=white) ![Cloudflare Workers](https://img.shields.io/badge/Cloudflare_Workers-F38020?style=flat-square&logo=cloudflare&logoColor=white) ![Tampermonkey](https://img.shields.io/badge/Tampermonkey-333333?style=flat-square&logo=tampermonkey&logoColor=white)

**If you have questions, please check [issues](https://github.com/fangyuan99/cookie-share/issues) | [discussions](https://github.com/fangyuan99/cookie-share/discussions) first.**

[English](./README.md) | [简体中文](./README_CN.md) | [Update Log](./update.md)

---

## Overview

Cookie-share is a Tampermonkey script that allows users to send and receive cookies between different devices or browsers. It can be used for **multiple account switching, video membership sharing, community subscription sharing**, and other scenarios. The backend uses self-hosted Cloudflare Worker or Node.js server to ensure data security.

![image](./images/cs1.png)

---

![image](./images/cs2.png)

---



[Tampermonkey Script One-Click Install](https://github.com/fangyuan99/cookie-share/raw/refs/heads/main/tampermonkey/cookie-share.user.js)

### Effects and Use Cases
**Many websites don't support multiple account switching, don't want to log out and log in again?**

**Have a video membership subscription, tired of scanning QR codes for friends?**

**Joined a community platform, want to share costs with classmates?**

**Simply too lazy to take out your phone or enter passwords when switching devices?**

1. Go to the homepage of a logged-in website (any address with cookies works)
2. Use the Tampermonkey menu command, customize an ID (only letters and numbers supported), then send the cookie
3. On devices without login, visit the login page, use the ID you just created to get cookies, wait for the script to show successful cookie retrieval and setup, then refresh the page

Tested websites:
1. Certain community platforms
2. Certain video platforms
3. Certain L sites

## Features

- Generate random unique IDs for cookie sharing
- Send cookies from current tab to server
- Receive and set cookies from server to current tab
- Save cookies locally without backend (added in v0.1.0)
- Manage cookies with Cookie List (local and cloud data)
- Admin features for managing stored cookies
- Can support `HTTPOnly` cookies that ordinary page JS cannot access
- Dual theme support: Claude (warm light) and Dark (luxury gold) with one-click switching (added in v0.4.0)

## Usage Instructions

### Tampermonkey Script Usage

1. Install [Tampermonkey](https://www.crxsoso.com/webstore/detail/dhdgffkkebhmkfjojejmpbldmpobfkfo) or other script managers
2. [One-Click Install](https://github.com/fangyuan99/cookie-share/raw/refs/heads/main/tampermonkey/cookie-share.user.js)
3. If you encounter cookie permission issues, please enable it in Tampermonkey settings
![tm](./images/tm.png)
1. Send Cookie from logged-in browser page
2. Accept Cookie on non-logged-in browser page
3. Note: Don't add `/` after the address, example: `https://your-worker-name.your-subdomain.workers.dev/{PATH_SECRET}`
4. If you use a Cloudflare Worker backend, the userscript only needs `Transport Secret`. `send/receive`, cloud list, and cloud delete all use `TRANSPORT_SECRET`
5. Management panel access `https://your-worker-name.your-subdomain.workers.dev/{PATH_SECRET}/admin`

### Local Use Without Backend

As of v0.1.0, Cookie-share now supports local storage functionality. This means you can use the script without setting up a backend server:

- Enable the "Save to local" checkbox to store cookies locally
- The Cookie List now distinguishes between local and cloud data
- Perfect for personal use on a single device or when privacy is a top concern

For sharing cookies between different devices or browsers, you'll still need to set up a backend as described below.

### Backend Deployment Guide


#### Option 1: Cloudflare Worker + D1 (Recommended)

[![Deploy to Cloudflare Workers](https://deploy.workers.cloudflare.com/button)](https://deploy.workers.cloudflare.com/?url=https://github.com/fangyuan99/cookie-share&env=ADMIN_PASSWORD&env=PATH_SECRET&env=TRANSPORT_SECRET&d1=COOKIE_DB)

Deploy to Cloudflare (one click):

1. Click the Deploy button above and authorize Cloudflare
2. Fill in `ADMIN_PASSWORD`, `PATH_SECRET`, and `TRANSPORT_SECRET` in the deploy form
3. Complete deployment. Cloudflare will automatically create and bind the D1 database as `COOKIE_DB`
4. No manual KV or D1 setup is required. The Worker will create the required tables automatically on the first storage request
5. Use `https://your-worker-domain/{PATH_SECRET}` as the backend address in the userscript

Deploy locally with Wrangler:

1. Install dependencies with `npm install`
2. Run `npx wrangler login`
3. Copy `.dev.vars.example` to `.dev.vars` for local development
   - If `.dev.vars` is missing, `wrangler dev` falls back to `PATH_SECRET=dev`, `ADMIN_PASSWORD=dev-password`, and `TRANSPORT_SECRET=dev-transport-secret` on localhost only
4. Before production deploy, set remote secrets:
   - `npx wrangler secret put ADMIN_PASSWORD`
   - `npx wrangler secret put PATH_SECRET`
   - `npx wrangler secret put TRANSPORT_SECRET`
5. Deploy with `npm run deploy`
6. Optional: run `npm run db:migrate` after the first deploy if you want Wrangler-managed migration metadata applied immediately

The repository now declares the D1 binding in [wrangler.jsonc](./wrangler.jsonc), so Cloudflare can provision and bind the database automatically during deployment.

If you need higher performance or more control over data storage, you can deploy a standalone Node.js server:


#### Option 2: Node.js Server

*Note: Self-hosted servers may be attacked and other security issues, please take your own risk!*

1. [Clone](https://github.com/fangyuan99/cookie-share-server) cookie-share-server repository
2. Use `npm install` to install dependencies
3. Create `.env` file with the following variables:

   - `PORT`: Server port (default: 3000)
   - `ADMIN_PASSWORD`: Set a strong password for admin access
   - `PATH_SECRET`: Set a strong string to prevent brute force attacks
   - `DB_PATH`: Path to SQLite database file (default: ./data/cookie_share.db)
4. Start the server with `npm start`
5. Access the server at `http://your-server-ip:port/{PATH_SECRET}`

The Node.js server implementation offers these advantages:
- Cookie encryption for enhanced security
- Persistent SQLite database storage
- No request limits or storage quotas
- Self-hosted with complete control over your data

## Security Considerations

- Ensure `ADMIN_PASSWORD` is set to a strong password and changed regularly
- Ensure `TRANSPORT_SECRET` is long and random, and rotate it independently from the admin password
- Don't hardcode `ADMIN_PASSWORD` in code, always use environment variables
- Don't reuse `ADMIN_PASSWORD` as the transport encryption secret
- Regularly review stored data in D1 and delete unnecessary cookie data
- Consider setting expiration times for cookie data to reduce risk of storing sensitive information long-term
- Use `PATH_SECRET` in worker config to prevent brute force attacks
- Set complex project names and disable built-in workers.dev domain

## Backend API Endpoints

**If `/{PATH_SECRET}/admin/*` endpoints have issues, verify that `X-Admin-Password` is present and that `ADMIN_PASSWORD` and `PATH_SECRET` are configured correctly**

Both backend implementations provide the following endpoints:

Note:
- `GET /{PATH_SECRET}/admin` is plain HTML
- `OPTIONS` remains plain CORS preflight
- Userscript JSON endpoints use an encrypted envelope based on `TRANSPORT_SECRET`
- Admin page JSON endpoints use `ADMIN_PASSWORD` for both authentication and client-side encryption
- The userscript and admin page handle encryption automatically; plain `curl` examples are no longer sufficient unless you implement the matching client-side encryption

Available endpoints:
- `POST /{PATH_SECRET}/send-cookies`: Store cookies associated with unique ID
- `GET /{PATH_SECRET}/receive-cookies/{id}`: Receive cookies for a given ID
- `GET /{PATH_SECRET}/list-cookies-by-host/{host}`: Userscript cloud list endpoint
- `DELETE /{PATH_SECRET}/delete?key={id}`: Userscript cloud delete endpoint
- `GET /{PATH_SECRET}/admin`: Open the admin UI shell
- `GET /{PATH_SECRET}/admin/list-cookies`: List all stored cookie IDs and URLs
- `GET /{PATH_SECRET}/admin/list-cookies-by-host`: List cookies filtered by hostname
- `POST /{PATH_SECRET}/admin/create`: Create a record from the admin page
- `DELETE /{PATH_SECRET}/admin/delete`: Delete data for given key
- `PUT /{PATH_SECRET}/admin/update`: Update data for given key
- `GET /{PATH_SECRET}/admin/export-all`: Export all records as encrypted JSON
- `POST /{PATH_SECRET}/admin/import-all`: Import encrypted JSON and upsert records by ID
- `OPTIONS /{PATH_SECRET}/`: Handle CORS preflight requests

Admin management page provides a user-friendly interface for managing cookies and other data. It includes viewing all stored cookies, creating new cookie entries, updating existing cookies, and deleting individual cookie records.

To access the admin page, navigate to `https://your-backend-address/{PATH_SECRET}/admin` in the browser. The page itself is directly reachable, and the admin page only requires `ADMIN_PASSWORD`. The userscript only requires `TRANSPORT_SECRET`.

**All `/admin/*` API endpoints require authentication using the admin password.**

## File Structure

- `tampermonkey/cookie-share.user.js`: Tampermonkey script
- `_worker.js`: Cloudflare Worker script for backend operations
- `wrangler.jsonc`: Cloudflare Worker and D1 configuration
- `migrations/0001_init.sql`: Initial D1 schema
- `.dev.vars.example`: Example local development variables
- `package.json`: Wrangler helper scripts

## Development

Modifying script:

1. Edit `tampermonkey/cookie-share.user.js`
2. Reinstall or refresh the script in Tampermonkey to verify changes

Modifying backend:

1. For Cloudflare Worker: Edit `_worker.js`, validate with `npm run check`, and deploy with `npm run deploy`
2. Optional: run `npm run db:migrate` after the Worker exists if you want to apply the tracked SQL migration explicitly
3. For Node.js server: Edit files in the cookie-share-server repository

## Smoke Checklist

- Deploy through the Cloudflare button and confirm the D1 database is created and bound automatically
- Run `POST /send-cookies -> GET /receive-cookies/{id} -> GET /admin/list-cookies -> GET /admin/list-cookies-by-host/{host} -> PUT /admin/update -> DELETE /admin/delete -> GET /admin/export-all -> POST /admin/import-all`
- Verify that userscript cloud actions fail clearly when `TRANSPORT_SECRET` is missing or incorrect
- Verify invalid IDs, missing keys, invalid URLs, malformed cookie payloads, and wrong admin passwords all return the expected 4xx responses
- Open `/{PATH_SECRET}/admin` and confirm the Pico CSS admin page can refresh, delete, export, and import correctly
- Confirm the userscript still shows combined local/cloud data and no longer crashes on an empty list state

## Contributions

[aBER0724 (aBER)](https://github.com/aBER0724) - Contributed initial Tampermonkey script version

Contributions welcome! Feel free to submit Pull Requests.

## Star History

[![Star History Chart](https://api.star-history.com/svg?repos=fangyuan99/cookie-share&type=Date)](https://star-history.com/#fangyuan99/cookie-share&Date)

## License

MIT
