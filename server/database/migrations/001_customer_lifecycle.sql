-- Customer engagement profile and lifecycle fields.
-- Clerk remains the identity provider; these columns store business profile data only.

ALTER TABLE users
  ADD COLUMN first_name text,
  ADD COLUMN last_name text,
  ADD COLUMN mobile_phone text,
  ADD COLUMN preferred_contact_method text,
  ADD COLUMN profile_completed_at timestamptz;

ALTER TABLE organizations
  ADD COLUMN address_line2 text,
  ADD COLUMN business_email text,
  ADD COLUMN business_phone text,
  ADD COLUMN primary_contact_user_id uuid REFERENCES users(id),
  ADD COLUMN onboarding_status text;

CREATE INDEX organizations_primary_contact_idx ON organizations(primary_contact_user_id);

ALTER TABLE customers
  ADD COLUMN customer_number text,
  ADD COLUMN lifecycle_status text,
  ADD COLUMN converted_at timestamptz,
  ADD COLUMN account_manager_user_id uuid REFERENCES users(id),
  ADD COLUMN updated_at timestamptz NOT NULL DEFAULT now();

-- New registrations default to prospect. Existing rows adopt their current status
-- when that status is already a lifecycle state.
UPDATE customers
SET lifecycle_status = CASE
  WHEN status IN ('prospect', 'qualified', 'active', 'inactive', 'former') THEN status
  ELSE 'prospect'
END
WHERE lifecycle_status IS NULL;

ALTER TABLE customers
  ALTER COLUMN lifecycle_status SET DEFAULT 'prospect',
  ALTER COLUMN lifecycle_status SET NOT NULL;

ALTER TABLE customers
  ADD CONSTRAINT customers_lifecycle_status_check
  CHECK (lifecycle_status IN ('prospect', 'qualified', 'active', 'inactive', 'former'));

CREATE UNIQUE INDEX customers_org_number_unique ON customers(organization_id, customer_number);
CREATE INDEX customers_account_manager_idx ON customers(account_manager_user_id);

ALTER TABLE employees
  ADD COLUMN job_title text,
  ADD COLUMN department text,
  ADD COLUMN updated_at timestamptz NOT NULL DEFAULT now();

ALTER TABLE communication_preferences
  ADD COLUMN preferred_contact_method text,
  ADD COLUMN consent_source text,
  ADD COLUMN updated_by_user_id uuid REFERENCES users(id);

CREATE INDEX communication_preferences_updated_by_idx ON communication_preferences(updated_by_user_id);
