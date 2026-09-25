import { expect, test } from "./fixtures/camera";
import { readCodes } from "./fixtures/make-videos";
import { registerAndLogin } from "./helpers";

// Lectura real por cámara: Chromium sirve un video sintético con códigos de barras
// (e2e/fixtures/make-videos.ts). Usa el motor zxing: Chromium de escritorio no trae
// BarcodeDetector.

test("lee un EAN-13 centrado", async ({ cameraPage }) => {
  const page = await cameraPage("inside");
  const { inside } = readCodes();
  await registerAndLogin(page);

  await page.goto("/scan");

  // El código es nuevo, así que la lectura termina en el alta ("No existe…").
  await expect(page.getByText(`No existe un producto con el código ${inside}`)).toBeVisible({
    timeout: 15_000,
  });
});
