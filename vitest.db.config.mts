import path from "node:path";
import { defineConfig } from "vitest/config";

// Tests contra la base REAL (la de desarrollo): `npm run test:db`. Aparte de `npm test`
// porque necesitan DATABASE_URL de verdad y escriben datos (etiquetados y limpiados).
export default defineConfig({
  resolve: {
    alias: { "@": path.resolve(import.meta.dirname, "./src") },
  },
  test: {
    environment: "node",
    include: ["src/**/*.db.test.ts"],
    testTimeout: 60_000,
    hookTimeout: 60_000,
  },
});
