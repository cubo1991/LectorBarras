import { chromium, test as base, type Browser, type Page } from "@playwright/test";
import { cameraArgs, type FixtureName } from "./make-videos";

/**
 * `cameraPage(video)`: abre un Chromium propio cuya cámara es el video sintético
 * `video`. Los argumentos de lanzamiento no se pueden cambiar por test ni por
 * `describe` (fuerzan un worker nuevo), por eso cada test lanza su navegador.
 */
export const test = base.extend<{ cameraPage: (video: FixtureName) => Promise<Page> }>({
  cameraPage: async ({ baseURL }, provide) => {
    const browsers: Browser[] = [];
    await provide(async (video) => {
      const browser = await chromium.launch({ args: cameraArgs(video) });
      browsers.push(browser);
      const context = await browser.newContext({ baseURL, permissions: ["camera"] });
      return context.newPage();
    });
    await Promise.all(browsers.map((browser) => browser.close()));
  },
});

export { expect } from "@playwright/test";
