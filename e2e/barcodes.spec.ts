import { expect, test, type Page } from "@playwright/test";
import { createProduct, E2E_PRODUCT_PREFIX, registerAndLogin, uniqueBarcode } from "./helpers";

async function lookup(page: Page, code: string) {
  await page.goto("/scan");
  await page.getByPlaceholder("Ingresar código manualmente").fill(code);
  await page.getByRole("button", { name: "Buscar" }).click();
}

test("un código alfanumérico (Code 128 / etiqueta propia) se da de alta y se vuelve a encontrar", async ({ page }) => {
  await registerAndLogin(page);
  const code = `ABC-${Date.now()}`;

  await createProduct(page, { name: "alfanumerico", stock: 3, barcode: code });

  await lookup(page, code);
  await expect(page.getByText(`Código: ${code}`)).toBeVisible();
  await expect(page.getByText("Stock actual: 3")).toBeVisible();
});

test("un UPC-A de 12 dígitos y su EAN-13 equivalente son el mismo producto", async ({ page }) => {
  await registerAndLogin(page);
  const upcA = uniqueBarcode().slice(1); // 12 dígitos
  const ean13 = `0${upcA}`;

  // Se da de alta con 12 dígitos y queda guardado en su forma canónica (GTIN-13).
  await lookup(page, upcA);
  await expect(page.getByText(`No existe un producto con el código ${ean13}`)).toBeVisible();
  await page.getByPlaceholder("Nombre del producto").fill(`${E2E_PRODUCT_PREFIX} upc`);
  await page.getByPlaceholder("Stock inicial").fill("2");
  await page.getByRole("button", { name: "Dar de alta" }).click();
  await expect(page.getByText(`Código: ${ean13}`)).toBeVisible();

  // Buscarlo por el EAN-13 o por los 12 dígitos encuentra el mismo producto.
  for (const code of [ean13, upcA]) {
    await lookup(page, code);
    await expect(page.getByText("Stock actual: 2")).toBeVisible();
  }
});

test("el ingreso manual rechaza un código demasiado corto", async ({ page }) => {
  await registerAndLogin(page);

  await lookup(page, "abc");

  await expect(page.getByText(/entre 4 y 64|4 a 64/)).toBeVisible();
});
