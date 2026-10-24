-- Per-document review: the administrator marks each document as accepted or rejected (with a reason).
ALTER TABLE provider_documents ADD COLUMN status TEXT NOT NULL DEFAULT 'pending';
ALTER TABLE provider_documents ADD COLUMN note TEXT;
