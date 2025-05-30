-- Migration number: 0001 	 2025-05-29T23:43:57.811Z
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,           -- Spotify user ID
  access_token TEXT NOT NULL,
  refresh_token TEXT NOT NULL,
  expires_at INTEGER NOT NULL,   -- UNIX timestamp
  api_key TEXT NOT NULL          -- Secure token used in /add
);