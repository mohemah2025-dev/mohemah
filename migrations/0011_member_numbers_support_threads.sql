-- Easy member numbers (#1001, #1002 …) for every customer and provider.
ALTER TABLE users ADD COLUMN member_no INTEGER;
UPDATE users SET member_no = 1000 + (SELECT COUNT(*) FROM users u2 WHERE u2.created_at < users.created_at OR (u2.created_at = users.created_at AND u2.id <= users.id));
CREATE UNIQUE INDEX idx_users_member_no ON users(member_no);
CREATE TRIGGER trg_users_member_no AFTER INSERT ON users WHEN NEW.member_no IS NULL BEGIN UPDATE users SET member_no = (SELECT COALESCE(MAX(member_no), 1000) + 1 FROM users) WHERE id = NEW.id; END;

-- Conversations with the administration: open (unanswered / ongoing) or closed, assigned to a staff member, rated at the end.
CREATE TABLE support_threads (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  subject TEXT,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open','closed')),
  assigned_to TEXT REFERENCES users(id) ON DELETE SET NULL,
  last_from TEXT NOT NULL DEFAULT 'user' CHECK (last_from IN ('user','admin')),
  last_message_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  closed_at TEXT,
  closed_by TEXT,
  rating INTEGER CHECK (rating IS NULL OR rating BETWEEN 1 AND 5),
  rating_note TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX idx_support_threads_status ON support_threads(status, last_message_at);
CREATE INDEX idx_support_threads_user ON support_threads(user_id, created_at);
ALTER TABLE messages ADD COLUMN thread_id TEXT;
CREATE INDEX idx_messages_thread ON messages(thread_id, created_at);

-- Existing administration messages become one conversation per user.
INSERT INTO support_threads (id, user_id, status, last_from, last_message_at, created_at)
SELECT lower(hex(randomblob(16))), x.uid, 'open', 'user', MAX(x.created_at), MIN(x.created_at) FROM (
  SELECT CASE WHEN m.sender_id IN (SELECT user_id FROM user_roles WHERE role IN ('admin','staff')) THEN m.recipient_id ELSE m.sender_id END AS uid, m.created_at
    FROM messages m WHERE m.order_id IS NULL
) x WHERE x.uid IS NOT NULL AND x.uid IN (SELECT id FROM users) GROUP BY x.uid;
UPDATE messages SET thread_id = (SELECT t.id FROM support_threads t WHERE t.user_id = CASE WHEN messages.sender_id IN (SELECT user_id FROM user_roles WHERE role IN ('admin','staff')) THEN messages.recipient_id ELSE messages.sender_id END) WHERE order_id IS NULL;
UPDATE support_threads SET last_from = COALESCE((SELECT CASE WHEN m.sender_id = support_threads.user_id THEN 'user' ELSE 'admin' END FROM messages m WHERE m.thread_id = support_threads.id ORDER BY m.created_at DESC LIMIT 1), 'user');
