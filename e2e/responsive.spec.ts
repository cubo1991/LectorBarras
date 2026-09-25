import { expect, test, type Page } from "@playwright/test";
import { createProduct, registerAndLogin } from "./helpers";

// Proyecto `mobile` (360x740, touch). Criterios de SPEC-front.md:
//   - ninguna pantalla tiene scroll horizontal
//   - todo control interactivo mide al menos 44x44 px (WCAG 2.5.5)
const MIN_TARGET = 44;

async function expectNoHorizontalScroll(page: Page) {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow, "scroll horizontal (px de más)").toBeLessThanOrEqual(0);
}

async function expectTargetsBigEnough(page: Page) {
  const tooSmall = await page.evaluate((min) => {
    const controls = document.querySelectorAll("a[href], button, input:not([type=hidden]), select, textarea");
    return [...controls]
      .map((el) => ({ el, box: el.getBoundingClientRect() }))
      .filter(({ box }) => box.width > 0 && box.height > 0) // sólo los visibles
      .filter(({ box }) => box.width < min || box.height < min)
      .map(({ el, box }) => `${el.tagName.toLowerCase()} "${(el.textContent ?? "").trim().slice(0, 30)}" ${Math.round(box.width)}x${Math.round(box.height)}`);
  }, MIN_TARGET);
  expect(tooSmall, "controles menores a 44x44").toEqual([]);
}

async function check(page: Page) {
  await expectNoHorizontalScroll(page);
  await expectTargetsBigEnough(page);
}

test("pantallas públicas: /login y /register", async ({ page }) => {
  for (const path of ["/login", "/register"]) {
    await page.goto(path);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await check(page);
  }
});

test("pantallas autenticadas: home, /scan y /products", async ({ page }) => {
  await registerAndLogin(page);

  for (const path of ["/scan", "/products"]) {
    await page.goto(path);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await check(page);
  }

  // Estados con más controles que la pantalla vacía: ficha con -1/+1 y "Sin stock".
  await createProduct(page, { name: "responsive", stock: 0 });
  await expect(page.getByText("Sin stock")).toBeVisible();
  await check(page);

  // Con el aviso de "Deshacer" visible: no debe desbordar ni traer controles chicos.
  await page.getByRole("button", { name: "+1", exact: true }).click();
  await expect(page.getByRole("button", { name: "Deshacer" })).toBeVisible();
  await check(page);
});
