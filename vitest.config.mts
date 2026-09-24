import path from "node:path";
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: { "@": path.resolve(import.meta.dirname, "./src") },
  },
  test: {
    environment: "jsdom",
    setupFiles: ["./vitest.setup.ts"],
    include: ["tests/**/*.test.{ts,tsx}", "src/**/*.test.{ts,tsx}"],
    env: {
      // dummy: el driver de Neon exige la variable al construirse, aunque
      // estos tests no lleguen a hacer una query real.
      DATABASE_URL: "postgres://user:pass@localhost/test",
    },
  },
});
