-- Establishment / company of providers who are not Saudi, Kuwaiti, Emirati, Qatari or Bahraini.
ALTER TABLE users ADD COLUMN company_name TEXT;
-- Last time the administration opened the provider's profile (clears the «has notes» counter).
ALTER TABLE users ADD COLUMN perf_reviewed_at TEXT;

-- Password / account recovery codes sent by SMS or e-mail (hash only, 15 minutes).
CREATE TABLE password_resets (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  code_hash TEXT NOT NULL,
  channel TEXT NOT NULL,
  attempts INTEGER NOT NULL DEFAULT 0,
  expires_at TEXT NOT NULL,
  used_at TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX idx_password_resets_user ON password_resets(user_id, created_at);
