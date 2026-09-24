import { expect, test } from "@playwright/test";
import { createProduct, E2E_PRODUCT_PREFIX, registerAndLogin } from "./helpers";

test("busca un producto por nombre parcial", async ({ page }) => {
  await registerAndLogin(page);
  const marker = `Busqueda${Date.now()}`;
  await createProduct(page, { name: marker, stock: 4 });

  await page.goto("/products");
  await page.getByPlaceholder("Nombre o código").fill(marker);
  await page.getByRole("button", { name: "Buscar" }).click();

  await expect(page.getByText(`${E2E_PRODUCT_PREFIX} ${marker}`)).toBeVisible();
  await expect(page.getByText("Stock: 4")).toBeVisible();
});

test("busca un producto por código exacto", async ({ page }) => {
  await registerAndLogin(page);
  const barcode = await createProduct(page, { name: "PorCodigo", stock: 7 });

  await page.goto("/products");
  await page.getByPlaceholder("Nombre o código").fill(barcode);
  await page.getByRole("button", { name: "Buscar" }).click();

  await expect(page.getByText(`Código: ${barcode}`)).toBeVisible();
});

test("informa cuando no hay coincidencias", async ({ page }) => {
  await registerAndLogin(page);

  await page.goto("/products");
  await page.getByPlaceholder("Nombre o código").fill("zzz-no-existe-nada");
  await page.getByRole("button", { name: "Buscar" }).click();

  await expect(page.getByText(/No hay productos que coincidan/)).toBeVisible();
});

test("desde un resultado se llega al ajuste de stock", async ({ page }) => {
  await registerAndLogin(page);
  const marker = `Detalle${Date.now()}`;
  const barcode = await createProduct(page, { name: marker, stock: 2 });

  await page.goto("/products");
  await page.getByPlaceholder("Nombre o código").fill(marker);
  await page.getByRole("button", { name: "Buscar" }).click();

  await page.getByRole("link", { name: new RegExp(marker) }).click();

  await expect(page).toHaveURL(`/scan?code=${barcode}`);
  await expect(page.getByText("Stock actual: 2")).toBeVisible();

  await page.getByRole("button", { name: "+1" }).click();
  await expect(page.getByText("Stock actual: 3")).toBeVisible();
});

test("el listado pagina y no trae todo el catálogo de una", async ({ page }) => {
  await registerAndLogin(page);

  await page.goto("/products");

  // El catálogo de la DB de desarrollo tiene >100 productos sembrados.
  const items = page.getByRole("listitem");
  await expect(items).toHaveCount(20);
  await expect(page.getByText(/Página 1 de \d+/)).toBeVisible();

  await page.getByRole("link", { name: "Siguiente" }).click();
  await expect(page.getByText(/Página 2 de \d+/)).toBeVisible();
});
