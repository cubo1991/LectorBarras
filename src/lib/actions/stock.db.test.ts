import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { eq } from "drizzle-orm";

// Contra la base real (`npm run test:db`). La sesión se simula con un usuario de prueba
// real, porque stock_movements tiene una FK a users.
const session = vi.hoisted(() => ({ userId: "" }));
vi.mock("@/lib/auth", () => ({ auth: async () => ({ user: { id: session.userId } }) }));

const { db } = await import("@/lib/db/client");
const { products, stockMovements, users } = await import("@/lib/db/schema");
const { adjustStock } = await import("./stock");

const tag = `dbtest-${Date.now()}`;
let userId = "";
const productIds: string[] = [];

async function newProduct(stock: number) {
  const [product] = await db
    .insert(products)
    .values({ barcode: `${tag}-${productIds.length}`, name: `[E2E] ${tag}`, stock })
    .returning();
  productIds.push(product.id);
  return product;
}

const movementsOf = (productId: string) =>
  db.select().from(stockMovements).where(eq(stockMovements.productId, productId));

const stockOf = async (productId: string) =>
  (await db.select().from(products).where(eq(products.id, productId)))[0].stock;

beforeAll(async () => {
  const [user] = await db.insert(users).values({ email: `${tag}@example.test`, passwordHash: "x" }).returning();
  userId = user.id;
  session.userId = userId;
});

afterAll(async () => {
  for (const id of productIds) await db.delete(stockMovements).where(eq(stockMovements.productId, id));
  for (const id of productIds) await db.delete(products).where(eq(products.id, id));
  await db.delete(users).where(eq(users.id, userId));
});

describe("adjustStock contra la base real", () => {
  it("20 ajustes +1 concurrentes terminan exactamente en +20 (sin pisarse)", async () => {
    const product = await newProduct(5);

    const results = await Promise.all(Array.from({ length: 20 }, () => adjustStock({ productId: product.id, delta: 1 })));

    expect(results.every((r) => r.ok)).toBe(true);
    expect(await stockOf(product.id)).toBe(25);
    expect(await movementsOf(product.id)).toHaveLength(20);
  });

  it("restar más de lo que hay se rechaza y no cambia ni el stock ni los movimientos", async () => {
    const product = await newProduct(3);

    const result = await adjustStock({ productId: product.id, delta: -4 });

    expect(result).toEqual({ ok: false, error: "No hay stock suficiente" });
    expect(await stockOf(product.id)).toBe(3);
    expect(await movementsOf(product.id)).toHaveLength(0);
  });

  it("restas concurrentes nunca dejan el stock negativo", async () => {
    const product = await newProduct(5);

    const results = await Promise.all(Array.from({ length: 12 }, () => adjustStock({ productId: product.id, delta: -1 })));

    expect(results.filter((r) => r.ok)).toHaveLength(5);
    expect(results.filter((r) => !r.ok)).toHaveLength(7);
    expect(await stockOf(product.id)).toBe(0);
    expect(await movementsOf(product.id)).toHaveLength(5);
  });

  it("un ajuste y su inverso (deshacer) dejan el stock original y DOS movimientos", async () => {
    const product = await newProduct(12);

    await adjustStock({ productId: product.id, delta: 3 });
    const undone = await adjustStock({ productId: product.id, delta: -3 });

    expect(undone.ok && undone.product.stock).toBe(12);
    const movements = await movementsOf(product.id);
    expect(movements.map((m) => m.delta).sort()).toEqual([-3, 3]);
    expect(movements.every((m) => m.userId === userId)).toBe(true);
  });

  it("un producto inexistente informa que no existe", async () => {
    const result = await adjustStock({ productId: "22222222-2222-4222-8222-222222222222", delta: 1 });

    expect(result).toEqual({ ok: false, error: "El producto no existe" });
  });
});
