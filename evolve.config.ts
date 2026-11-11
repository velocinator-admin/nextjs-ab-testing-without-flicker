import { defineConfig } from "next-evolve/config";

export default defineConfig({
  // Pages Evolve may test. "static": cached per variant (moved under app/[evolve]/).
  // "dynamic": rendered per request, the page stays where it is.
  routes: {
    "/": { mode: "static" },
  },
});
