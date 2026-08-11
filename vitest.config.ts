import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  test: {
    include: ["tests/**/*.test.ts"],
    environment: "node",
  },
  resolve: {
    alias: {
      // Next.js server-only guard is a no-op under vitest.
      "server-only": path.resolve(__dirname, "tests/stubs/server-only.ts"),
      "@": path.resolve(__dirname, "src"),
    },
  },
});
