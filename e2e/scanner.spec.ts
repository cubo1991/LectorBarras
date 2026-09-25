import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "./fixtures/camera";
import { readCodes } from "./fixtures/make-videos";
import { gs1CheckDigit } from "../src/lib/barcode";
import { registerAndLogin } from "./helpers";

// Lectura real por cámara: Chromium sirve un video sintético con códigos de barras
// (e2e/fixtures/make-videos.ts). Usa el motor zxing: Chromium de escritorio no trae
// BarcodeDetector. Los códigos son nuevos en cada corrida, así que una lectura
// exitosa termina en el alta ("El código … todavía no está cargado").

const READ_TIMEOUT = 15_000;

test("lee un EAN-13 centrado, dentro del marco", async ({ cameraPage }) => {
  const page = await cameraPage("inside");
  const { inside } = readCodes();
  await registerAndLogin(page);

  await page.goto("/scan");

  await expect(page.getByText(`El código ${inside} todavía no está cargado`)).toBeVisible({
    timeout: READ_TIMEOUT,
  });
});

test("control: un código chico pero centrado sí se lee", async ({ cameraPage }) => {
  const page = await cameraPage("outsideCentered");
  const { outside } = readCodes();
  await registerAndLogin(page);

  await page.goto("/scan");

  await expect(page.getByText(`El código ${outside} todavía no está cargado`)).toBeVisible({
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
  await expect(page.getByText(/todavía no está cargado|Stock actual/)).toHaveCount(0);
  await expect(page.getByText(outside)).toHaveCount(0);
});

test("con dos códigos en cuadro se lee sólo el de adentro del marco", async ({ cameraPage }) => {
  const page = await cameraPage("two");
  const { inside, outside } = readCodes();
  await registerAndLogin(page);

  await page.goto("/scan");

  await expect(page.getByText(`El código ${inside} todavía no está cargado`)).toBeVisible({
    timeout: READ_TIMEOUT,
  });
  await expect(page.getByText(outside)).toHaveCount(0);
});

test("un Code 128 alfanumérico se lee y se da de alta de punta a punta", async ({ cameraPage }) => {
  const page = await cameraPage("code128");
  const { code128 } = readCodes();
  await registerAndLogin(page);

  await page.goto("/scan");
  await expect(page.getByText(`El código ${code128} todavía no está cargado`)).toBeVisible({
    timeout: READ_TIMEOUT,
  });

  await page.getByPlaceholder("Nombre del producto").fill("[E2E] code128 por cámara");
  await page.getByPlaceholder("Stock inicial").fill("4");
  await page.getByRole("button", { name: "Cargar producto" }).click();
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
  await expect(page.getByText(/todavía no está cargado|Stock actual/)).toHaveCount(0);
  await expect(page.getByText(badChecksum)).toHaveCount(0);
});

test("un QR (etiqueta propia) cuadrado cabe en el marco y se lee", async ({ cameraPage }) => {
  const page = await cameraPage("qr");
  const { qr } = readCodes();
  await registerAndLogin(page);

  await page.goto("/scan");

  await expect(page.getByText(`El código ${qr} todavía no está cargado`)).toBeVisible({
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
  await expect(page.getByText(`El código 0${upcA} todavía no está cargado`)).toBeVisible({
    timeout: READ_TIMEOUT,
  });
  expect(await page.evaluate(() => (window as unknown as Record<string, number>).__nativeDetectCalls)).toBeGreaterThan(2);
});

test("una cámara sin linterna ni zoom (webcam) no muestra esos controles", async ({ cameraPage }) => {
  const page = await cameraPage("outside");
  await registerAndLogin(page);

  await page.goto("/scan");
  await expect(page.getByText("Iniciando cámara…")).toBeHidden({ timeout: READ_TIMEOUT });

  await expect(page.getByRole("switch", { name: "Sonido" })).toBeVisible();
  await expect(page.getByRole("switch", { name: "Linterna" })).toHaveCount(0);
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

  const torch = page.getByRole("switch", { name: "Linterna" });
  await expect(torch).toHaveAttribute("aria-checked", "false");
  await torch.click();
  await expect(torch).toHaveAttribute("aria-checked", "true");
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

  await expect(page.getByText(`El código ${inside} todavía no está cargado`)).toBeVisible({
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
    await expect(page.getByRole("switch", { name: "Linterna" })).toBeVisible();

    const { violations } = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();
    expect(violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(" ")).join(", ")}`)).toEqual([]);

    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(overflow).toBeLessThanOrEqual(0);
  });
}

test("tras un escaneo la cámara sigue viva y el mismo código a la vista busca UNA sola vez", async ({
  cameraPage,
}) => {
  const page = await cameraPage("inside");
  const { inside } = readCodes();
  let lookups = 0;
  await page.route("**/scan", async (route) => {
    if (route.request().method() === "POST") lookups++; // cada búsqueda es un POST (server action)
    await route.continue();
  });
  await page.addInitScript(() => {
    const w = window as unknown as { __cameraStarts: number };
    w.__cameraStarts = 0;
    const devices = navigator.mediaDevices;
    const original = devices.getUserMedia.bind(devices);
    devices.getUserMedia = (constraints) => {
      w.__cameraStarts++;
      return original(constraints);
    };
  });
  await registerAndLogin(page);

  await page.goto("/scan");
  await expect(page.getByText(`El código ${inside} todavía no está cargado`)).toBeVisible({
    timeout: READ_TIMEOUT,
  });

  // El código sigue quieto frente a la cámara: durante 5 s (≈ 15 confirmaciones posibles) no
  // debe volver a buscar ni reiniciar la cámara.
  await page.waitForTimeout(5_000);
  expect(lookups).toBe(1);
  expect(await page.evaluate(() => (window as unknown as { __cameraStarts: number }).__cameraStarts)).toBe(1);
  await expect(page.getByText("Iniciando cámara…")).toBeHidden();
});

test("si el código sale del marco y vuelve, se busca de nuevo: una vez por presentación", async ({
  cameraPage,
}) => {
  const page = await cameraPage("pulse"); // 2 s a la vista, 2 s vacío, en bucle
  let lookups = 0;
  await page.route("**/scan", async (route) => {
    if (route.request().method() === "POST") lookups++;
    await route.continue();
  });
  await registerAndLogin(page);

  const startedAt = Date.now();
  await page.goto("/scan");

  // Vuelve a mostrarse → segunda búsqueda.
  await expect.poll(() => lookups, { timeout: 30_000 }).toBeGreaterThanOrEqual(2);

  // Y no se buscó de más: como mucho una por presentación (una cada ~4 s) más la de margen.
  const elapsedSeconds = (Date.now() - startedAt) / 1000;
  expect(lookups).toBeLessThanOrEqual(Math.ceil(elapsedSeconds / 4) + 1);
});

test("Sonido es un interruptor con etiqueta fija: se opera con teclado y la preferencia persiste", async ({
  cameraPage,
}) => {
  const page = await cameraPage("outside");
  await registerAndLogin(page);
  await page.goto("/scan");
  await expect(page.getByText("Iniciando cámara…")).toBeHidden({ timeout: READ_TIMEOUT });

  const sound = page.getByRole("switch", { name: "Sonido" });
  await expect(sound).toHaveAttribute("aria-checked", "true"); // por defecto suena

  await sound.focus();
  await page.keyboard.press("Space"); // Espacio lo alterna
  await expect(sound).toHaveAttribute("aria-checked", "false");
  expect((await sound.boundingBox())!.height).toBeGreaterThanOrEqual(44);

  await page.reload();
  await expect(page.getByRole("switch", { name: "Sonido" })).toHaveAttribute("aria-checked", "false"); // persiste
});

test("la ayuda contextual: a los ~8 s sugiere acercar o alejar y a los ~20 s el ingreso manual", async ({
  cameraPage,
}) => {
  const page = await cameraPage("outside"); // nada legible dentro del marco
  await registerAndLogin(page);

  await page.goto("/scan");
  await expect(page.getByText("Poné el código dentro del marco")).toBeVisible({ timeout: READ_TIMEOUT });

  await expect(page.getByText("Probá acercar o alejar un poco el celular")).toBeVisible({ timeout: 14_000 });
  await expect(page.getByText("¿Te cuesta? Escribí el código abajo")).toBeVisible({ timeout: 20_000 });
  await expect(page.getByText("Probá acercar o alejar un poco el celular")).toHaveCount(0); // reemplaza a la anterior
});

test("con linterna disponible, la pista de los 8 s la menciona", async ({ cameraPage }) => {
  const page = await cameraPage("outside");
  await page.addInitScript(() => {
    const proto = MediaStreamTrack.prototype as unknown as Record<string, unknown>;
    proto.getCapabilities = () => ({ torch: true });
  });
  await registerAndLogin(page);

  await page.goto("/scan");

  await expect(page.getByText(/Si hay poca luz, encendé la linterna/)).toBeVisible({ timeout: 25_000 });
});

test("una lectura válida devuelve la pista al mensaje base", async ({ cameraPage }) => {
  const page = await cameraPage("receptionPulse"); // se muestra, se retira, se vuelve a mostrar
  await registerAndLogin(page);

  await page.goto("/scan");

  // Con un código que aparece cada ~4 s nunca pasan 8 s sin una lectura válida.
  await page.waitForTimeout(12_000);
  await expect(page.getByText("Probá acercar o alejar un poco el celular")).toHaveCount(0);
  await expect(page.getByText("¿Te cuesta? Escribí el código abajo")).toHaveCount(0);
});
