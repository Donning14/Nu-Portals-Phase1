import { createRequestHandler } from "react-router";
// @ts-ignore
import * as build from "../build/server/index.js";
import { api } from "../server/api";

const handler = createRequestHandler(build, "production");

export default {
  async fetch(request, env, ctx) {
    if (new URL(request.url).pathname.startsWith("/api/")) {
      return api.fetch(request, env, ctx);
    }
    return handler(request, { cloudflare: { env, ctx } });
  },
} satisfies ExportedHandler<Env>;
