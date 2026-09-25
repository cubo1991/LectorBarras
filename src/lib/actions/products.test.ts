import { describe, expect, it, vi } from "vitest";

// next-auth no resuelve bajo vitest (importa "next/server"), y estos tests sólo
// ejercitan la validación, que corre antes de consultar la sesión.
vi.mock("@/lib/auth", () => ({ auth: async () => null }));

const { createProduct } = await import("./products");

describe("createProduct validation", () => {
  it("rejects a non-numeric barcode without touching the database", async () => {
    const result = await createProduct({ barcode: "abc", name: "Producto", stock: 0 });

    expect(result).toEqual({ ok: false, error: expect.any(String) });
  });

  it("rejects an empty name", async () => {
    const result = await createProduct({ barcode: "7791234567890", name: "  ", stock: 0 });

    expect(result).toEqual({ ok: false, error: "El nombre es obligatorio" });
  });

  it("rejects negative initial stock", async () => {
    const result = await createProduct({ barcode: "7791234567890", name: "Producto", stock: -1 });

    expect(result).toEqual({ ok: false, error: "El stock inicial no puede ser negativo" });
  });
});

describe("createProduct: código de barras", () => {
  it("rechaza un código de menos de 4 caracteres", async () => {
    const result = await createProduct({ barcode: "abc", name: "Producto", stock: 0 });

    expect(result).toEqual({ ok: false, error: expect.stringMatching(/4 y 64/) });
  });

  it("rechaza un código de más de 64 caracteres", async () => {
    const result = await createProduct({ barcode: "x".repeat(65), name: "Producto", stock: 0 });

    expect(result).toEqual({ ok: false, error: expect.stringMatching(/4 y 64/) });
  });
});
