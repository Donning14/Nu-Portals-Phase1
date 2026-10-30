/**
 * Clerk Role-Based Access Control Middleware for Cloudflare Workers
 *
 * Features:
 * - Verifies Clerk session tokens on every request
 * - Auto-assigns a default role ("user") to new signups via webhook
 * - Enforces role-based page access
 * - Provides an admin endpoint to programmatically change a user's role
 *
 * Required Worker bindings (env):
 *   CLERK_SECRET_KEY          — secret_text  (Clerk Backend API secret key)
 *   VITE_CLERK_PUBLISHABLE_KEY — plain_text  (Clerk publishable key)
 *   CLERK_WEBHOOK_SECRET       — secret_text  (Clerk webhook signing secret)
 *   ASSETS                     — assets      (static assets / Pages binding)
 *
 * Clerk dashboard setup:
 *   1. Go to Webhooks → add endpoint → https://nu-portals.com/api/clerk-webhook
 *      Subscribe to: user.created
 *   2. Copy the Signing Secret → set as CLERK_WEBHOOK_SECRET Worker secret
 *   3. New users will be auto-assigned role "user" in privateMetadata
 */

import { createClerkClient } from "@clerk/backend";

// ─── Role → allowed pages mapping ───────────────────────────────────────────
// "*" means access to every page. Add or remove pages as needed.

const ROLE_PERMISSIONS = {
  executive: ["*"],                                        // see all pages
  employee:  ["dashboard", "reports", "tasks", "settings"], // see some pages
  user:      ["account", "orders", "support"],              // default role
  customer:  ["account", "orders", "support"],              // same as user
};

const DEFAULT_ROLE = "user";

// ─── Helper: check if a role can access a page path ─────────────────────────

function canAccess(role, pagePath) {
  const allowed = ROLE_PERMISSIONS[role] || ROLE_PERMISSIONS[DEFAULT_ROLE];
  if (allowed.includes("*")) return true;

  // Normalize: strip leading/trailing slashes
  const normalized = pagePath.replace(/^\/+|\/+$/g, "").split("/")[0];
  return allowed.includes(normalized);
}

// ─── Helper: verify Clerk webhook signature ──────────────────────────────────

async function verifyWebhookSignature(request, secret) {
  const svixId = request.headers.get("svix-id");
  const svixTimestamp = request.headers.get("svix-timestamp");
  const svixSignature = request.headers.get("svix-signature");
  if (!svixId || !svixTimestamp || !svixSignature) return null;

  const body = await request.text();
  // Clerk/Svix webhook verification — uses Web Crypto API (available in Workers)
  const signedPayload = `${svixId}.${svixTimestamp}.${body}`;
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["verify"]
  );
  const signatureBytes = Uint8Array.from(
    svixSignature.split(" ").map((s) => s.replace("v1,", "")).join("").match(/.{1,2}/g).map((b) => parseInt(b, 16))
  );
  const valid = await crypto.subtle.verify(
    "HMAC",
    key,
    signatureBytes,
    encoder.encode(signedPayload)
  );
  return valid ? JSON.parse(body) : null;
}

// ─── Main Worker entry point ─────────────────────────────────────────────────

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const path = url.pathname;

    // ── 1. Clerk webhook: auto-assign default role on signup ──────────────────
    if (path === "/api/clerk-webhook" && request.method === "POST") {
      return handleWebhook(request, env);
    }

    // ── 2. Admin endpoint: programmatically change a user's role ─────────────
    //     POST /api/admin/set-role  { userId, role }
    //     Only "executive" users may call this.
    if (path === "/api/admin/set-role" && request.method === "POST") {
      return handleSetRole(request, env);
    }

    // ── 3. Authenticate the request via Clerk ────────────────────────────────
    const clerk = createClerkClient({ secretKey: env.CLERK_SECRET_KEY });

    try {
      const session = await clerk.authenticateRequest(request, {
        secretKey: env.CLERK_SECRET_KEY,
      });

      // If not signed in, allow only public pages (or redirect to login)
      if (!session.isSignedIn) {
        const publicPages = ["", "login", "signup", "sign-in", "sign-up"];
        const pageSegment = path.replace(/^\/+|\/+$/g, "").split("/")[0];
        if (publicPages.includes(pageSegment)) {
          return env.ASSETS.fetch(request);
        }
        return new Response(null, {
          status: 302,
          headers: { Location: "/login" },
        });
      }

      // ── 4. Fetch the user's role from Clerk privateMetadata ───────────────
      const user = await clerk.users.getUser(session.userId);
      const role = user.privateMetadata?.role || DEFAULT_ROLE;

      // ── 5. Enforce role-based access ──────────────────────────────────────
      if (!canAccess(role, path)) {
        return new Response("Forbidden — your role does not have access to this page.", {
          status: 403,
        });
      }

      // ── 6. Serve the page ─────────────────────────────────────────────────
      // Attach the role to headers so the frontend can use it
      const response = await env.ASSETS.fetch(request);
      const newResponse = new Response(response.body, response);
      newResponse.headers.set("X-User-Role", role);
      newResponse.headers.set("X-User-Id", session.userId);
      return newResponse;
    } catch (err) {
      console.error("Auth error:", err.message);
      return new Response("Authentication error", { status: 500 });
    }
  },
};

// ─── Webhook handler: assign default role on user.created ────────────────────

async function handleWebhook(request, env) {
  const payload = await verifyWebhookSignature(request, env.CLERK_WEBHOOK_SECRET);
  if (!payload) {
    return new Response("Invalid webhook signature", { status: 401 });
  }

  if (payload.type === "user.created") {
    const userId = payload.data.id;
    const clerk = createClerkClient({ secretKey: env.CLERK_SECRET_KEY });

    // Only set the role if it's not already set (avoid overwriting manual changes)
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

async function handleSetRole(request, env) {
  const clerk = createClerkClient({ secretKey: env.CLERK_SECRET_KEY });

  // Verify the caller is signed in and is an executive
  const session = await clerk.authenticateRequest(request, {
    secretKey: env.CLERK_SECRET_KEY,
  });

  if (!session.isSignedIn) {
    return new Response("Unauthorized", { status: 401 });
  }

  const caller = await clerk.users.getUser(session.userId);
  const callerRole = caller.privateMetadata?.role || DEFAULT_ROLE;

  if (callerRole !== "executive") {
    return new Response("Forbidden — only executives can change roles", { status: 403 });
  }

  // Parse the request body
  const { userId, role } = await request.json();

  // Validate the role
  const validRoles = Object.keys(ROLE_PERMISSIONS);
  if (!validRoles.includes(role)) {
    return new Response(
      `Invalid role. Valid roles: ${validRoles.join(", ")}`,
      { status: 400 }
    );
  }

  // Update the user's role in Clerk
  await clerk.users.updateUser(userId, {
    privateMetadata: { role },
  });

  return Response.json({
    success: true,
    userId,
    newRole: role,
  });
}

