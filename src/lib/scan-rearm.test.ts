import { describe, expect, it } from "vitest";
import { createRearm } from "./scan-rearm";

const ABSENT_MS = 700;

/** Simula un código que se lee cada 100 ms entre `from` y `to`, llamando a `observe` como el visor. */
function readEvery100ms(rearm: ReturnType<typeof createRearm>, code: string, from: number, to: number) {
  for (let t = from; t <= to; t += 100) rearm.observe(code, t);
}

describe("createRearm", () => {
  it("la primera confirmación de un código cuenta", () => {
    const rearm = createRearm(ABSENT_MS);

    expect(rearm.shouldCount("A")).toBe(true);
  });

  it("el mismo código a la vista NO vuelve a contar aunque se reconfirme", () => {
    const rearm = createRearm(ABSENT_MS);
    rearm.observe("A", 0);
    expect(rearm.shouldCount("A")).toBe(true);

    readEvery100ms(rearm, "A", 100, 4000); // 4 s con el código quieto frente a la cámara

    expect(rearm.shouldCount("A")).toBe(false);
  });

  it("si sale del marco y vuelve, cuenta de nuevo", () => {
    const rearm = createRearm(ABSENT_MS);
    rearm.observe("A", 0);
    rearm.shouldCount("A");
    readEvery100ms(rearm, "A", 100, 1000);

    // Ausente de 1000 a 3000 (nada se lee) y vuelve a leerse a los 3000.
    rearm.observe("A", 3000);

    expect(rearm.shouldCount("A")).toBe(true);
  });

  it("una ausencia más corta que el umbral no cuenta como que salió", () => {
    const rearm = createRearm(ABSENT_MS);
    rearm.observe("A", 0);
    rearm.shouldCount("A");

    rearm.observe("A", 500); // 500 ms sin leerse: un parpadeo, sigue siendo la misma presentación

    expect(rearm.shouldCount("A")).toBe(false);
  });

  it("otro código distinto cuenta enseguida, y el anterior también cuenta si vuelve", () => {
    const rearm = createRearm(ABSENT_MS);
    rearm.observe("A", 0);
    expect(rearm.shouldCount("A")).toBe(true);

    expect(rearm.shouldCount("B")).toBe(true);
    expect(rearm.shouldCount("A")).toBe(true); // A vuelve tras haber contado B
  });

  it("recibir 24 unidades del mismo producto, una a la vez frente a la cámara, cuenta 24", () => {
    const rearm = createRearm(ABSENT_MS);
    let counted = 0;
    let t = 0;
    for (let unit = 0; unit < 24; unit++) {
      // Cada unidad: se muestra ~1 s (10 lecturas) y se retira ~1,5 s (sin lecturas).
      for (let i = 0; i < 10; i++, t += 100) {
        rearm.observe("A", t);
        if (i === 3 && rearm.shouldCount("A")) counted++; // se confirma a la 4.ª lectura
      }
      t += 1500;
    }

    expect(counted).toBe(24);
  });

  it("dejar UNA unidad quieta a la vista durante 10 s cuenta sólo 1", () => {
    const rearm = createRearm(ABSENT_MS);
    let counted = 0;
    for (let t = 0; t <= 10_000; t += 100) {
      rearm.observe("A", t);
      if (t % 300 === 200 && rearm.shouldCount("A")) counted++; // se reconfirma cada ~0,3 s
    }

    expect(counted).toBe(1);
  });
});
