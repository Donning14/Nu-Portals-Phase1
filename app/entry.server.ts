import { createRequestHandler } from "react-router";

export default {
  async fetch(request, env) {
    const loadContext = {
      env,
    };
    return createRequestHandler(
      await import("virtual:react-router/server-build"),
      "production"
    )(request, loadContext);
  },
};
