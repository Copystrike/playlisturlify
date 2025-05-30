-- Migration number: 0002 	 2025-05-30T16:31:53.476Z
CREATE TABLE sessions (
  id TEXT PRIMARY KEY,           -- Random session ID
  user_id TEXT NOT NULL,         -- Associated user ID
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
);