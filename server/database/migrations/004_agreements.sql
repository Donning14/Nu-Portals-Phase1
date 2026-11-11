-- Signed agreements and project documents.
-- File bytes stay in a private Cloudflare R2 bucket. PostgreSQL stores the object key and metadata only.

ALTER TABLE quotes
  ADD CONSTRAINT quotes_id_org_unique UNIQUE (id, organization_id);

CREATE TABLE agreements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id),
  quote_id uuid,
  project_id uuid,
  agreement_number text NOT NULL,
  document_key text NOT NULL,
  document_version integer NOT NULL DEFAULT 1 CHECK (document_version > 0),
  status text NOT NULL DEFAULT 'draft',
  signed_by_name text,
  signed_by_user_id uuid REFERENCES users(id),
  signed_at timestamptz,
  effective_date date,
  verified_by_user_id uuid REFERENCES users(id),
  verified_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id, agreement_number, document_version),
  FOREIGN KEY (quote_id, organization_id) REFERENCES quotes (id, organization_id),
  FOREIGN KEY (project_id, organization_id) REFERENCES projects (id, organization_id)
);

CREATE INDEX agreements_org_idx ON agreements(organization_id);
CREATE INDEX agreements_quote_idx ON agreements(quote_id);
CREATE INDEX agreements_project_idx ON agreements(project_id);

CREATE TABLE project_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id),
  project_id uuid NOT NULL,
  uploaded_by_user_id uuid NOT NULL REFERENCES users(id),
  document_type text NOT NULL,
  object_key text NOT NULL,
  original_filename text NOT NULL,
  mime_type text NOT NULL,
  size_bytes bigint NOT NULL CHECK (size_bytes >= 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (project_id, organization_id) REFERENCES projects (id, organization_id)
);

CREATE INDEX project_documents_project_idx ON project_documents(project_id, created_at DESC);
CREATE UNIQUE INDEX project_documents_object_key_unique ON project_documents(object_key);
CREATE UNIQUE INDEX agreements_document_key_unique ON agreements(document_key);
