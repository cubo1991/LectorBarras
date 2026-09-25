import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { createProduct, registerAndLogin, uniqueBarcode } from "./helpers";

// WCAG 2.1 AA (SPEC-front.md, criterio 4): cada pantalla, en claro y en oscuro.
// Las violaciones se corrigen en el código o en los tokens; no se excluyen reglas.
const TAGS = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"];

async function expectNoViolations(page: Page, screen: string) {
  // Que el esquema emulado sea el pedido: si no, "dark" estaría probando claro.
  const dark = await page.evaluate(() => matchMedia("(prefers-color-scheme: dark)").matches);
  expect(dark).toBe(test.info().titlePath.some((t) => t.includes("dark")));
  const { violations } = await new AxeBuilder({ page }).withTags(TAGS).analyze();
  const summary = violations.map(
    (v) => `${v.id} (${v.impact}): ${v.help}\n    ${v.nodes.map((n) => n.target.join(" ")).join("\n    ")}`,
  );
  expect(summary, `violaciones en ${screen}`).toEqual([]);
}

for (const colorScheme of ["light", "dark"] as const) {
  test.describe(`esquema ${colorScheme}`, () => {
    test.use({ colorScheme });

    test("pantallas públicas: /login y /register", async ({ page }) => {
      for (const path of ["/login", "/register"]) {
        await page.goto(path);
        await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
        await expectNoViolations(page, path);
      }
    });

    test("pantallas autenticadas: home, /scan, /products, ficha y alta", async ({ page }) => {
      await registerAndLogin(page);

      for (const path of ["/", "/scan", "/products"]) {
        await page.goto(path);
        await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
        await expectNoViolations(page, path);
      }

      // Alta: el formulario de un código que no existe.
      await page.goto("/scan");
      await page.getByPlaceholder("Ingresar código manualmente").fill(uniqueBarcode());
      await page.getByRole("button", { name: "Buscar" }).click();
      await expect(page.getByPlaceholder("Nombre del producto")).toBeVisible();
      await expectNoViolations(page, "/scan (alta de producto)");

      // Ficha con "Sin stock" y error de stock negativo.
      await createProduct(page, { name: "a11y", stock: 0 });
      await page.getByRole("button", { name: "-1", exact: true }).click();
      await expect(page.getByText("No hay stock suficiente")).toBeVisible();
      await expectNoViolations(page, "/scan (ficha con Sin stock y error)");

      // Con el aviso de "Deshacer" a la vista (posición fija sobre la barra de navegación).
      await page.getByRole("button", { name: "+1", exact: true }).click();
      await expect(page.getByRole("button", { name: "Deshacer" })).toBeVisible();
      await expectNoViolations(page, "/scan (con el aviso de deshacer)");
    });
  });
}
