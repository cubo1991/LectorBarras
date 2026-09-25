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

test.describe("deshacer", () => {
  test("tras un ajuste aparece 'stock anterior → nuevo · Deshacer' y deshacer restaura el stock", async ({ page }) => {
    await registerAndLogin(page);
    await createProduct(page, { name: "Deshacer", stock: 2 });

    await page.getByRole("button", { name: "+5", exact: true }).click();
    await expect(page.getByText("Stock actual: 7")).toBeVisible();
    await expect(page.getByText(/\[E2E\] Deshacer: 2 → 7/)).toBeVisible();

    await page.getByRole("button", { name: "Deshacer" }).click();

    await expect(page.getByText("Stock actual: 2")).toBeVisible();
    await expect(page.getByRole("button", { name: "Deshacer" })).toHaveCount(0);
    await expect(page.getByTestId("stock-announcement")).toContainText("Se deshizo el ajuste");
  });

  test("el aviso desaparece solo a los ~6 s", async ({ page }) => {
    await registerAndLogin(page);
    await createProduct(page, { name: "Desaparece", stock: 1 });

    await page.getByRole("button", { name: "+1", exact: true }).click();
    await expect(page.getByRole("button", { name: "Deshacer" })).toBeVisible();

    await expect(page.getByRole("button", { name: "Deshacer" })).toBeHidden({ timeout: 9_000 });
  });

  test("no desaparece mientras el foco está en 'Deshacer'", async ({ page }) => {
    await registerAndLogin(page);
    await createProduct(page, { name: "Con foco", stock: 1 });

    await page.getByRole("button", { name: "+1", exact: true }).click();
    const undo = page.getByRole("button", { name: "Deshacer" });
    await undo.focus();

    await page.waitForTimeout(7_500); // más que los 6 s
    await expect(undo).toBeVisible();

    // Al soltar el foco, vuelve a contar y se va.
    await page.getByRole("heading", { level: 1 }).click();
    await expect(undo).toBeHidden({ timeout: 9_000 });
  });

  test("si otra persona movió el stock y el inverso dejaría negativo, avisa y no lo aplica", async ({
    page,
    browser,
  }) => {
    await registerAndLogin(page);
    const barcode = await createProduct(page, { name: "Otro usuario", stock: 3 });

    await page.getByRole("button", { name: "+10", exact: true }).click();
    await expect(page.getByText("Stock actual: 13")).toBeVisible();
    const undo = page.getByRole("button", { name: "Deshacer" });
    await undo.focus(); // el aviso queda mientras la otra persona trabaja

    // Otra persona (otra sesión) resta 12 → el stock queda en 1.
    const otherContext = await browser.newContext();
    const other = await otherContext.newPage();
    await registerAndLogin(other);
    await other.goto(`/scan?code=${barcode}`);
    await expect(other.getByText("Stock actual: 13")).toBeVisible();
    await other.getByLabel("Otra cantidad").fill("12");
    await other.getByRole("button", { name: "Restar" }).click();
    await expect(other.getByText("Stock actual: 1")).toBeVisible();
    await otherContext.close();

    // Deshacer +10 dejaría 1 - 10 < 0: se informa y el stock no se toca.
    await undo.click();
    await expect(page.getByText("El stock cambió: no se puede deshacer")).toBeVisible();
    await page.getByRole("button", { name: "+1", exact: true }).click(); // fuerza refrescar el número visible
    await expect(page.getByText("Stock actual: 2")).toBeVisible();
  });
});

test("si la búsqueda falla (sesión vencida o sin red), el aviso ofrece volver a iniciar sesión", async ({ page }) => {
  await registerAndLogin(page);
  await page.goto("/scan");
  await page.route("**/scan", (route) => (route.request().method() === "POST" ? route.abort() : route.continue()));

  await page.getByPlaceholder("Ingresar código manualmente").fill("7791234567890");
  await page.getByRole("button", { name: "Buscar" }).click();

  await expect(page.getByText("No pudimos buscar el producto.")).toBeVisible();
  const link = page.getByRole("link", { name: "Volver a iniciar sesión" });
  await expect(link).toHaveAttribute("href", "/login");
});
