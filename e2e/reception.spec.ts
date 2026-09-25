import { expect, test } from "./fixtures/camera";
import type { Page } from "@playwright/test";
import { readCodes } from "./fixtures/make-videos";
import { createProduct, registerAndLogin } from "./helpers";

// Modo "Sumar al escanear" (recepción de mercadería por unidad) con la cámara falsa.
// Todos comparten UN producto, creado una vez; cada test compara el stock ANTES y DESPUÉS
// leyéndolo por `/scan?code=` desde una página sin cámara, así lo que se verifica es lo
// que quedó en la base y no lo que muestra la pantalla de la cámara.

test.describe.configure({ mode: "serial" });

const READ_TIMEOUT = 20_000;
let basePage: Page; // sin cámara: crea el producto y lee el stock
let code: string;

test.beforeAll(async ({ browser }) => {
  code = readCodes().reception;
  basePage = await (await browser.newContext()).newPage();
  await registerAndLogin(basePage);
  await createProduct(basePage, { name: "Recepcion", stock: 5, barcode: code });
});

test.afterAll(async () => {
  await basePage.context().close();
});

async function stockInDb(): Promise<number> {
  await basePage.goto(`/scan?code=${code}`);
  const text = await basePage.getByText(/Stock actual: \d+/).innerText();
  return Number(/(\d+)/.exec(text)![1]);
}

/** Enciende "Sumar al escanear" (reintenta el clic por si la página aún no hidrató). */
async function turnOnSumMode(page: Page) {
  const sw = page.getByRole("switch", { name: "Sumar al escanear" });
  await expect(async () => {
    await sw.click();
    await expect(sw).toHaveAttribute("aria-checked", "true", { timeout: 1_000 });
  }).toPass({ timeout: 10_000 });
  await expect(page.getByText("Modo suma: cada lectura suma +1")).toBeVisible();
}

test("en modo Consulta (por defecto) escanear un producto conocido NO cambia su stock", async ({ cameraPage }) => {
  const before = await stockInDb();
  const page = await cameraPage("receptionPulse");
  await registerAndLogin(page);

  await page.goto("/scan");
  await expect(page.getByRole("switch", { name: "Sumar al escanear" })).toHaveAttribute("aria-checked", "false");
  await expect(page.getByText(`Stock actual: ${before}`)).toBeVisible({ timeout: READ_TIMEOUT });
  await page.waitForTimeout(9_000); // más de dos presentaciones del código

  expect(await stockInDb()).toBe(before);
  await expect(page.getByRole("button", { name: /Deshacer/ })).toHaveCount(0);
});

test("en modo Suma, un código quieto a la vista suma exactamente +1 (no una vez por lectura)", async ({
  cameraPage,
}) => {
  const before = await stockInDb();
  const page = await cameraPage("receptionStatic");
  await registerAndLogin(page);

  await page.goto("/scan");
  await turnOnSumMode(page);
  await expect(page.getByText(/Recepcion .*\+1 · stock/)).toBeVisible({ timeout: READ_TIMEOUT });

  await page.waitForTimeout(5_000); // ≈ 15 confirmaciones posibles con el código quieto
  expect(await stockInDb()).toBe(before + 1);
});

test("'Deshacer último' resta esa unidad", async ({ cameraPage }) => {
  const before = await stockInDb();
  const page = await cameraPage("receptionStatic");
  await registerAndLogin(page);

  await page.goto("/scan");
  await turnOnSumMode(page);
  const undo = page.getByRole("button", { name: "Deshacer último" });
  await expect(undo).toBeVisible({ timeout: READ_TIMEOUT });
  await undo.click();

  await expect(undo).toBeHidden();
  expect(await stockInDb()).toBe(before); // sumó 1 y lo deshizo
});

test("cada vez que el código se retira y vuelve a mostrarse suma otra unidad, y el aviso acumula '+2'", async ({
  cameraPage,
}) => {
  const before = await stockInDb();
  const page = await cameraPage("receptionPulse"); // 2 s a la vista, 2 s vacío, en bucle
  await registerAndLogin(page);

  await page.goto("/scan");
  await turnOnSumMode(page);

  await expect(page.getByText(/Recepcion .*\+2 · stock/)).toBeVisible({ timeout: 40_000 });
  // En el momento de ver "+2" la ficha muestra el stock exacto: dos unidades, ni una más.
  await expect(page.getByText(`Stock actual: ${before + 2}`)).toBeVisible();
});

test("en modo Suma, un producto desconocido no suma nada y ofrece cargarlo", async ({ cameraPage }) => {
  const page = await cameraPage("qr"); // el QR nunca se crea en ningún test
  const { qr } = readCodes();
  await registerAndLogin(page);

  await page.goto("/scan");
  await turnOnSumMode(page);

  await expect(page.getByText(`El código ${qr} todavía no está cargado`)).toBeVisible({ timeout: READ_TIMEOUT });
  await expect(page.getByRole("button", { name: "Cargar producto" })).toBeVisible();
  await expect(page.getByRole("button", { name: /Deshacer/ })).toHaveCount(0);
});

test("el modo Suma arranca apagado cada vez y muestra un aviso fijo mientras está activo", async ({ browser }) => {
  const context = await browser.newContext();
  const page = await context.newPage();
  await registerAndLogin(page);
  await page.goto("/scan");
  const sw = page.getByRole("switch", { name: "Sumar al escanear" });

  await expect(sw).toHaveAttribute("aria-checked", "false");
  await expect(page.getByText("Modo suma: cada lectura suma +1")).toHaveCount(0);

  await turnOnSumMode(page);
  await page.waitForTimeout(1_000);
  await expect(page.getByText("Modo suma: cada lectura suma +1")).toBeVisible(); // sigue a la vista

  await page.reload();
  await expect(page.getByRole("switch", { name: "Sumar al escanear" })).toHaveAttribute("aria-checked", "false");
  await expect(page.getByText("Modo suma: cada lectura suma +1")).toHaveCount(0);
  await context.close();
});

test("un código tipeado a mano NO suma, ni siquiera en modo Suma", async ({ browser }) => {
  const before = await stockInDb();
  const context = await browser.newContext();
  const page = await context.newPage();
  await registerAndLogin(page);
  await page.goto("/scan");
  await turnOnSumMode(page);

  await page.getByPlaceholder("Ingresar código manualmente").fill(code);
  await page.getByRole("button", { name: "Buscar" }).click();
  await expect(page.getByText(/Stock actual: \d+/)).toBeVisible();

  expect(await stockInDb()).toBe(before);
  await context.close();
});
