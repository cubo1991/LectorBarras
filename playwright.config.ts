import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  reporter: "list",
  // El dev server de Turbopack compila cada ruta la primera vez que se pide, y
  // el disco de este proyecto es lento: los defaults (30s/5s) no alcanzan.
  timeout: 90_000,
  expect: { timeout: 15_000 },
  // Con los workers por defecto (mitad de los cores) cada uno levanta su propio
  // Chromium y todos compiten por el mismo dev server: 12 de 14 tests se caían
  // por timeout navegando. Con 2 el suite es estable.
  workers: 2,
  use: {
    baseURL: "http://localhost:3000",
  },
  projects: [
    // Todo el suite de flujos corre en desktop; el responsive tiene su propio proyecto.
    { name: "chromium", testIgnore: /responsive\.spec\.ts/, use: { ...devices["Desktop Chrome"] } },
    // Celular chico (360x740, touch). Sólo corre las verificaciones de responsive: no
    // duplica los flujos, que ya cubre "chromium".
    {
      name: "mobile",
      testMatch: /responsive\.spec\.ts/,
      use: { ...devices["Desktop Chrome"], viewport: { width: 360, height: 740 }, hasTouch: true, isMobile: true },
    },
  ],
  webServer: {
    // Build de producción, no `next dev`: con el dev server cada ruta se compila
    // en el primer request (decenas de segundos en este disco) y el evento
    // `load` no llegaba a tiempo, además de dejar ventanas donde el click cae
    // antes de que React hidrate y el form hace un GET nativo.
    command: "npm run build && npm run start",
    url: "http://localhost:3000",
    reuseExistingServer: !process.env.CI,
    timeout: 300_000,
    env: {
      // En producción Auth.js exige confiar el host explícitamente (en Vercel lo
      // hace solo). Sin esto, `next start` en localhost responde UntrustedHost y
      // todo login termina en /api/auth/error.
      AUTH_TRUST_HOST: "true",
    },
  },
});
