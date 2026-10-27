-- App language of each user (ar | en | ur): used to translate conversations for them.
ALTER TABLE users ADD COLUMN lang TEXT NOT NULL DEFAULT 'ar';

-- Chat messages: language written in, voice notes (R2 key + automatic transcript) and special kinds (price offers).
ALTER TABLE messages ADD COLUMN lang TEXT;
ALTER TABLE messages ADD COLUMN kind TEXT NOT NULL DEFAULT 'text';
ALTER TABLE messages ADD COLUMN audio_key TEXT;
ALTER TABLE messages ADD COLUMN transcript TEXT;
CREATE TABLE message_translations (
  message_id TEXT NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
  lang TEXT NOT NULL,
  text TEXT NOT NULL,
  PRIMARY KEY (message_id, lang)
);

-- Machine translations of admin-entered content (service names, policies, notifications…), cached once.
CREATE TABLE content_translations (
  hash TEXT NOT NULL,
  lang TEXT NOT NULL,
  text TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  PRIMARY KEY (hash, lang)
);

-- Service price set by the provider (NULL = to be negotiated) and the customer's answer.
ALTER TABLE orders ADD COLUMN price_amount REAL;
ALTER TABLE orders ADD COLUMN price_status TEXT NOT NULL DEFAULT 'none';
ALTER TABLE orders ADD COLUMN price_updated_at TEXT;
-- Structured cancellation reason (price_disagreement, provider_late, not_needed, other_provider, other) and admin review.
ALTER TABLE orders ADD COLUMN cancel_code TEXT;
ALTER TABLE orders ADD COLUMN cancel_reviewed_at TEXT;
ALTER TABLE orders ADD COLUMN cancel_reviewed_by TEXT;

-- Popup ads for new members (welcome) with an optional gift (coins or subscription days for providers).
ALTER TABLE ads ADD COLUMN audience TEXT NOT NULL DEFAULT 'all';
ALTER TABLE ads ADD COLUMN new_days INTEGER NOT NULL DEFAULT 7;
ALTER TABLE ads ADD COLUMN app TEXT NOT NULL DEFAULT 'all';
ALTER TABLE ads ADD COLUMN gift_kind TEXT NOT NULL DEFAULT 'none';
ALTER TABLE ads ADD COLUMN gift_value INTEGER NOT NULL DEFAULT 0;
CREATE TABLE ad_claims (
  ad_id TEXT NOT NULL REFERENCES ads(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  PRIMARY KEY (ad_id, user_id)
);
