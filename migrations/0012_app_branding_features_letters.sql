-- Logo used by the mobile apps only (the admin panel keeps logo_url).
ALTER TABLE app_settings ADD COLUMN app_logo_url TEXT;
UPDATE app_settings SET app_logo_url = logo_url WHERE app_logo_url IS NULL;
-- Customer app download links (shown in the provider app → «حسابي»).
ALTER TABLE app_settings ADD COLUMN customer_ios_url TEXT;
ALTER TABLE app_settings ADD COLUMN customer_android_url TEXT;
ALTER TABLE app_settings ADD COLUMN customer_other_url TEXT;
-- Provider app download links (shown in the customer app → «هل لديك مهارة أو خبرة؟»).
ALTER TABLE app_settings ADD COLUMN provider_ios_url TEXT;
ALTER TABLE app_settings ADD COLUMN provider_android_url TEXT;
ALTER TABLE app_settings ADD COLUMN provider_other_url TEXT;

-- Fine-grained actions per admin page: {"section": ["action", ...]}; NULL = every action of the pages the staff member may edit.
ALTER TABLE users ADD COLUMN admin_features TEXT;

-- Issued experience letters (verified by the QR code / reference number).
CREATE TABLE experience_letters (
  ref TEXT PRIMARY KEY,
  provider_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  provider_name TEXT,
  period_from TEXT,
  period_to TEXT NOT NULL,
  completed INTEGER NOT NULL DEFAULT 0,
  rating REAL,
  services TEXT NOT NULL DEFAULT '[]',
  issued_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX idx_experience_letters_provider ON experience_letters(provider_id, issued_at);
