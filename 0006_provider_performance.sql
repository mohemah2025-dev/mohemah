-- Orders shown to a provider (first time it appeared in their available list).
CREATE TABLE order_offers (
  order_id TEXT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  provider_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  offered_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  PRIMARY KEY (order_id, provider_id)
);
CREATE INDEX idx_order_offers_provider ON order_offers(provider_id, offered_at);

-- reject = declined an incoming order; release = cancelled after accepting (reason required).
ALTER TABLE order_rejections ADD COLUMN kind TEXT NOT NULL DEFAULT 'reject';
ALTER TABLE order_rejections ADD COLUMN reason TEXT;
CREATE INDEX idx_order_rejections_provider ON order_rejections(provider_id, created_at);
