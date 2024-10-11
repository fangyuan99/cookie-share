# Cookie-share Chrome/Edge Extension

*Note: For learning and communication purposes only. Strictly prohibited for commercial use. Please delete within 24 hours and do not share on social platforms. If this project is useful to you, please give it a star. It really helps me a lot, thank you!*

[English](./README.md) | [简体中文](./README_CN.md)

## Overview

Cookie-share is a Chrome extension that allows users to send and receive cookies between different devices or browsers. It can be used for multi-account switching, sharing video memberships, co-renting planets, and other scenarios. A self-hosted Cloudflare Worker ensures data security.

<img src="https://github.com/user-attachments/assets/a5c22aec-0532-449f-820a-409d62a48008" width="21.6%" height="21.6%" alt=""  style="margin-right: 10px;">
<img src="https://github.com/user-attachments/assets/309a4e2f-63f2-4ff1-a5c4-d8c9982c1840" width="50%" height="50%" alt="" >



[Download Link](https://github.com/fangyuan99/cookie-share/releases)

### Features and Use Cases
**Many websites do not support multi-account switching and you don't want to log out and log in again?**

**You have a video membership but your friends always find it cumbersome to scan a code?**

**You share a certain planet with classmates and want to recover health points?**

**Just too lazy to take out your phone or enter the password to switch device logins?**

1. Go to the homepage of a logged-in website (any URL that contains cookies)
2. Click the extension icon, customize an ID (only letters and numbers are supported), and send the cookie
3. On a device that is not logged in, visit the login page, use the previously set ID to retrieve the cookie, wait for the plugin to display that the cookie has been retrieved and set successfully, then refresh the page

Tested websites:
1. A certain planet
2. A certain art platform
3. A certain L site

## Features

- Generates random unique IDs for cookie sharing
- Sends cookies from the current tab to the server
- Receives and sets cookies to the current tab from the server
- Admin functionality for managing stored cookies
- Supports `HTTPOnly` cookies that JS cannot access due to higher plugin permissions

## Installation

1. Clone this repository or download the source code.
2. Open Chrome and navigate to `chrome://extensions/`.
3. Enable "Developer mode" in the top right corner.
4. Click "Load unpacked" and select the directory containing the extension files.

## Usage

### Plugin Usage
1. Enable Developer mode in Chrome/Edge browser ([Extensions page](chrome://extensions/))
2. Drag and drop the modified `cookie-share.zip` directly into the browser
3. Click the Cookie-share icon in the Chrome toolbar.
4. Send cookies from a logged-in browser page
5. Accept cookies on an unlogged browser page
6. Make sure not to add `/` at the end of the address, for example: `https://your-worker-name.your-subdomain.workers.dev`

### Backend Deployment Guide

Deployment can be similar to https://linux.do/t/topic/115004

1. [Register](https://dash.cloudflare.com/sign-up) a Cloudflare account and create a Worker.
2. Copy the content of `_worker.js` to the newly created Worker.
3. In the Cloudflare Worker settings, add the following environment variables:
   - `ADMIN_PASSWORD`: Set a strong password for accessing admin endpoints
   - `COOKIE_STORE`: Create a KV namespace for storing cookie data
4. Bind the KV namespace in the Worker settings:
   - Variable name: `COOKIE_STORE`
   - KV namespace: Select the KV namespace you created
5. Save and deploy the Worker.
6. Note the Worker URL, which is similar to: `https://your-worker-name.your-subdomain.workers.dev` (if blocked, please customize the domain)

## Security Considerations

- Ensure that `ADMIN_PASSWORD` is set to a strong password and change it regularly.
- Do not hard-code `ADMIN_PASSWORD` in the code, always use environment variables.
- Regularly review stored data and delete cookies that are no longer needed.
- Consider setting expiration times for cookie data to reduce the risk of storing sensitive information long-term.

## Backend (Cloudflare Worker)

The backend is implemented as a Cloudflare Worker, providing the following endpoints:

Remember to add `X-Admin-Password: yourpassword`

Example:

`/admin/list-cookies`

```sh
curl --location --request GET 'https://your-worker-name.your-subdomain.workers.dev/admin/list-cookies' \
--header 'X-Admin-Password: yourpassword'
```

`/admin/delete`

```sh
curl --location --request DELETE 'https://your-worker-name.your-subdomain.workers.dev/admin/delete?key={yourid}' \
--header 'X-Admin-Password: yourpassword'
```

- `POST /send-cookies`: Store cookies associated with a unique ID
- `GET /receive-cookies`: Retrieve cookies for a given ID
- `GET /admin/list-cookies`: List all stored cookie IDs and URLs
- `POST /admin/create`: Create new data entries
- `GET /admin/read`: Read data for a given key
- `PUT /admin/update`: Update data for a given key
- `DELETE /admin/delete`: Delete data for a given key
- `DELETE /admin/delete-all`: Delete all stored data
- `GET /admin/list`: List all stored data
- `GET /admin`: Access the admin management page

The admin management page provides a user-friendly interface for managing cookies and other data stored in the Worker. It includes features such as viewing all stored cookies, creating new cookie entries, updating existing cookies, and deleting individual cookies or all stored data.

To access the admin page, navigate to `https://your-worker-name.your-subdomain.workers.dev/admin` in your browser. You will be prompted to enter the admin password before accessing the management interface.

**Admin endpoints require authentication with the admin password.**

## File Structure

- `manifest.json`: Extension configuration file
- `popup.html`: HTML structure of the extension popup
- `popup.js`: JavaScript for handling user interactions and cookie operations
- `style.css`: CSS styles for the popup
- `_worker.js`: Cloudflare Worker script for backend operations

## Development

Modifying the extension:

1. Edit relevant files (`popup.html`, `popup.js`, `style.css`).
2. Reload the extension in Chrome to view changes.

Modifying the backend:

1. Edit the `_worker.js` file.
2. Deploy the updated Worker to Cloudflare.

## Security Considerations (Initial version not yet complete)

- The extension uses HTTPS for all communications with the backend.
- Admin endpoints are password-protected.
- Implement input validation to prevent injection attacks.
- Cookies are securely stored on the server and cannot be accessed without a unique ID.

## Future Development Plans

- Only admin interfaces are provided, no admin pages (unknown update time)

## Contributions

Welcome contributions! Feel free to submit Pull Requests.

## Star History

[![Star History Chart](https://api.star-history.com/svg?repos=fangyuan99/cookie-share&type=Date)](https://star-history.com/#fangyuan99/cookie-share&Date)

## License

MIT
