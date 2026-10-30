import { createRequestHandler, RouterContextProvider } from "react-router";
import { createClerkClient } from "@clerk/backend";
import { api } from "../server/api";

// ─── Role → allowed pages mapping ───────────────────────────────────────────
// "*" means access to every page. Add or remove pages as needed.

const ROLE_PERMISSIONS: Record<string, string[]> = {
  executive: ["*"],                                          // see all pages
  employee:  ["dashboard", "reports", "tasks", "settings"],  // see some pages
  user:      ["account", "orders", "support"],              // default role
  customer:  ["account", "orders", "support"],              // same as user
};

const DEFAULT_ROLE = "user";

function canAccess(role: string, pagePath: string): boolean {
  const allowed = ROLE_PERMISSIONS[role] || ROLE_PERMISSIONS[DEFAULT_ROLE];
  if (allowed.includes("*")) return true;
  const normalized = pagePath.replace(/^\/+|\/+$/g, "").split("/")[0];
  return allowed.includes(normalized);
}

// ─── Clerk webhook signature verification (Svix) ─────────────────────────────

async function verifyWebhookSignature(
  request: Request,
  secret: string
): Promise<any | null> {
  const svixId = request.headers.get("svix-id");
  const svixTimestamp = request.headers.get("svix-timestamp");
  const svixSignature = request.headers.get("svix-signature");
  if (!svixId || !svixTimestamp || !svixSignature) return null;

  const body = await request.text();
  const signedPayload = `${svixId}.${svixTimestamp}.${body}`;
  const encoder = new TextEncoder();

  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["verify"]
  );

  // Svix signatures are base64-encoded: "v1,base64string v1,base64string"
  const sigs = svixSignature.split(" ").map((s) => s.replace("v1,", ""));
  for (const sig of sigs) {
    const signatureBytes = Uint8Array.from(atob(sig), (c) => c.charCodeAt(0));
    const valid = await crypto.subtle.verify(
      "HMAC",
      key,
      signatureBytes,
      encoder.encode(signedPayload)
    );
    if (valid) return JSON.parse(body);
  }
  return null;
}

// ─── Webhook handler: auto-assign default role on user.created ────────────────

async function handleWebhook(request: Request, env: Env): Promise<Response> {
  const payload = await verifyWebhookSignature(request, env.CLERK_WEBHOOK_SECRET);
  if (!payload) {
    return new Response("Invalid webhook signature", { status: 401 });
  }

  if (payload.type === "user.created") {
    const userId: string = payload.data.id;
    const clerk = createClerkClient({ secretKey: env.CLERK_SECRET_KEY });

    // Only set the role if not already set (avoid overwriting manual changes)
    const user = await clerk.users.getUser(userId);
    if (!user.privateMetadata?.role) {
      await clerk.users.updateUser(userId, {
        privateMetadata: { role: DEFAULT_ROLE },
      });
      console.log(`Assigned default role "${DEFAULT_ROLE}" to user ${userId}`);
    }
  }

  return new Response("OK", { status: 200 });
}

// ─── Admin handler: programmatically change a user's role ────────────────────

async function handleSetRole(request: Request, env: Env): Promise<Response> {
  const clerk = createClerkClient({ secretKey: env.CLERK_SECRET_KEY });

  const session = await clerk.authenticateRequest(request, {
    secretKey: env.CLERK_SECRET_KEY,
  });

  if (!session.isSignedIn) {
    return new Response("Unauthorized", { status: 401 });
  }

  const caller = await clerk.users.getUser(session.userId);
  const callerRole = (caller.privateMetadata?.role as string) || DEFAULT_ROLE;

  if (callerRole !== "executive") {
    return new Response("Forbidden — only executives can change roles", {
      status: 403,
    });
  }

  const { userId, role } = await request.json();

  const validRoles = Object.keys(ROLE_PERMISSIONS);
  if (!validRoles.includes(role)) {
    return new Response(`Invalid role. Valid roles: ${validRoles.join(", ")}`, {
      status: 400,
    });
  }

  await clerk.users.updateUser(userId, {
    privateMetadata: { role },
  });

  return Response.json({ success: true, userId, newRole: role });
}

// ─── React Router SSR handler ─────────────────────────────────────────────────

const requestHandler = createRequestHandler(
  () => import("virtual:react-router/server-build"),
  import.meta.env.MODE
);

// Pages that don't require authentication
const PUBLIC_PAGES = ["", "login", "signup", "sign-in", "sign-up"];

// ─── Main Worker entry point ─────────────────────────────────────────────────

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext) {
    const url = new URL(request.url);
    const path = url.pathname;

    // ── 1. Clerk webhook: auto-assign default role on signup ──────────────────
    if (path === "/api/clerk-webhook" && request.method === "POST") {
      return handleWebhook(request, env);
    }

    // ── 2. Admin endpoint: programmatically change a user's role ─────────────
    if (path === "/api/admin/set-role" && request.method === "POST") {
      return handleSetRole(request, env);
    }

    // ── 3. Existing API routes ────────────────────────────────────────────────
    if (path.startsWith("/api/")) {
      return api.fetch(request, env, ctx);
    }

    // ── 4. Authenticate with Clerk for non-public pages ──────────────────────
    const pageSegment = path.replace(/^\/+|\/+$/g, "").split("/")[0];

    if (!PUBLIC_PAGES.includes(pageSegment)) {
      try {
        const clerk = createClerkClient({ secretKey: env.CLERK_SECRET_KEY });
        const session = await clerk.authenticateRequest(request, {
          secretKey: env.CLERK_SECRET_KEY,
        });

        if (!session.isSignedIn) {
          return new Response(null, {
            status: 302,
            headers: { Location: "/login" },
          });
        }

        const user = await clerk.users.getUser(session.userId);
        const role = (user.privateMetadata?.role as string) || DEFAULT_ROLE;

        // Enforce role-based access
        if (!canAccess(role, path)) {
          return new Response(
            "Forbidden — your role does not have access to this page.",
            { status: 403 }
          );
        }

        // Pass user info to React Router context
        const context = new RouterContextProvider();
        (context as any).cloudflare = { env, ctx };
        (context as any).user = { id: session.userId, role };

        const response = await requestHandler(request, context);
        if (!response.ok && response.status >= 500) {
          console.error("SSR FAILED:", response.status, request.url);
          const body = await response.clone().text();
          console.error("SSR BODY:", body.substring(0, 1000));
        }
        return response;
      } catch (error) {
        console.error("WORKER ERROR:", error?.message || String(error), error?.stack);
        throw error;
      }
    }

    // ── 5. Public pages — no auth required ────────────────────────────────────
    const context = new RouterContextProvider();
    (context as any).cloudflare = { env, ctx };
    try {
      const response = await requestHandler(request, context);
      if (!response.ok && response.status >= 500) {
        console.error("SSR FAILED:", response.status, request.url);
        const body = await response.clone().text();
        console.error("SSR BODY:", body.substring(0, 1000));
      }
      return response;
    } catch (error) {
      console.error("WORKER ERROR:", error?.message || String(error), error?.stack);
      throw error;
    }
  },
} satisfies ExportedHandler<Env>;
