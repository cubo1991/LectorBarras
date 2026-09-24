import { expect, test } from "@playwright/test";
import { login, register, registerAndLogin } from "./helpers";

test("un usuario nuevo se registra y se loguea", async ({ page }) => {
  await registerAndLogin(page);

  // Estar en "/" sin ser pateado a /login es la prueba de que hay sesión.
  await expect(page).toHaveURL("/");
});

test("rechaza una contraseña incorrecta", async ({ page }) => {
  const { email } = await register(page);

  await page.goto("/login");
  await page.getByPlaceholder("Email").fill(email);
  await page.getByPlaceholder("Contraseña").fill("contrasena-equivocada");
  await page.getByRole("button", { name: "Entrar" }).click();

  await expect(page.getByText("Email o contraseña incorrectos")).toBeVisible();
  await expect(page).toHaveURL(/\/login$/);
});

test("una ruta protegida redirige a /login sin sesión", async ({ page }) => {
  await page.goto("/products");

  await expect(page).toHaveURL(/\/login/);
});

test("cierra sesión desde la app y vuelve a entrar", async ({ page }) => {
  const { email, password } = await register(page);
  await login(page, email, password);

  await page.goto("/scan");
  await page.getByRole("button", { name: "Cerrar sesión" }).click();
  await expect(page).toHaveURL(/\/login/);

  // Sin sesión, una ruta protegida no debe dejar pasar.
  await page.goto("/products");
  await expect(page).toHaveURL(/\/login/);

  await login(page, email, password);
  await expect(page).toHaveURL("/");
});

test("la contraseña no viaja en la URL si el form se envía sin hidratar", async ({ page }) => {
  // Bloquear los bundles reproduce de forma determinista la ventana previa a la
  // hidratación, que es cuando el form hacía un GET con la contraseña visible.
  await page.route("**/*.js", (route) => route.abort());

  await page.goto("/login");
  await page.getByPlaceholder("Email").fill("alguien@example.test");
  await page.getByPlaceholder("Contraseña").fill("secreto-que-no-debe-filtrarse");
  await page.getByRole("button", { name: "Entrar" }).click();

  await expect(page).not.toHaveURL(/password=/);
  expect(page.url()).not.toContain("secreto-que-no-debe-filtrarse");
});
