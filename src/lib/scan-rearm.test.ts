import { describe, expect, it } from "vitest";
import { createRearm } from "./scan-rearm";

const ABSENT_MS = 700;
const MIN_MISSES = 3;
const newRearm = () => createRearm(ABSENT_MS, MIN_MISSES);

type R = ReturnType<typeof newRearm>;

/** El código se lee cada 100 ms entre `from` y `to`, como en el visor. */
function readEvery100ms(rearm: R, code: string, from: number, to: number) {
  for (let t = from; t <= to; t += 100) rearm.observe(code, t);
}

/** Nada en el marco: el bucle da vueltas vacías (cada 100 ms) y avisa con `miss`. */
function emptyTurns(rearm: R, count: number) {
  for (let i = 0; i < count; i++) rearm.miss();
}

describe("createRearm", () => {
  it("la primera confirmación de un código cuenta", () => {
    expect(newRearm().shouldCount("A")).toBe(true);
  });

  it("el mismo código a la vista NO vuelve a contar aunque se reconfirme", () => {
    const rearm = newRearm();
    rearm.observe("A", 0);
    expect(rearm.shouldCount("A")).toBe(true);

    readEvery100ms(rearm, "A", 100, 4000); // 4 s con el código quieto frente a la cámara

    expect(rearm.shouldCount("A")).toBe(false);
  });

  it("si sale del marco (vueltas vacías + tiempo) y vuelve, cuenta de nuevo", () => {
    const rearm = newRearm();
    rearm.observe("A", 0);
    rearm.shouldCount("A");
    readEvery100ms(rearm, "A", 100, 1000);

    emptyTurns(rearm, 20); // ausente de 1000 a 3000
    rearm.observe("A", 3000);

    expect(rearm.shouldCount("A")).toBe(true);
  });

  it("una ausencia más corta que el umbral no cuenta como que salió", () => {
    const rearm = newRearm();
    rearm.observe("A", 0);
    rearm.shouldCount("A");

    emptyTurns(rearm, 4);
    rearm.observe("A", 500); // 500 ms sin leerse: un parpadeo, sigue siendo la misma presentación

    expect(rearm.shouldCount("A")).toBe(false);
  });

  it("celular lento: pasó el tiempo pero casi no hubo vueltas vacías → NO cuenta dos veces", () => {
    const rearm = newRearm();
    rearm.observe("A", 0);
    rearm.shouldCount("A");

    // Cada decodificación tarda ~900 ms: entre dos lecturas del código quieto pasó más que
    // `absentMs`, pero apenas hubo 1 vuelta vacía. No salió: sigue ahí.
    emptyTurns(rearm, 1);
    rearm.observe("A", 900);

    expect(rearm.shouldCount("A")).toBe(false);
  });

  it("otro código distinto cuenta enseguida, y el anterior también cuenta si vuelve", () => {
    const rearm = newRearm();
    rearm.observe("A", 0);
    expect(rearm.shouldCount("A")).toBe(true);

    expect(rearm.shouldCount("B")).toBe(true);
    expect(rearm.shouldCount("A")).toBe(true); // A vuelve tras haber contado B
  });

  it("recibir 24 unidades del mismo producto, una a la vez frente a la cámara, cuenta 24", () => {
    const rearm = newRearm();
    let counted = 0;
    let t = 0;
    for (let unit = 0; unit < 24; unit++) {
      // Cada unidad: se muestra ~1 s (10 lecturas) y se retira ~1,5 s (vueltas vacías).
      for (let i = 0; i < 10; i++, t += 100) {
        rearm.observe("A", t);
        if (i === 3 && rearm.shouldCount("A")) counted++; // se confirma a la 4.ª lectura
      }
      emptyTurns(rearm, 15);
      t += 1500;
    }

    expect(counted).toBe(24);
  });

  it("dejar UNA unidad quieta a la vista durante 10 s cuenta sólo 1", () => {
    const rearm = newRearm();
    let counted = 0;
    for (let t = 0; t <= 10_000; t += 100) {
      rearm.observe("A", t);
      if (t % 300 === 200 && rearm.shouldCount("A")) counted++; // se reconfirma cada ~0,3 s
    }

    expect(counted).toBe(1);
  });
});
