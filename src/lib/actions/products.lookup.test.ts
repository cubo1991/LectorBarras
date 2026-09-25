import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/auth", () => ({ auth: async () => ({ user: { id: "user-1" } }) }));

const rows = vi.hoisted(() => ({ value: [] as { id: string; barcode: string }[] }));

vi.mock("@/lib/db/client", () => {
  const chain = {
    from: () => chain,
    where: () => chain,
    then: (onFulfilled: (v: unknown) => unknown) => Promise.resolve(rows.value).then(onFulfilled),
  };
  return { db: { select: () => chain } };
});

const { lookupProductByBarcode } = await import("./products");

const UPC_A = "036000291452";

describe("lookupProductByBarcode", () => {
  beforeEach(() => {
    rows.value = [];
  });

  it("encuentra un producto viejo guardado con 12 dígitos al buscarlo por su EAN-13", async () => {
    rows.value = [{ id: "legacy", barcode: UPC_A }];

    const result = await lookupProductByBarcode(`0${UPC_A}`);

    expect(result).toMatchObject({ found: true, product: { id: "legacy" } });
  });

  it("encuentra un producto guardado en forma canónica al buscarlo por los 12 dígitos", async () => {
    rows.value = [{ id: "canonical", barcode: `0${UPC_A}` }];

    const result = await lookupProductByBarcode(UPC_A);

    expect(result).toMatchObject({ found: true, product: { id: "canonical" } });
  });

  it("si existen las dos variantes, gana la canónica", async () => {
    rows.value = [
      { id: "legacy", barcode: UPC_A },
      { id: "canonical", barcode: `0${UPC_A}` },
    ];

    const result = await lookupProductByBarcode(UPC_A);

    expect(result).toMatchObject({ found: true, product: { id: "canonical" } });
  });

  it("si no existe, informa el código normalizado para dar de alta", async () => {
    const result = await lookupProductByBarcode(UPC_A);

    expect(result).toEqual({ found: false, barcode: `0${UPC_A}` });
  });
});
