-- مهمة — هيكل قاعدة البيانات الكامل على Cloudflare D1 (SQLite)
-- كل الأوقات بصيغة ISO-8601 UTC، والمعرّفات نصية (UUID).

CREATE TABLE users (
  id TEXT PRIMARY KEY,
  email TEXT UNIQUE COLLATE NOCASE,
  username TEXT UNIQUE COLLATE NOCASE,
  phone TEXT,
  password_hash TEXT NOT NULL,
  full_name TEXT,
  region TEXT,
  gender TEXT CHECK (gender IN ('male','female')),
  avatar_url TEXT,
  bio TEXT,
  coin_balance INTEGER NOT NULL DEFAULT 0 CHECK (coin_balance >= 0),
  rating REAL NOT NULL DEFAULT 0,
  rating_count INTEGER NOT NULL DEFAULT 0,
  customer_rating REAL NOT NULL DEFAULT 0,
  customer_rating_count INTEGER NOT NULL DEFAULT 0,
  is_active INTEGER NOT NULL DEFAULT 1,
  is_online INTEGER NOT NULL DEFAULT 0,
  billing_mode TEXT NOT NULL DEFAULT 'coins' CHECK (billing_mode IN ('coins','subscription')),
  national_id TEXT,
  nationality TEXT,
  verification_status TEXT NOT NULL DEFAULT 'none' CHECK (verification_status IN ('none','pending','approved','rejected')),
  review_note TEXT,
  reviewed_at TEXT,
  reviewed_by TEXT,
  requested_services TEXT NOT NULL DEFAULT '[]',
  referral_code TEXT UNIQUE,
  last_seen_at TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX idx_users_verification ON users(verification_status, created_at);

CREATE TABLE user_roles (
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('admin','staff','provider','customer')),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  PRIMARY KEY (user_id, role)
);
CREATE INDEX idx_user_roles_role ON user_roles(role);

CREATE TABLE sessions (
  token_hash TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  app TEXT NOT NULL CHECK (app IN ('customer','provider','admin')),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  expires_at TEXT NOT NULL,
  user_agent TEXT
);
CREATE INDEX idx_sessions_user ON sessions(user_id);

CREATE TABLE login_attempts (
  key TEXT PRIMARY KEY,
  count INTEGER NOT NULL DEFAULT 0,
  window_start TEXT NOT NULL
);

