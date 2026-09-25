import { describe, expect, it } from "vitest";
import { helpFor } from "./scan-help";
import { HELP_FIRST_MS, HELP_SECOND_MS } from "./scanner";

describe("helpFor", () => {
  it("al principio es la pista base", () => {
    expect(helpFor(0, { torchAvailable: false })).toEqual({
      level: "base",
      text: "Poné el código dentro del marco",
    });
    expect(helpFor(HELP_FIRST_MS - 1, { torchAvailable: false }).level).toBe("base");
  });

  it("a los ~8 s sugiere acercar o alejar", () => {
    const hint = helpFor(HELP_FIRST_MS, { torchAvailable: false });

    expect(hint.level).toBe("adjust");
    expect(hint.text).toMatch(/acercar o alejar/);
    expect(hint.text).not.toMatch(/linterna/);
  });

  it("si hay linterna, la pista de 8 s también la menciona", () => {
    expect(helpFor(HELP_FIRST_MS, { torchAvailable: true }).text).toMatch(/linterna/);
  });

  it("a los ~20 s sugiere el ingreso manual", () => {
    expect(helpFor(HELP_SECOND_MS, { torchAvailable: true })).toEqual({
      level: "manual",
      text: "¿Te cuesta? Escribí el código abajo",
    });
  });

  it("los umbrales son los de la spec (8 s y 20 s)", () => {
    expect(HELP_FIRST_MS).toBe(8000);
    expect(HELP_SECOND_MS).toBe(20000);
  });
});
