-- Per-user admin permissions (JSON: {"section": "none" | "view" | "edit"}); NULL = default staff permissions.
ALTER TABLE users ADD COLUMN admin_permissions TEXT;

-- Online payments through a real gateway (Moyasar / Tap). Confirmed only after verifying with the gateway.
CREATE TABLE payments (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  gateway_id TEXT,
  provider_key TEXT NOT NULL,
  purpose TEXT NOT NULL CHECK (purpose IN ('topup','subscription')),
  coins INTEGER,
  months INTEGER,
  amount REAL NOT NULL,
  currency TEXT NOT NULL DEFAULT 'SAR',
  status TEXT NOT NULL DEFAULT 'initiated' CHECK (status IN ('initiated','processing','paid','failed')),
  external_id TEXT,
  error TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  paid_at TEXT
);
CREATE INDEX idx_payments_user ON payments(user_id, created_at);
CREATE INDEX idx_payments_external ON payments(external_id);

-- Price of one coin (before VAT) for online top-ups.
ALTER TABLE app_settings ADD COLUMN coin_price REAL NOT NULL DEFAULT 1;

-- SMS and e-mail settings (API keys are Worker secrets, never stored here).
ALTER TABLE app_settings ADD COLUMN sms_enabled INTEGER NOT NULL DEFAULT 0;
ALTER TABLE app_settings ADD COLUMN sms_provider TEXT;
ALTER TABLE app_settings ADD COLUMN sms_sender TEXT;
ALTER TABLE app_settings ADD COLUMN sms_username TEXT;
ALTER TABLE app_settings ADD COLUMN email_enabled INTEGER NOT NULL DEFAULT 0;
ALTER TABLE app_settings ADD COLUMN email_provider TEXT;
ALTER TABLE app_settings ADD COLUMN email_from TEXT;
ALTER TABLE app_settings ADD COLUMN email_from_name TEXT;

-- Sent SMS / e-mail log for the admin page.
CREATE TABLE message_log (
  id TEXT PRIMARY KEY,
  channel TEXT NOT NULL CHECK (channel IN ('sms','email')),
  recipient TEXT NOT NULL,
  subject TEXT,
  status TEXT NOT NULL,
  error TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX idx_message_log_created ON message_log(created_at);
