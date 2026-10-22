import {z} from 'zod';
export const onboardingSchema=z.object({organizationName:z.string().trim().min(2).max(150),contactName:z.string().trim().min(2).max(150),phone:z.string().max(35).optional().default(''),addressLine1:z.string().trim().min(3).max(200),city:z.string().trim().min(2).max(100),region:z.string().trim().min(2).max(100),postalCode:z.string().trim().min(2).max(30),country:z.string().trim().min(2).max(100),industry:z.string().trim().min(2).max(100),website:z.union([z.literal(''),z.string().url().max(200)]).optional().default('')});
export const inviteSchema=z.object({organizationId:z.string().uuid(),email:z.string().email().max(254)});
export function canInvite(roles:string[],isPlatformAdmin=false){return isPlatformAdmin||roles.includes('organization_admin')}
