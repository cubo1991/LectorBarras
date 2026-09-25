import { describe, expect, it } from "vitest";
import { guideToVideoRect } from "./scan-geometry";

const GUIDE = { widthFraction: 0.9, heightFraction: 0.55 };

describe("guideToVideoRect", () => {
  it("misma proporción: el marco es el mismo % del cuadro del video", () => {
    const rect = guideToVideoRect({ width: 1280, height: 720 }, { width: 640, height: 360 }, GUIDE);

    // Es la zona que usan los videos de la cámara falsa (e2e/fixtures/make-videos.ts).
    expect(rect).toEqual({ x: 64, y: 162, width: 1152, height: 396 });
  });

  it("contenedor más cuadrado que el video: object-cover recorta los costados", () => {
    const rect = guideToVideoRect({ width: 1280, height: 720 }, { width: 360, height: 360 }, GUIDE);

    // Se ve sólo el centro de 720x720 del video; el marco (90 % de 360) son 648 px de video.
    expect(rect).toEqual({ x: 316, y: 162, width: 648, height: 396 });
  });

  it("video vertical en un contenedor apaisado: object-cover recorta arriba y abajo", () => {
    const rect = guideToVideoRect({ width: 720, height: 1280 }, { width: 640, height: 360 }, GUIDE);

    const scale = 640 / 720;
    expect(rect.x).toBe(Math.round(32 / scale));
    expect(rect.width).toBe(Math.round(576 / scale));
    expect(rect.height).toBe(Math.round(198 / scale));
    // Centrado verticalmente en el cuadro del video.
    expect(Math.abs(rect.y + rect.height / 2 - 640)).toBeLessThanOrEqual(1); // el redondeo mueve medio píxel
  });

  it("nunca se sale de los límites del video", () => {
    const rect = guideToVideoRect({ width: 640, height: 480 }, { width: 300, height: 700 }, {
      widthFraction: 1,
      heightFraction: 1,
    });

    expect(rect.x).toBeGreaterThanOrEqual(0);
    expect(rect.y).toBeGreaterThanOrEqual(0);
    expect(rect.x + rect.width).toBeLessThanOrEqual(640);
    expect(rect.y + rect.height).toBeLessThanOrEqual(480);
  });

  it("el marco queda centrado en el cuadro cuando el video y el contenedor coinciden", () => {
    const rect = guideToVideoRect({ width: 800, height: 600 }, { width: 400, height: 300 }, GUIDE);

    expect(rect.x + rect.width / 2).toBeCloseTo(400, 0);
    expect(rect.y + rect.height / 2).toBeCloseTo(300, 0);
  });
});
