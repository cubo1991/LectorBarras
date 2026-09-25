import { expect, test } from "@playwright/test";
import { registerAndLogin } from "./helpers";

test("sin sesión, la home redirige a /login", async ({ page }) => {
  await page.goto("/");
  await expect(page).toHaveURL(/\/login$/);
  await expect(page).toHaveTitle("LectorBarras");
});

test("con sesión, la home ofrece escanear y buscar, y no es el template de Next", async ({ page }) => {
  const { email } = await registerAndLogin(page);

  await expect(page.getByRole("heading", { name: "Inicio" })).toBeVisible();
  await expect(page.getByText(email)).toBeVisible();
  await expect(page.getByText(/To get started, edit the/)).toHaveCount(0);

  await page.getByRole("link", { name: /Escanear producto/ }).click();
  await expect(page).toHaveURL(/\/scan$/);

  await page.getByRole("navigation", { name: "Principal" }).getByRole("link", { name: "Productos" }).click();
  await expect(page).toHaveURL(/\/products$/);
  await expect(page.getByRole("link", { name: "Productos" })).toHaveAttribute("aria-current", "page");
});

test("el manifest y los íconos son públicos (sin sesión) y válidos para instalar", async ({ request }) => {
  const response = await request.get("/manifest.webmanifest", { maxRedirects: 0 });
  expect(response.status()).toBe(200);

  const manifest = await response.json();
  expect(manifest).toMatchObject({ name: "LectorBarras", display: "standalone", start_url: "/" });

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
