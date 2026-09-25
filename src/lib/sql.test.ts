import { describe, expect, it } from "vitest";
import { escapeLike, isUniqueViolation } from "./sql";

describe("escapeLike", () => {
  it("escapa los comodines de LIKE para que se busquen literales", () => {
    expect(escapeLike("50%")).toBe("50\\%");
    expect(escapeLike("a_b")).toBe("a\\_b");
    expect(escapeLike("a\\b")).toBe("a\\\\b");
  });

  it("no toca texto sin caracteres especiales", () => {
    expect(escapeLike("leche entera")).toBe("leche entera");
  });
});

describe("isUniqueViolation", () => {
  it("detecta 23505 directo o dentro de cause (drizzle)", () => {
    expect(isUniqueViolation({ code: "23505" })).toBe(true);
    expect(isUniqueViolation({ cause: { code: "23505" } })).toBe(true);
  });

  it("ignora otros errores", () => {
    expect(isUniqueViolation({ code: "23503" })).toBe(false);
    expect(isUniqueViolation(new Error("boom"))).toBe(false);
    expect(isUniqueViolation(null)).toBe(false);
  });
});
