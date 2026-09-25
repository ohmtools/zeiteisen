import path from "path";
import { defineConfig } from "vitest/config";

// The tests cover the pure logic in `src/lib` and `src/overlap.ts` only, so no
// browser environment and none of the app's Vite plugins are needed. The `@`
// alias has to match the one in `vite.config.ts`.
export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "./src"),
      "@paraglide": path.resolve(import.meta.dirname, "./generated/paraglide"),
    },
  },
  test: {
    include: ["src/**/*.test.ts"],
    environment: "node",
    // Paraglide reads the locale from `localStorage`, which a node run has not.
    setupFiles: ["./src/test-setup.ts"],
  },
});
