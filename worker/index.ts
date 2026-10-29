import { createRequestHandler } from "react-router";
import { api } from "../server/api";

const requestHandler = createRequestHandler(
  () => import("virtual:react-router/server-build"),
  "development"  // ← Changed from import.meta.env.MODE
);

export default {
  async fetch(request, env, ctx) {
    if (new URL(request.url).pathname.startsWith("/api/")) {
      return api.fetch(request, env, ctx);
    }
    try {
      const response = await requestHandler(request, {
        cloudflare: { env, ctx },
      });
      if (!response.ok) {
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
