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
