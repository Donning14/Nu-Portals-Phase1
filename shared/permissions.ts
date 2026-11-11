// ─── Role-Based Access Control ───────────────────────────────────────────────
// Edit this file to change which roles can access which pages.
// "*" means access to every page.
// Page names match your URL path without the leading slash (e.g., /home → "home").

const PORTAL_PAGES = ["app/quotes", "app/requests", "app/projects", "app/agreements"];

export const ROLE_PERMISSIONS: Record<string, string[]> = {
  executive: ["*"],
  employee:  ["home", "about", "contact", "preferences", "services", ...PORTAL_PAGES],
  customer:  ["home", "about", "contact", "preferences", "services", ...PORTAL_PAGES],
  user:      ["home", "about", "contact", "preferences", "services", ...PORTAL_PAGES],
};

export const DEFAULT_ROLE = "user";

// Pages that don't require authentication
export const PUBLIC_PAGES = ["", "login", "signup", "sign-in", "sign-up"];

// Check if a role can access a page path
export function canAccess(role: string, pagePath: string): boolean {
  const allowed = ROLE_PERMISSIONS[role] || ROLE_PERMISSIONS[DEFAULT_ROLE];
  if (allowed.includes("*")) return true;
  const normalized = pagePath.replace(/^\/+|\/+$/g, "");
  const first = normalized.split("/")[0];
  return allowed.some((entry) => {
    if (!entry.includes("/")) return first === entry;
    return normalized === entry || normalized.startsWith(`${entry}/`);
  });
}

// Check if a page requires authentication
export function isPublicPage(pagePath: string): boolean {
  const normalized = pagePath.replace(/^\/+|\/+$/g, "").split("/")[0];
  return PUBLIC_PAGES.includes(normalized);
}
