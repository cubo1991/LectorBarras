import { describe, expect, it } from "vitest";
import { createConfirmer } from "./scan-confirm";

describe("createConfirmer", () => {
  it("no acepta una ni dos lecturas: hace falta la tercera igual", () => {
    const confirmer = createConfirmer(3, 1500);

    expect(confirmer.push("A", 0)).toBeNull();
    expect(confirmer.push("A", 100)).toBeNull();
    expect(confirmer.push("A", 200)).toBe("A");
  });

  it("un código distinto en el medio reinicia la cuenta", () => {
    const confirmer = createConfirmer(3, 1500);

    confirmer.push("A", 0);
    confirmer.push("A", 100);
    expect(confirmer.push("B", 200)).toBeNull(); // corta la racha de A
    expect(confirmer.push("A", 300)).toBeNull(); // A vuelve a empezar de 1
    expect(confirmer.push("A", 400)).toBeNull();
    expect(confirmer.push("A", 500)).toBe("A");
  });

  it("si vence la ventana, la cuenta empieza de nuevo", () => {
    const confirmer = createConfirmer(3, 1500);

    confirmer.push("A", 0);
    confirmer.push("A", 100);
    expect(confirmer.push("A", 2000)).toBeNull(); // la 3.ª llega tarde: cuenta como 1.ª
    expect(confirmer.push("A", 2100)).toBeNull();
    expect(confirmer.push("A", 2200)).toBe("A");
  });

  it("los códigos alternados nunca se confirman", () => {
    const confirmer = createConfirmer(3, 1500);

    const results = ["A", "B", "A", "B", "A", "B"].map((code, i) => confirmer.push(code, i * 100));

    expect(results.every((r) => r === null)).toBe(true);
  });

  it("reset descarta lo acumulado", () => {
    const confirmer = createConfirmer(3, 1500);

    confirmer.push("A", 0);
    confirmer.push("A", 100);
    confirmer.reset();

    expect(confirmer.push("A", 200)).toBeNull();
  });
});
