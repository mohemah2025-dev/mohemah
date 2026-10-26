-- Where a policy is shown: JSON array of registration | account | order | billing | application.
ALTER TABLE policies ADD COLUMN placements TEXT NOT NULL DEFAULT '["registration","account"]';

-- Notification sound (1 = play the notification sound on the phone).
ALTER TABLE notifications ADD COLUMN sound INTEGER NOT NULL DEFAULT 1;

-- WhatsApp (Meta WhatsApp Cloud API). The access token is the Worker secret WHATSAPP_TOKEN.
ALTER TABLE app_settings ADD COLUMN whatsapp_enabled INTEGER NOT NULL DEFAULT 0;
ALTER TABLE app_settings ADD COLUMN whatsapp_phone_id TEXT;
ALTER TABLE app_settings ADD COLUMN whatsapp_template TEXT;
ALTER TABLE app_settings ADD COLUMN whatsapp_lang TEXT DEFAULT 'ar';

-- Occasion discounts for providers: percent, free (100%) or a fixed amount, for everything or one service.
CREATE TABLE promotions (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  kind TEXT NOT NULL CHECK (kind IN ('percent','free','amount')),
  value REAL NOT NULL DEFAULT 0,
  scope TEXT NOT NULL DEFAULT 'all' CHECK (scope IN ('all','service')),
  service_id TEXT REFERENCES services(id) ON DELETE CASCADE,
  applies_to TEXT NOT NULL DEFAULT 'orders' CHECK (applies_to IN ('orders','subscriptions','topups','all')),
  starts_at TEXT NOT NULL,
  ends_at TEXT NOT NULL,
  active INTEGER NOT NULL DEFAULT 1,
  created_by TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX idx_promotions_active ON promotions(active, starts_at, ends_at);

-- Message log now also records WhatsApp.
CREATE TABLE message_log_new (
  id TEXT PRIMARY KEY,
  channel TEXT NOT NULL CHECK (channel IN ('sms','email','whatsapp')),
  recipient TEXT NOT NULL,
  subject TEXT,
  status TEXT NOT NULL,
  error TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
INSERT INTO message_log_new SELECT id, channel, recipient, subject, status, error, created_at FROM message_log;
DROP TABLE message_log;
ALTER TABLE message_log_new RENAME TO message_log;
CREATE INDEX idx_message_log_created ON message_log(created_at);
