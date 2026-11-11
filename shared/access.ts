export type AccessAction =
  | 'create_quote_request'
  | 'view_request'
  | 'update_request'
  | 'view_project'
  | 'edit_project'
  | 'post_project_update'
  | 'create_quote'
  | 'view_quote'
  | 'create_project'
  | 'upload_agreement'
  | 'verify_agreement'
  | 'convert_customer'
  | 'view_customer';

export type Subject = {
  isPlatformAdmin: boolean;
  isInternalAdmin: boolean;
  isInternalManager: boolean;
  isInternalEmployee: boolean;
};

export type Resource = {
  organizationIsActive: boolean;
  organizationIsInternal: boolean;
  customerOfOrg: boolean;
  permittedOnOrg: boolean;
  employeeAssigned: boolean;
  managerAuthorized: boolean;
};

export const projectEditFields = {
  employee: ['description'],
  manager: ['status', 'description', 'scopeOfWork', 'priority', 'startDate', 'targetEndDate', 'completedAt'],
  admin: ['status', 'description', 'scopeOfWork', 'priority', 'startDate', 'targetEndDate', 'completedAt', 'projectManagerUserId'],
} as const;

export const requestUpdateFields = {
  manager: ['status', 'serviceTypeId'],
  admin: ['status', 'serviceTypeId', 'assignedPmUserId'],
} as const;

export function isPortfolioAdmin(subject: Subject, resource: Resource) {
  return (subject.isPlatformAdmin || subject.isInternalAdmin) && resource.organizationIsActive && !resource.organizationIsInternal;
}

export function authorize(action: AccessAction, subject: Subject, resource: Resource, fields: string[] = []) {
  if (!resource.organizationIsActive) return { ok: false, fields: [] as string[] };
  const admin = isPortfolioAdmin(subject, resource);
  const permittedStaff = resource.permittedOnOrg && (subject.isInternalEmployee || subject.isInternalManager || subject.isInternalAdmin || subject.isPlatformAdmin);

  if (action === 'create_quote_request') {
    return { ok: admin || resource.customerOfOrg || permittedStaff, fields: [] };
  }
  if (action === 'view_request' || action === 'view_quote' || action === 'view_project') {
    return { ok: admin || resource.customerOfOrg || (subject.isInternalEmployee && resource.employeeAssigned) || resource.managerAuthorized, fields: [] };
  }
  if (action === 'update_request') {
    const allowed = admin ? [...requestUpdateFields.admin] : resource.managerAuthorized ? [...requestUpdateFields.manager] : [];
    return decideFields(allowed, fields);
  }
  if (action === 'edit_project') {
    const allowed = admin ? [...projectEditFields.admin] : resource.managerAuthorized ? [...projectEditFields.manager] : subject.isInternalEmployee && resource.employeeAssigned ? [...projectEditFields.employee] : [];
    return decideFields(allowed, fields);
  }
  if (action === 'post_project_update') {
    return { ok: admin || resource.managerAuthorized || (subject.isInternalEmployee && resource.employeeAssigned), fields: ['summary', 'details', 'visibility'] };
  }
  if (action === 'create_quote' || action === 'create_project') {
    return { ok: admin || resource.managerAuthorized, fields: [] };
  }
  if (action === 'upload_agreement') {
    return { ok: admin || resource.managerAuthorized, fields: [] };
  }
  if (action === 'verify_agreement' || action === 'convert_customer' || action === 'view_customer') {
    return { ok: admin || (action === 'view_customer' && resource.managerAuthorized), fields: [] };
  }
  return { ok: false, fields: [] };
}

function decideFields(allowed: string[], fields: string[]) {
  if (allowed.length === 0 || fields.length === 0 || fields.some((field) => !allowed.includes(field))) {
    return { ok: false, fields: allowed };
  }
  return { ok: true, fields: allowed };
}
