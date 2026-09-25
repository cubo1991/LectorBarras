import { expect, test } from "@playwright/test";
import { registerAndLogin } from "./helpers";

test("sin sesión, la home redirige a /login", async ({ page }) => {
  await page.goto("/");
  await expect(page).toHaveURL(/\/login$/);
  await expect(page).toHaveTitle("LectorBarras");
});

test("con sesión, el login aterriza en el escáner y `/` lleva ahí", async ({ page }) => {
  await registerAndLogin(page); // aterriza en /scan (lo verifica el helper)
  await expect(page.getByRole("heading", { name: "Escanear producto" })).toBeVisible();

  await page.goto("/");
  await expect(page).toHaveURL(/\/scan$/);
});

test("la navegación tiene sólo Escanear y Productos y marca la sección activa", async ({ page }) => {
  await registerAndLogin(page);
  const nav = page.getByRole("navigation", { name: "Principal" });

  await expect(nav.getByRole("link")).toHaveText(["Escanear", "Productos"]); // sin "Inicio"
  await expect(nav.getByRole("link", { name: "Escanear" })).toHaveAttribute("aria-current", "page");

  await nav.getByRole("link", { name: "Productos" }).click();
  await expect(page).toHaveURL(/\/products$/);
  await expect(nav.getByRole("link", { name: "Productos" })).toHaveAttribute("aria-current", "page");
  await expect(nav.getByRole("link", { name: "Escanear" })).not.toHaveAttribute("aria-current", "page");
});

test("el manifest y los íconos son públicos (sin sesión) y válidos para instalar", async ({ request }) => {
  const response = await request.get("/manifest.webmanifest", { maxRedirects: 0 });
  expect(response.status()).toBe(200);

  const manifest = await response.json();
  expect(manifest).toMatchObject({ name: "LectorBarras", display: "standalone", start_url: "/scan" });

  // Chrome exige un ícono de 192 y otro de 512 para ofrecer "instalar".
  const sizes = manifest.icons.map((icon: { sizes: string }) => icon.sizes);
  expect(sizes).toEqual(expect.arrayContaining(["192x192", "512x512"]));
  expect(manifest.icons.some((icon: { purpose?: string }) => icon.purpose === "maskable")).toBe(true);

  for (const icon of manifest.icons as { src: string }[]) {
    const image = await request.get(icon.src, { maxRedirects: 0 });
    expect(image.status(), icon.src).toBe(200);
    expect(image.headers()["content-type"]).toContain("image/png");
  }
});
