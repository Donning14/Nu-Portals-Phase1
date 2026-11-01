import { createClerkClient } from "@clerk/backend";
import { canAccess, isPublicPage, DEFAULT_ROLE } from "./permissions";

interface AppLoadContext {
  cloudflare: {
    env: {
      CLERK_SECRET_KEY: string;
      APP_ORIGIN: string;
    };
    ctx: ExecutionContext;
  };
}

/**
 * Check role-based access in a React Router loader.
 * 
 * - Returns { role, userId } if access is allowed
 * - Redirects to /sign-in if not authenticated
 * - Returns 403 if the user's role doesn't have access to the page
 */
export async function requireRole(
  request: Request,
  context: AppLoadContext
): Promise<{ role: string; userId: string | null }> {
  const path = new URL(request.url).pathname;

  // Skip auth for public pages (sign-in, sign-up, etc.)
  if (isPublicPage(path)) {
    return { role: DEFAULT_ROLE, userId: null };
  }

  const env = context.cloudflare.env;
  const clerk = createClerkClient({ secretKey: env.CLERK_SECRET_KEY });

  try {
    const session = await clerk.authenticateRequest(request, {
      secretKey: env.CLERK_SECRET_KEY,
    });

    if (!session.isSignedIn) {
      throw new Response(null, {
        status: 302,
        headers: { Location: "/sign-in" },
      });
    }

    // Get the user's role from Clerk privateMetadata
    const user = await clerk.users.getUser(session.userId);
    const role = (user.privateMetadata?.role as string) || DEFAULT_ROLE;

    // Check if the role can access the page
    if (!canAccess(role, path)) {
      throw new Response(
        "Forbidden — your role does not have access to this page.",
        { status: 403 }
      );
    }

    return { role, userId: session.userId };
  } catch (err) {
    if (err instanceof Response) throw err;
    throw new Response(null, {
      status: 302,
      headers: { Location: "/sign-in" },
    });
  }
}
