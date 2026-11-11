import {z} from 'zod';
export const onboardingSchema=z.object({organizationName:z.string().trim().min(2).max(150),contactName:z.string().trim().min(2).max(150),phone:z.string().max(35).optional().default(''),addressLine1:z.string().trim().min(3).max(200),city:z.string().trim().min(2).max(100),region:z.string().trim().min(2).max(100),postalCode:z.string().trim().min(2).max(30),country:z.string().trim().min(2).max(100),industry:z.string().trim().min(2).max(100),website:z.union([z.literal(''),z.string().url().max(200)]).optional().default('')});
export const inviteSchema=z.object({organizationId:z.string().uuid(),email:z.string().email().max(254)});
export function canInvite(roles:string[],isPlatformAdmin=false){return isPlatformAdmin||roles.includes('organization_admin')}

const uuid = z.string().uuid();
const contactMethod = z.enum(['email', 'phone', 'text']);

export const profilePatchSchema = z.object({
  firstName: z.string().trim().min(1).max(80).optional(),
  lastName: z.string().trim().min(1).max(80).optional(),
  displayName: z.string().trim().min(1).max(150).optional(),
  mobilePhone: z.string().trim().max(35).optional(),
  preferredContactMethod: contactMethod.optional(),
}).strict().refine((value) => Object.values(value).some((item) => item !== undefined), { message: 'No profile changes' });

export const inquirySchema = z.object({
  topic: z.string().trim().min(2).max(80),
  service: z.string().trim().max(120).optional().default(''),
  message: z.string().trim().min(10).max(2000),
  contactPreference: contactMethod,
  contactName: z.string().trim().min(2).max(150),
  contactEmail: z.string().trim().email().max(254),
  websiteConfirm: z.string().max(0).optional().default(''),
});

export const quoteRequestCreateSchema = z.object({
  organizationId: uuid,
  serviceTypeId: uuid.optional(),
  title: z.string().trim().min(2).max(150),
  description: z.string().trim().max(4000).optional().default(''),
  scopeOfWork: z.string().trim().min(2).max(4000),
  requestedStartDate: z.string().date(),
  budgetRange: z.string().trim().min(1).max(80),
});

export const quoteRequestStatuses = ['submitted', 'in_review', 'qualified', 'quoted', 'deferred', 'rejected', 'accepted'] as const;

export const quoteRequestPatchSchema = z.object({
  status: z.enum(quoteRequestStatuses).optional(),
  assignedPmUserId: uuid.nullable().optional(),
  serviceTypeId: uuid.nullable().optional(),
}).strict().refine((value) => Object.values(value).some((item) => item !== undefined), { message: 'No editable changes' });

export const quoteCreateSchema = z.object({
  organizationId: uuid,
  quoteRequestId: uuid,
  amount: z.number().nonnegative().max(9999999999.99).optional(),
  currency: z.string().trim().length(3).default('USD'),
  scopeSummary: z.string().trim().min(2).max(4000),
  expiresAt: z.string().datetime().optional(),
});

export const projectStatuses = ['planned', 'active', 'on_hold', 'completed'] as const;

export const projectCreateSchema = z.object({
  organizationId: uuid,
  quoteRequestId: uuid,
  name: z.string().trim().min(2).max(150),
  serviceTypeId: uuid.optional(),
  description: z.string().trim().max(4000).optional().default(''),
  scopeOfWork: z.string().trim().max(4000).optional().default(''),
  priority: z.enum(['low', 'normal', 'high', 'urgent']).optional(),
  startDate: z.string().date().optional(),
  targetEndDate: z.string().date().optional(),
});

export const projectPatchSchema = z.object({
  status: z.enum(projectStatuses).optional(),
  description: z.string().trim().max(4000).optional(),
  scopeOfWork: z.string().trim().max(4000).optional(),
  priority: z.enum(['low', 'normal', 'high', 'urgent']).nullable().optional(),
  startDate: z.string().date().nullable().optional(),
  targetEndDate: z.string().date().nullable().optional(),
  completedAt: z.string().datetime().nullable().optional(),
  projectManagerUserId: uuid.nullable().optional(),
}).strict().refine((value) => Object.values(value).some((item) => item !== undefined), { message: 'No editable changes' });

export const projectUpdateSchema = z.object({
  summary: z.string().trim().min(2).max(200),
  details: z.string().trim().max(4000).optional().default(''),
  visibility: z.enum(['internal', 'customer']).default('internal'),
});

export const agreementCreateSchema = z.object({
  organizationId: uuid,
  quoteId: uuid.nullable().optional(),
  projectId: uuid.nullable().optional(),
  agreementNumber: z.string().trim().min(2).max(40),
  documentKey: z.string().trim().min(3).max(500),
  documentVersion: z.number().int().positive().max(1000).default(1),
  signedByName: z.string().trim().max(150).optional(),
  signedAt: z.string().datetime().optional(),
  effectiveDate: z.string().date().optional(),
});

export const customerListSchema = z.object({
  organizationId: uuid.optional(),
  lifecycleStatus: z.enum(['prospect', 'qualified', 'active', 'inactive', 'former']).optional(),
});
