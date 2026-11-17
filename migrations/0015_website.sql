-- Public website (/site): editable content, extra pages, visitor messages and privacy-friendly daily analytics.
CREATE TABLE site_content (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  data TEXT NOT NULL DEFAULT '{}',
  updated_at TEXT,
  updated_by TEXT
);
INSERT INTO site_content (id, data) VALUES (1, '{}');

CREATE TABLE site_pages (
  id TEXT PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  body TEXT NOT NULL DEFAULT '',
  show_in_nav INTEGER NOT NULL DEFAULT 0,
  show_in_footer INTEGER NOT NULL DEFAULT 1,
  published INTEGER NOT NULL DEFAULT 1,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at TEXT
);

CREATE TABLE site_messages (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  phone TEXT,
  email TEXT,
  topic TEXT NOT NULL DEFAULT 'general',
  message TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'new',
  handled_by TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX idx_site_messages_status ON site_messages(status, created_at);

-- Counters only (no personal data): kind = view | visitor | source | device | country | event.
CREATE TABLE site_stats (
  day TEXT NOT NULL,
  kind TEXT NOT NULL,
  key TEXT NOT NULL,
  count INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (day, kind, key)
);
