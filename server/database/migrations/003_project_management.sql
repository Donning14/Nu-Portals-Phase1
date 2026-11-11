-- Project delivery fields, status history, and project updates.
-- project_assignments is unchanged and still links contributing employees.

ALTER TABLE organizations
  ADD COLUMN is_internal boolean NOT NULL DEFAULT false;

ALTER TABLE projects
  ADD COLUMN project_number text,
  ADD COLUMN quote_request_id uuid REFERENCES quote_requests(id),
  ADD COLUMN service_type_id uuid REFERENCES service_types(id),
  ADD COLUMN project_manager_user_id uuid REFERENCES users(id),
  ADD COLUMN description text,
  ADD COLUMN scope_of_work text,
  ADD COLUMN priority text,
  ADD COLUMN start_date date,
  ADD COLUMN target_end_date date,
  ADD COLUMN completed_at timestamptz,
  ADD COLUMN updated_at timestamptz NOT NULL DEFAULT now();

ALTER TABLE projects
  ADD CONSTRAINT projects_id_org_unique UNIQUE (id, organization_id);

CREATE UNIQUE INDEX projects_org_number_unique ON projects(organization_id, project_number);
CREATE INDEX projects_quote_request_idx ON projects(quote_request_id);
CREATE INDEX projects_service_type_idx ON projects(service_type_id);
CREATE INDEX projects_manager_idx ON projects(project_manager_user_id);

CREATE TABLE project_status_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id),
  project_id uuid NOT NULL,
  previous_status text,
  new_status text NOT NULL,
  changed_by_user_id uuid NOT NULL REFERENCES users(id),
  notes text,
  changed_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (project_id, organization_id) REFERENCES projects (id, organization_id)
);

CREATE INDEX project_status_history_project_idx ON project_status_history(project_id, changed_at DESC);

CREATE TABLE project_updates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id),
  project_id uuid NOT NULL,
  author_user_id uuid NOT NULL REFERENCES users(id),
  summary text NOT NULL,
  details text,
  visibility text NOT NULL DEFAULT 'internal' CHECK (visibility IN ('internal', 'customer')),
  created_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (project_id, organization_id) REFERENCES projects (id, organization_id)
);

CREATE INDEX project_updates_project_idx ON project_updates(project_id, created_at DESC);

-- Nu-Portals staff are active platform administrators or active employees of an internal organization.
-- Membership in the customer organization is not enough.
CREATE OR REPLACE FUNCTION is_authorized_nu_portals_staff(candidate uuid)
RETURNS boolean
LANGUAGE sql
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM users u
    WHERE u.id = candidate
      AND u.status = 'active'
      AND (
        u.is_platform_admin
        OR EXISTS (
          SELECT 1
          FROM employees e
          JOIN organizations staff_org ON staff_org.id = e.organization_id
          WHERE e.user_id = u.id
            AND e.status = 'active'
            AND staff_org.is_internal
        )
      )
  );
$$;

CREATE OR REPLACE FUNCTION assert_project_manager_is_staff()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.project_manager_user_id IS NOT NULL
     AND NOT is_authorized_nu_portals_staff(NEW.project_manager_user_id) THEN
    RAISE EXCEPTION 'project manager must be an authorized Nu-Portals staff identity';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER projects_project_manager_staff
  BEFORE INSERT OR UPDATE OF project_manager_user_id ON projects
  FOR EACH ROW
  EXECUTE FUNCTION assert_project_manager_is_staff();

CREATE OR REPLACE FUNCTION assert_quote_request_pm_is_staff()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.assigned_pm_user_id IS NOT NULL
     AND NOT is_authorized_nu_portals_staff(NEW.assigned_pm_user_id) THEN
    RAISE EXCEPTION 'project manager must be an authorized Nu-Portals staff identity';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER quote_requests_assigned_pm_staff
  BEFORE INSERT OR UPDATE OF assigned_pm_user_id ON quote_requests
  FOR EACH ROW
  EXECUTE FUNCTION assert_quote_request_pm_is_staff();
