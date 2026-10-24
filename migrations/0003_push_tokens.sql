-- Device tokens for push notifications (Firebase Cloud Messaging, Android + iOS).
CREATE TABLE IF NOT EXISTS push_tokens (
  token TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  app TEXT NOT NULL CHECK (app IN ('customer','provider')),
  platform TEXT NOT NULL DEFAULT 'android' CHECK (platform IN ('android','ios')),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX IF NOT EXISTS idx_push_tokens_user ON push_tokens(user_id, app);
