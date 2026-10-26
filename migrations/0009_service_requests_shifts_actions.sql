-- A provider asks to add a service, with a certificate or proof (private file).
CREATE TABLE service_requests (
  id TEXT PRIMARY KEY,
  provider_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  service_id TEXT NOT NULL REFERENCES services(id) ON DELETE CASCADE,
  note TEXT,
  doc_key TEXT,
  doc_type TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected')),
  admin_note TEXT,
  reviewed_by TEXT,
  reviewed_at TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX idx_service_requests_provider ON service_requests(provider_id, created_at);
CREATE INDEX idx_service_requests_status ON service_requests(status, created_at);

-- Online periods ("الدوام"): opened when the provider switches to online, closed when offline.
CREATE TABLE provider_shifts (
  id TEXT PRIMARY KEY,
  provider_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  started_at TEXT NOT NULL,
  ended_at TEXT
);
CREATE INDEX idx_provider_shifts ON provider_shifts(provider_id, started_at);

-- Suspensions / reactivations / deletions by the administration, with reason and an attached letter.
CREATE TABLE account_actions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  user_name TEXT,
  action TEXT NOT NULL CHECK (action IN ('suspend','reactivate','delete')),
  reason TEXT NOT NULL,
  letter_key TEXT,
  letter_type TEXT,
  created_by TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX idx_account_actions_user ON account_actions(user_id, created_at);
ALTER TABLE users ADD COLUMN suspend_reason TEXT;
