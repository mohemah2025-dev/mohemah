-- تخزين الملفات داخل D1 (بديل R2 بلا بطاقة دفع): الملف يُقسّم إلى أجزاء لأن حد الصف في D1 قرابة 2MB.
CREATE TABLE IF NOT EXISTS stored_files (
  key TEXT PRIMARY KEY,
  content_type TEXT NOT NULL,
  size INTEGER NOT NULL,
  chunks INTEGER NOT NULL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE TABLE IF NOT EXISTS stored_file_chunks (
  key TEXT NOT NULL REFERENCES stored_files(key) ON DELETE CASCADE,
  idx INTEGER NOT NULL,
  data BLOB NOT NULL,
  PRIMARY KEY (key, idx)
);
