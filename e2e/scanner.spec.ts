import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "./fixtures/camera";
import { readCodes } from "./fixtures/make-videos";
import { gs1CheckDigit } from "../src/lib/barcode";
import { registerAndLogin } from "./helpers";

// Lectura real por cámara: Chromium sirve un video sintético con códigos de barras
// (e2e/fixtures/make-videos.ts). Usa el motor zxing: Chromium de escritorio no trae
// BarcodeDetector. Los códigos son nuevos en cada corrida, así que una lectura
// exitosa termina en el alta ("No existe un producto con el código …").

const READ_TIMEOUT = 15_000;

test("lee un EAN-13 centrado, dentro del marco", async ({ cameraPage }) => {
  const page = await cameraPage("inside");
  const { inside } = readCodes();
  await registerAndLogin(page);

  await page.goto("/scan");

  await expect(page.getByText(`No existe un producto con el código ${inside}`)).toBeVisible({
    timeout: READ_TIMEOUT,
  });
});

test("control: un código chico pero centrado sí se lee", async ({ cameraPage }) => {
  const page = await cameraPage("outsideCentered");
  const { outside } = readCodes();
  await registerAndLogin(page);

  await page.goto("/scan");

  await expect(page.getByText(`No existe un producto con el código ${outside}`)).toBeVisible({
    timeout: READ_TIMEOUT,
  });
});

test("un código FUERA del marco no se lee", async ({ cameraPage }) => {
  const page = await cameraPage("outside");
  const { outside } = readCodes();
  await registerAndLogin(page);

  await page.goto("/scan");

  // La cámara arrancó y el código está a la vista (arriba a la izquierda, fuera del marco)...
  await expect(page.getByText("Iniciando cámara…")).toBeHidden({ timeout: READ_TIMEOUT });
  // ...pero durante un rato largo (decenas de vueltas del bucle) no se lee nada.
  await page.waitForTimeout(4_000);
  await expect(page.getByText(/No existe un producto|Stock actual/)).toHaveCount(0);
  await expect(page.getByText(outside)).toHaveCount(0);
});

test("con dos códigos en cuadro se lee sólo el de adentro del marco", async ({ cameraPage }) => {
  const page = await cameraPage("two");
  const { inside, outside } = readCodes();
  await registerAndLogin(page);

  await page.goto("/scan");

  await expect(page.getByText(`No existe un producto con el código ${inside}`)).toBeVisible({
    timeout: READ_TIMEOUT,
  });
  await expect(page.getByText(outside)).toHaveCount(0);
});

test("un Code 128 alfanumérico se lee y se da de alta de punta a punta", async ({ cameraPage }) => {
  const page = await cameraPage("code128");
  const { code128 } = readCodes();
  await registerAndLogin(page);

  await page.goto("/scan");
  await expect(page.getByText(`No existe un producto con el código ${code128}`)).toBeVisible({
    timeout: READ_TIMEOUT,
  });

  await page.getByPlaceholder("Nombre del producto").fill("[E2E] code128 por cámara");
  await page.getByPlaceholder("Stock inicial").fill("4");
  await page.getByRole("button", { name: "Dar de alta" }).click();
  await expect(page.getByText("Stock actual: 4")).toBeVisible();
  await expect(page.getByText(`Código: ${code128}`)).toBeVisible();
});

test("un EAN-13 con el dígito verificador inválido nunca se lee", async ({ cameraPage }) => {
  const page = await cameraPage("badChecksum");
  const { badChecksum } = readCodes();
  await registerAndLogin(page);

  await page.goto("/scan");

  await expect(page.getByText("Iniciando cámara…")).toBeHidden({ timeout: READ_TIMEOUT });
  await page.waitForTimeout(4_000);
  await expect(page.getByText(/No existe un producto|Stock actual/)).toHaveCount(0);
  await expect(page.getByText(badChecksum)).toHaveCount(0);
});

test("un QR (etiqueta propia) cuadrado cabe en el marco y se lee", async ({ cameraPage }) => {
  const page = await cameraPage("qr");
  const { qr } = readCodes();
  await registerAndLogin(page);

  await page.goto("/scan");

  await expect(page.getByText(`No existe un producto con el código ${qr}`)).toBeVisible({
    timeout: READ_TIMEOUT,
  });
});

test("con BarcodeDetector nativo (Android) se usa ese motor y un UPC-A queda normalizado a GTIN-13", async ({
  cameraPage,
}) => {
  const page = await cameraPage("outside"); // el video da igual: el detector simulado no mira la imagen
  const body = `0${Math.floor(Math.random() * 1e10).toString().padStart(10, "0")}`; // 11 dígitos
  const upcA = `${body}${gs1CheckDigit(body)}`;

  // Chromium de escritorio no trae BarcodeDetector: se simula el de Android.
  await page.addInitScript((code) => {
    const w = window as unknown as Record<string, unknown>;
    w.__nativeDetectCalls = 0;
    w.BarcodeDetector = class {
      static async getSupportedFormats() {
        return ["upc_a", "ean_13", "qr_code"];
      }
      async detect() {
        (w.__nativeDetectCalls as number)++;
        return [{ rawValue: code, format: "upc_a", boundingBox: { width: 300, height: 100 } }];
      }
    };
  }, upcA);
  await registerAndLogin(page);

  await page.goto("/scan");

  // Llega como UPC-A de 12 dígitos y se guarda/busca como GTIN-13 (un 0 adelante).
  await expect(page.getByText(`No existe un producto con el código 0${upcA}`)).toBeVisible({
    timeout: READ_TIMEOUT,
  });
  expect(await page.evaluate(() => (window as unknown as Record<string, number>).__nativeDetectCalls)).toBeGreaterThan(2);
});

