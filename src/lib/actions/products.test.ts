import { describe, expect, it } from "vitest";
import { createProduct } from "./products";

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
