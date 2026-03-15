CREATE TABLE IF NOT EXISTS cookie_records (
  id TEXT PRIMARY KEY,
  url TEXT NOT NULL,
  host TEXT NOT NULL,
  cookies_json TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_cookie_records_host
  ON cookie_records(host);

CREATE INDEX IF NOT EXISTS idx_cookie_records_updated_at
  ON cookie_records(updated_at DESC);
