import { expect, test } from "@playwright/test";
import { createProduct, registerAndLogin } from "./helpers";

test("da de alta un producto y ajusta su stock", async ({ page }) => {
  await registerAndLogin(page);

  const barcode = await createProduct(page, { name: "Ajuste", stock: 5 });

  await expect(page.getByText(`Código: ${barcode}`)).toBeVisible();

  await page.getByRole("button", { name: "+1", exact: true }).click();
  await expect(page.getByText("Stock actual: 6")).toBeVisible();

  await page.getByRole("button", { name: "-1", exact: true }).click();
  await expect(page.getByText("Stock actual: 5")).toBeVisible();
});

test("no deja que el stock quede negativo", async ({ page }) => {
  await registerAndLogin(page);

  await createProduct(page, { name: "Sin stock", stock: 0 });

  await page.getByRole("button", { name: "-1", exact: true }).click();

  await expect(page.getByText("No hay stock suficiente")).toBeVisible();
  await expect(page.getByText("Stock actual: 0")).toBeVisible();
});

test("el ajuste persiste al volver a buscar el código", async ({ page }) => {
  await registerAndLogin(page);

  const barcode = await createProduct(page, { name: "Persistencia", stock: 1 });

  await page.getByRole("button", { name: "+1", exact: true }).click();
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

test("+5 y +10 suman esas cantidades", async ({ page }) => {
  await registerAndLogin(page);
  await createProduct(page, { name: "Cantidades", stock: 1 });

  await page.getByRole("button", { name: "+5", exact: true }).click();
  await expect(page.getByText("Stock actual: 6")).toBeVisible();

  await page.getByRole("button", { name: "+10", exact: true }).click();
  await expect(page.getByText("Stock actual: 16")).toBeVisible();
});

test("'Otra cantidad' suma y resta un número libre (una caja de 24)", async ({ page }) => {
  await registerAndLogin(page);
  await createProduct(page, { name: "Otra cantidad", stock: 3 });

  await page.getByLabel("Otra cantidad").fill("24");
  await page.getByRole("button", { name: "Sumar" }).click();
  await expect(page.getByText("Stock actual: 27")).toBeVisible();
  await expect(page.getByLabel("Otra cantidad")).toHaveValue(""); // se limpia tras aplicarse

  await page.getByLabel("Otra cantidad").fill("20");
  await page.getByRole("button", { name: "Restar" }).click();
  await expect(page.getByText("Stock actual: 7")).toBeVisible();
});

test("'Otra cantidad' rechaza 0, vacío, no numérico y más de 9999, sin tocar el stock", async ({ page }) => {
  await registerAndLogin(page);
  await createProduct(page, { name: "Validacion", stock: 5 });

  for (const invalid of ["", "0", "abc", "-3", "1.5", "10000"]) {
    await page.getByLabel("Otra cantidad").fill(invalid);
    await page.getByRole("button", { name: "Sumar" }).click();
    await expect(page.getByText("Ingresá una cantidad entera entre 1 y 9999"), invalid).toBeVisible();
  }
  await expect(page.getByText("Stock actual: 5")).toBeVisible();
});

test("restar con 'Otra cantidad' más de lo que hay avisa y no cambia el stock", async ({ page }) => {
  await registerAndLogin(page);
  await createProduct(page, { name: "Sin margen", stock: 3 });

  await page.getByLabel("Otra cantidad").fill("500");
  await page.getByRole("button", { name: "Restar" }).click();

  await expect(page.getByText("No hay stock suficiente")).toBeVisible();
  await expect(page.getByText("Stock actual: 3")).toBeVisible();
});

test("cada ajuste se anuncia a los lectores de pantalla", async ({ page }) => {
  await registerAndLogin(page);
  await createProduct(page, { name: "Anuncio", stock: 2 });
  const announcement = page.getByTestId("stock-announcement");

  await page.getByRole("button", { name: "+5", exact: true }).click();

  await expect(announcement).toContainText("Anuncio: stock actualizado a 7");
  await expect(announcement).toHaveAttribute("role", "status");
});
