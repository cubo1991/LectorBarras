import { beforeEach, describe, expect, it, vi } from "vitest";

// next-auth no resuelve bajo vitest (importa "next/server"). Con sesión, la validación
// corre antes de tocar la base, así que estos casos no llegan a ninguna consulta.
vi.mock("@/lib/auth", () => ({ auth: async () => ({ user: { id: "user-1" } }) }));

const { adjustStock } = await import("./stock");

const PRODUCT_ID = "11111111-1111-4111-8111-111111111111";

describe("adjustStock: validación del ajuste", () => {
  beforeEach(() => vi.clearAllMocks());

  it.each([
    [0, /cero/],
    [10_000, /9999/],
    [-10_000, /9999/],
    [1.5, /entero/],
    ["3", /número/],
    [undefined, /número/],
  ])("rechaza delta %s sin tocar la base", async (delta, message) => {
    const result = await adjustStock({ productId: PRODUCT_ID, delta });

    expect(result).toEqual({ ok: false, error: expect.stringMatching(message) });
  });

  it("rechaza un productId que no es un uuid", async () => {
    const result = await adjustStock({ productId: "abc", delta: 1 });

    expect(result.ok).toBe(false);
  });
});
