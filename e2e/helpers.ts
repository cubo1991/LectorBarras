import { expect, type Page } from "@playwright/test";

/**
 * Los e2e corren contra la DB de desarrollo. Todo lo que crean queda etiquetado
 * con estos prefijos para poder limpiarlo:
 *   delete from products where name like '[E2E]%';
 *   delete from users where email like 'e2e-%@example.test';
 */
export const E2E_PRODUCT_PREFIX = "[E2E]";

let sequence = 0;

/** Código numérico de 13 dígitos, único: `products.barcode` tiene índice único. */
export function uniqueBarcode(): string {
  sequence += 1;
  const tail = `${Date.now()}${sequence}`.slice(-12);
  return `9${tail}`;
}

export function uniqueEmail(): string {
  return `e2e-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@example.test`;
}

const PASSWORD = "contrasena-e2e-123";

export async function register(page: Page): Promise<{ email: string; password: string }> {
  const email = uniqueEmail();

  await page.goto("/register");
  await page.getByPlaceholder("Email").fill(email);
  await page.getByPlaceholder(/Contraseña/).fill(PASSWORD);
  await page.getByRole("button", { name: "Registrarme" }).click();

  await expect(page).toHaveURL(/\/login$/);
  return { email, password: PASSWORD };
}

export async function login(page: Page, email: string, password: string) {
  await page.goto("/login");
  await page.getByPlaceholder("Email").fill(email);
  await page.getByPlaceholder("Contraseña").fill(password);
  await page.getByRole("button", { name: "Entrar" }).click();

  await expect(page).toHaveURL("/");
}

export async function registerAndLogin(page: Page) {
  const { email, password } = await register(page);
  await login(page, email, password);
  return { email, password };
}

/**
 * Da de alta un producto desde `/scan` usando el ingreso manual del código
 * (headless no tiene cámara, que es justamente el fallback que queremos ejercitar).
 */
export async function createProduct(
  page: Page,
  { name, stock, barcode = uniqueBarcode() }: { name: string; stock: number; barcode?: string },
): Promise<string> {

  await page.goto("/scan");
  await page.getByPlaceholder("Ingresar código manualmente").fill(barcode);
  await page.getByRole("button", { name: "Buscar" }).click();

  await expect(page.getByText(`El código ${barcode} todavía no está cargado`)).toBeVisible();

  await page.getByPlaceholder("Nombre del producto").fill(`${E2E_PRODUCT_PREFIX} ${name}`);
  await page.getByPlaceholder("Stock inicial").fill(String(stock));
  await page.getByRole("button", { name: "Cargar producto" }).click();

  await expect(page.getByText(`Stock actual: ${stock}`)).toBeVisible();
  return barcode;
}
