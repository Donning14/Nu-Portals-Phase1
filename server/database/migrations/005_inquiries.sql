-- Public and signed-in inquiries. Message content stays in PostgreSQL; no file bytes are stored.

CREATE TABLE inquiries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES users(id),
  topic text NOT NULL,
  service_name text,
  message text NOT NULL,
  contact_preference text NOT NULL,
  contact_name text NOT NULL,
  contact_email text NOT NULL,
  source_ip text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX inquiries_abuse_idx ON inquiries(created_at DESC, contact_email, source_ip);
