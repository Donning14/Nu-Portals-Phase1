-- Service catalog, quote requests, and optional issued quotes.
-- A quote request does not require a quote. Quotes reference the request.

CREATE TABLE service_types (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  name text NOT NULL,
  description text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE quote_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id),
  request_number text NOT NULL,
  requested_by_user_id uuid NOT NULL REFERENCES users(id),
  service_type_id uuid REFERENCES service_types(id),
  title text NOT NULL,
  description text,
  scope_of_work text,
  requested_start_date date,
  budget_range text,
  status text NOT NULL DEFAULT 'submitted',
  assigned_pm_user_id uuid REFERENCES users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id, request_number)
);

CREATE INDEX quote_requests_org_idx ON quote_requests(organization_id);
CREATE INDEX quote_requests_service_type_idx ON quote_requests(service_type_id);
CREATE INDEX quote_requests_requested_by_idx ON quote_requests(requested_by_user_id);
CREATE INDEX quote_requests_assigned_pm_idx ON quote_requests(assigned_pm_user_id);

CREATE TABLE quotes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id),
  quote_request_id uuid NOT NULL REFERENCES quote_requests(id),
  quote_number text NOT NULL,
  version integer NOT NULL DEFAULT 1 CHECK (version > 0),
  amount numeric(12, 2),
  currency text NOT NULL DEFAULT 'USD',
  scope_summary text,
  status text NOT NULL DEFAULT 'draft',
  issued_at timestamptz,
  expires_at timestamptz,
  accepted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id, quote_number, version),
  UNIQUE (quote_request_id, version)
);

CREATE INDEX quotes_org_idx ON quotes(organization_id);
CREATE INDEX quotes_request_idx ON quotes(quote_request_id);

INSERT INTO service_types (code, name) VALUES
  ('ai_agent_development', 'AI Agent Development'),
  ('business_process_automation', 'Business Process Automation'),
  ('crm_integration', 'CRM Integration'),
  ('website_and_portal_development', 'Website and Portal Development'),
  ('api_and_system_integration', 'API and System Integration'),
  ('ai_agent_maintenance_and_support', 'AI Agent Maintenance and Support'),
  ('existing_project_completion', 'Existing Project Completion'),
  ('consulting_and_discovery', 'Consulting and Discovery')
ON CONFLICT (code) DO NOTHING;