test("una cámara sin linterna ni zoom (webcam) no muestra esos controles", async ({ cameraPage }) => {
  const page = await cameraPage("outside");
  await registerAndLogin(page);

  await page.goto("/scan");
  await expect(page.getByText("Iniciando cámara…")).toBeHidden({ timeout: READ_TIMEOUT });

  await expect(page.getByRole("button", { name: /Sonido/ })).toBeVisible();
  await expect(page.getByRole("button", { name: /Linterna/ })).toHaveCount(0);
  await expect(page.getByRole("slider", { name: "Zoom" })).toHaveCount(0);
});

test("con linterna y zoom declarados (Android) aparecen y aplican las constraints", async ({ cameraPage }) => {
  const page = await cameraPage("outside");

  // Chromium de escritorio no declara torch/zoom: se simula la cámara de un Android.
  await page.addInitScript(() => {
    const w = window as unknown as { __constraints: unknown[] };
    w.__constraints = [];
    const proto = MediaStreamTrack.prototype as unknown as Record<string, unknown>;
    proto.getCapabilities = () => ({ torch: true, zoom: { min: 1, max: 4, step: 0.5 }, focusMode: ["manual", "continuous"] });
    const getSettings = MediaStreamTrack.prototype.getSettings;
    proto.getSettings = function (this: MediaStreamTrack) {
      return { ...getSettings.call(this), zoom: 1 };
    };
    proto.applyConstraints = (constraints: unknown) => {
      w.__constraints.push(constraints);
      return Promise.resolve();
    };
  });
  await registerAndLogin(page);
  await page.goto("/scan");

  const applied = () => page.evaluate(() => (window as unknown as { __constraints: unknown[] }).__constraints);

  // El enfoque continuo se pide solo, sin que el usuario haga nada.
  await expect.poll(applied).toContainEqual({ advanced: [{ focusMode: "continuous" }] });

  await page.getByRole("button", { name: "Linterna: apagada" }).click();
  await expect(page.getByRole("button", { name: "Linterna: encendida" })).toBeVisible();
  expect(await applied()).toContainEqual({ advanced: [{ torch: true }] });

  await page.getByRole("slider", { name: "Zoom" }).fill("2.5");
  await expect.poll(applied).toContainEqual({ advanced: [{ zoom: 2.5 }] });
});

test("la guía muestra la pista mientras busca y confirma sin vibrar", async ({ cameraPage }) => {
  const page = await cameraPage("inside");
  const { inside } = readCodes();

  // Se cuentan las vibraciones y se demora la búsqueda del producto, así el estado
  // "confirmado" del marco queda visible el tiempo suficiente para verlo.
  await page.addInitScript(() => {
    const w = window as unknown as { __vibrations: number };
    w.__vibrations = 0;
    navigator.vibrate = () => {
      w.__vibrations++;
      return true;
    };
  });
  await page.route("**/scan", async (route) => {
    if (route.request().method() === "POST") await new Promise((resolve) => setTimeout(resolve, 3_000));
    await route.continue();
  });
  await registerAndLogin(page);

  await page.goto("/scan");

  await expect(page.getByText("Poné el código dentro del marco").or(page.getByText("Leyendo…"))).toBeVisible({
    timeout: READ_TIMEOUT,
  });
  await expect(page.getByText("✓ Código confirmado")).toBeVisible({ timeout: READ_TIMEOUT });

  await expect(page.getByText(`No existe un producto con el código ${inside}`)).toBeVisible({
    timeout: READ_TIMEOUT,
  });
  expect(await page.evaluate(() => (window as unknown as { __vibrations: number }).__vibrations)).toBe(0);
});

for (const colorScheme of ["light", "dark"] as const) {
  test(`el visor con la cámara activa cumple WCAG AA en ${colorScheme} y no desborda a 360 px`, async ({
    cameraPage,
  }) => {
    const page = await cameraPage("outside");
    await page.setViewportSize({ width: 360, height: 740 });
    await page.emulateMedia({ colorScheme });
    await page.addInitScript(() => {
      // Con linterna y zoom visibles: es la pantalla con más controles.
      const proto = MediaStreamTrack.prototype as unknown as Record<string, unknown>;
      proto.getCapabilities = () => ({ torch: true, zoom: { min: 1, max: 4, step: 0.5 } });
    });
    await registerAndLogin(page);

    await page.goto("/scan");
    await expect(page.getByText("Iniciando cámara…")).toBeHidden({ timeout: READ_TIMEOUT });
    await expect(page.getByRole("button", { name: /Linterna/ })).toBeVisible();

    const { violations } = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();
    expect(violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(" ")).join(", ")}`)).toEqual([]);

    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(overflow).toBeLessThanOrEqual(0);
  });
}