CREATE TABLE app_settings (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  app_name TEXT NOT NULL DEFAULT 'مهمة',
  logo_url TEXT,
  currency_label TEXT NOT NULL DEFAULT 'كوين',
  primary_color TEXT DEFAULT '#3b6fd8',
  support_email TEXT DEFAULT 'support@mohemah.app',
  support_phone TEXT DEFAULT '+966500000000',
  welcome_customer TEXT,
  welcome_provider TEXT,
  billing_coins_enabled INTEGER NOT NULL DEFAULT 1,
  billing_subscription_enabled INTEGER NOT NULL DEFAULT 0,
  sub_price_1m REAL NOT NULL DEFAULT 99,
  sub_price_3m REAL NOT NULL DEFAULT 269,
  sub_price_6m REAL NOT NULL DEFAULT 499,
  sub_price_12m REAL NOT NULL DEFAULT 899,
  vat_percent REAL NOT NULL DEFAULT 15,
  test_payments_enabled INTEGER NOT NULL DEFAULT 1,
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE TABLE services (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  icon TEXT NOT NULL DEFAULT 'Wrench',
  color TEXT NOT NULL DEFAULT 'blue',
  coin_price INTEGER NOT NULL DEFAULT 5 CHECK (coin_price >= 0),
  active INTEGER NOT NULL DEFAULT 1,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE TABLE sub_services (
  id TEXT PRIMARY KEY,
  service_id TEXT NOT NULL REFERENCES services(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  details TEXT,
  estimated_duration TEXT,
  requires_photos INTEGER NOT NULL DEFAULT 0,
  icon TEXT NOT NULL DEFAULT 'Wrench',
  color TEXT NOT NULL DEFAULT 'blue',
  coin_price INTEGER CHECK (coin_price IS NULL OR coin_price >= 0),
  delivery_mode TEXT NOT NULL DEFAULT 'both' CHECK (delivery_mode IN ('in_person','remote','both')),
  active INTEGER NOT NULL DEFAULT 1,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX idx_sub_services_service ON sub_services(service_id, sort_order);

CREATE TABLE provider_services (
  provider_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  service_id TEXT NOT NULL REFERENCES services(id) ON DELETE CASCADE,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  PRIMARY KEY (provider_id, service_id)
);
CREATE INDEX idx_provider_services_service ON provider_services(service_id);

CREATE TABLE provider_documents (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  kind TEXT NOT NULL CHECK (kind IN ('id','certificate')),
  r2_key TEXT NOT NULL,
  content_type TEXT NOT NULL,
  size INTEGER NOT NULL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX idx_provider_documents_user ON provider_documents(user_id, created_at);

CREATE TABLE addresses (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  label TEXT NOT NULL,
  address TEXT NOT NULL,
  region TEXT,
  lat REAL,
  lng REAL,
  is_default INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX idx_addresses_user ON addresses(user_id);

CREATE TABLE favorites (
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  sub_service_id TEXT NOT NULL REFERENCES sub_services(id) ON DELETE CASCADE,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  PRIMARY KEY (user_id, sub_service_id)
);

-- order_no هو الرقم الظاهر للمستخدم (يبدأ من 1 ويُعرض مضافاً إليه 100000)
CREATE TABLE orders (
  order_no INTEGER PRIMARY KEY AUTOINCREMENT,
  id TEXT NOT NULL UNIQUE,
  customer_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  provider_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  service_id TEXT REFERENCES services(id) ON DELETE SET NULL,
  sub_service_id TEXT REFERENCES sub_services(id) ON DELETE SET NULL,
  service_name TEXT NOT NULL,
  sub_service_name TEXT,
  mode TEXT NOT NULL DEFAULT 'in_person' CHECK (mode IN ('in_person','remote')),
  description TEXT,
  address TEXT,
  region TEXT,
  lat REAL,
  lng REAL,
  scheduled_at TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','accepted','arrived','in_progress','completed','cancelled')),
  coin_cost INTEGER NOT NULL DEFAULT 0 CHECK (coin_cost >= 0),
  charged_coins INTEGER NOT NULL DEFAULT 0,
  billing_mode TEXT CHECK (billing_mode IN ('coins','subscription')),
  rating INTEGER CHECK (rating IS NULL OR rating BETWEEN 1 AND 5),
  review TEXT,
  customer_rating INTEGER CHECK (customer_rating IS NULL OR customer_rating BETWEEN 1 AND 5),
  cancelled_by TEXT CHECK (cancelled_by IN ('customer','provider','admin')),
  cancel_reason TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  accepted_at TEXT,
  arrived_at TEXT,
  started_at TEXT,
  completed_at TEXT,
  cancelled_at TEXT,
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX idx_orders_status_service ON orders(status, service_id, created_at);
CREATE INDEX idx_orders_customer ON orders(customer_id, created_at);
CREATE INDEX idx_orders_provider ON orders(provider_id, status);

-- مقدم الخدمة الذي رفض طلباً وارداً لا يُعرض عليه مرة أخرى
CREATE TABLE order_rejections (
  order_id TEXT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  provider_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  PRIMARY KEY (order_id, provider_id)
);

CREATE TABLE coin_transactions (
  id TEXT PRIMARY KEY,
  provider_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  order_id TEXT,
  amount INTEGER NOT NULL,
  tx_type TEXT NOT NULL CHECK (tx_type IN ('topup','deduction','refund','bonus')),
  balance_after INTEGER NOT NULL,
  description TEXT,
  method TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX idx_coin_tx_provider ON coin_transactions(provider_id, created_at);
CREATE INDEX idx_coin_tx_created ON coin_transactions(created_at);

CREATE TABLE provider_subscriptions (
  id TEXT PRIMARY KEY,
  provider_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  months INTEGER NOT NULL DEFAULT 0,
  amount REAL NOT NULL DEFAULT 0,
  method TEXT,
  starts_at TEXT NOT NULL,
  ends_at TEXT NOT NULL,
  granted_by TEXT,
  grant_note TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX idx_subs_provider ON provider_subscriptions(provider_id, ends_at);

CREATE TABLE payment_gateways (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  provider_key TEXT NOT NULL DEFAULT 'custom',
  merchant_id TEXT,
  public_key TEXT,
  fee_percent REAL NOT NULL DEFAULT 0,
  test_mode INTEGER NOT NULL DEFAULT 1,
  active INTEGER NOT NULL DEFAULT 1,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE TABLE notifications (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  audience TEXT NOT NULL DEFAULT 'all' CHECK (audience IN ('all','customers','providers','specific')),
  category TEXT NOT NULL DEFAULT 'general' CHECK (category IN ('general','national','religious','promo','alert','maintenance','order')),
  icon TEXT,
  accent_color TEXT,
  link TEXT,
  scheduled_at TEXT,
  sent_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  created_by TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX idx_notifications_sent ON notifications(sent_at);

CREATE TABLE notification_targets (
  notification_id TEXT NOT NULL REFERENCES notifications(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  PRIMARY KEY (notification_id, user_id)
);
CREATE INDEX idx_notification_targets_user ON notification_targets(user_id);

CREATE TABLE notification_reads (
  notification_id TEXT NOT NULL REFERENCES notifications(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  read_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  PRIMARY KEY (notification_id, user_id)
);

CREATE TABLE messages (
  id TEXT PRIMARY KEY,
  sender_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  recipient_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  order_id TEXT REFERENCES orders(id) ON DELETE CASCADE,
  subject TEXT,
  body TEXT NOT NULL,
  read_at TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX idx_messages_recipient ON messages(recipient_id, created_at);
CREATE INDEX idx_messages_order ON messages(order_id, created_at);

CREATE TABLE ads (
  id TEXT PRIMARY KEY,
  sponsor TEXT NOT NULL,
  title TEXT NOT NULL,
  image_url TEXT,
  link TEXT,
  placement TEXT NOT NULL DEFAULT 'top_banner' CHECK (placement IN ('top_banner','bottom_banner','popup_card')),
  start_date TEXT NOT NULL,
  end_date TEXT NOT NULL,
  active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE TABLE policies (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  audience TEXT NOT NULL DEFAULT 'all' CHECK (audience IN ('all','customers','providers')),
  policy_type TEXT NOT NULL DEFAULT 'سياسة عامة',
  version TEXT NOT NULL DEFAULT '1.0',
  published INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

-- بيانات أولية
INSERT INTO app_settings (id, welcome_customer, welcome_provider) VALUES (
  1,
  'أهلاً بك في مهمة، اطلب أي خدمة بضغطة زر ونوصلك بأقرب مقدم خدمة.',
  'مرحباً بك في مهمة، فعّل الاتصال من الرئيسية لتصلك الطلبات الجديدة في خدماتك.'
);
INSERT INTO payment_gateways (id, name, provider_key, fee_percent, test_mode, active, sort_order) VALUES
  ('gw-mada', 'مدى', 'mada', 0, 1, 1, 1),
  ('gw-applepay', 'Apple Pay', 'applepay', 0, 1, 1, 2),
  ('gw-visa', 'Visa / Mastercard', 'visa', 0, 1, 1, 3);
