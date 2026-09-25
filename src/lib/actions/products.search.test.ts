import { beforeEach, describe, expect, it, vi } from "vitest";

// next-auth no resuelve bajo vitest (importa "next/server"): se mockea la sesión.
const session = vi.hoisted(() => ({ value: { user: { id: "user-1" } } as unknown }));
vi.mock("@/lib/auth", () => ({ auth: async () => session.value }));

const rows = vi.hoisted(() => ({ value: [] as unknown[] }));
const count = vi.hoisted(() => ({ value: 0 }));
const captured = vi.hoisted(() => ({ limit: 0, offset: 0 }));

// El builder de drizzle es encadenable: cada método devuelve el mismo objeto.
// `select({count})` resuelve al total; `select()` sin proyección resuelve a las filas.
vi.mock("@/lib/db/client", () => {
  const builder = (resolve: () => unknown) => {
    const chain = {
      from: () => chain,
      where: () => chain,
      orderBy: () => chain,
      limit: (n: number) => {
        captured.limit = n;
        return chain;
      },
      offset: (n: number) => {
        captured.offset = n;
        return chain;
      },
      then: (onFulfilled: (v: unknown) => unknown) => Promise.resolve(resolve()).then(onFulfilled),
    };
    return chain;
  };

  return {
    db: {
      select: (projection?: unknown) =>
        projection ? builder(() => [{ count: count.value }]) : builder(() => rows.value),
    },
  };
});

const { PRODUCTS_PAGE_SIZE } = await import("@/lib/pagination");
const { searchProducts } = await import("./products");

const product = (over: Partial<{ id: string; barcode: string; name: string; stock: number }> = {}) => ({
  id: "11111111-1111-1111-1111-111111111111",
  barcode: "7791234567890",
  name: "Leche",
  stock: 5,
  createdAt: new Date(),
  ...over,
});

describe("searchProducts", () => {
  beforeEach(() => {
    session.value = { user: { id: "user-1" } };
    rows.value = [];
    count.value = 0;
    captured.limit = 0;
    captured.offset = 0;
  });

  it("devuelve resultados al buscar por nombre parcial", async () => {
    rows.value = [product({ name: "Leche entera" })];
    count.value = 1;

    const result = await searchProducts({ query: "lech" });

    expect(result.total).toBe(1);
    expect(result.products).toHaveLength(1);
    expect(result.products[0].name).toBe("Leche entera");
  });

  it("devuelve el producto al buscar por código exacto", async () => {
    rows.value = [product({ barcode: "7791234567890" })];
    count.value = 1;

    const result = await searchProducts({ query: "7791234567890" });

    expect(result.products[0].barcode).toBe("7791234567890");
  });

  it("devuelve una lista vacía cuando no hay coincidencias", async () => {
    const result = await searchProducts({ query: "no-existe" });

    expect(result.products).toEqual([]);
    expect(result.total).toBe(0);
    expect(result.totalPages).toBe(1);
  });

  it("pagina: nunca pide más de PRODUCTS_PAGE_SIZE y aplica el offset de la página", async () => {
    count.value = 5000;

    const result = await searchProducts({ query: "", page: 3 });

    expect(captured.limit).toBe(PRODUCTS_PAGE_SIZE);
    expect(captured.offset).toBe(PRODUCTS_PAGE_SIZE * 2);
    expect(result.totalPages).toBe(Math.ceil(5000 / PRODUCTS_PAGE_SIZE));
  });

  it("acepta page como string (viene de la query string)", async () => {
    count.value = 100;

    const result = await searchProducts({ query: "", page: "2" });

    expect(result.page).toBe(2);
    expect(captured.offset).toBe(PRODUCTS_PAGE_SIZE);
  });

  it("una página inválida en la URL cae a la 1 en vez de tirar", async () => {
    for (const page of ["abc", "0", "-1", "1.5"]) {
      const result = await searchProducts({ query: "", page });
      expect(result.page).toBe(1);
    }
  });

  it("rechaza a quien no tiene sesión", async () => {
    session.value = null;

    await expect(searchProducts({ query: "" })).rejects.toThrow("No autenticado");
  });
});
