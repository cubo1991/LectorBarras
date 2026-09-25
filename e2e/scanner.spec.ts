import { expect, test } from "./fixtures/camera";
import { readCodes } from "./fixtures/make-videos";
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
