import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: false,
    environment: "node",
    server: {
      deps: {
        // node:sqlite is a Node 22 experimental built-in; tell Vitest not to bundle it.
        external: [/^node:/],
      },
    },
  },
});
