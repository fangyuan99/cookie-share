# Cookie-share Server

Embedded TypeScript Node.js backend for Cookie-share.

Requires Node.js `22.5.0+` because the server uses the built-in `node:sqlite` module instead of a native addon.

## Development

```bash
npm install
copy .env.example .env
npm run dev
```

## Production

```bash
npm install
copy .env.example .env
npm run build
npm start
```

## Environment Variables

- `PORT`: HTTP port, default `3000`
- `HOST`: Listen address, default `0.0.0.0`
- `PATH_SECRET`: Required path prefix secret
- `ADMIN_PASSWORD`: Required admin API password
- `TRANSPORT_SECRET`: Required transport encryption secret
- `DB_PATH`: SQLite path, default `./data/cookie_share.db`
