import { expect, test } from "@playwright/test";
import { createProduct, registerAndLogin } from "./helpers";

test("da de alta un producto y ajusta su stock", async ({ page }) => {
  await registerAndLogin(page);

  const barcode = await createProduct(page, { name: "Ajuste", stock: 5 });

  await expect(page.getByText(`Código: ${barcode}`)).toBeVisible();

  await page.getByRole("button", { name: "+1" }).click();
  await expect(page.getByText("Stock actual: 6")).toBeVisible();

  await page.getByRole("button", { name: "-1" }).click();
  await expect(page.getByText("Stock actual: 5")).toBeVisible();
});

test("no deja que el stock quede negativo", async ({ page }) => {
  await registerAndLogin(page);

  await createProduct(page, { name: "Sin stock", stock: 0 });

  await page.getByRole("button", { name: "-1" }).click();

  await expect(page.getByText("No hay stock suficiente")).toBeVisible();
  await expect(page.getByText("Stock actual: 0")).toBeVisible();
});

test("el ajuste persiste al volver a buscar el código", async ({ page }) => {
  await registerAndLogin(page);

  const barcode = await createProduct(page, { name: "Persistencia", stock: 1 });

  await page.getByRole("button", { name: "+1" }).click();
  await expect(page.getByText("Stock actual: 2")).toBeVisible();

  await page.getByPlaceholder("Ingresar código manualmente").fill(barcode);
  await page.getByRole("button", { name: "Buscar" }).click();

  await expect(page.getByText("Stock actual: 2")).toBeVisible();
});

test("un código ya existente no se puede dar de alta dos veces", async ({ page }) => {
  await registerAndLogin(page);

  const barcode = await createProduct(page, { name: "Duplicado", stock: 3 });

  // Volver a buscarlo debe mostrar la ficha, no el formulario de alta.
  await page.getByPlaceholder("Ingresar código manualmente").fill(barcode);
  await page.getByRole("button", { name: "Buscar" }).click();

  await expect(page.getByText("Stock actual: 3")).toBeVisible();
  await expect(page.getByRole("button", { name: "Dar de alta" })).toHaveCount(0);
});
