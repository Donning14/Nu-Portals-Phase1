import { createRequestHandler, RouterContextProvider } from "react-router";
import { api } from "../server/api";

const requestHandler = createRequestHandler(
  () => import("virtual:react-router/server-build"),
  import.meta.env.MODE
);

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext) {
    const url = new URL(request.url);
    const path = url.pathname;

    // Minimal webhook test — just return 200 OK
    if (path === "/api/clerk-webhook" && request.method === "POST") {
      console.log("WEBHOOK HIT — returning 200 OK");
      return new Response("OK", { status: 200 });
    }

    // Everything else — original behavior
    if (path.startsWith("/api/")) {
      return api.fetch(request, env, ctx);
    }

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
