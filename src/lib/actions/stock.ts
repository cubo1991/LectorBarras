"use server";

import { z } from "zod";
import { eq } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db/client";
import { products, stockMovements } from "@/lib/db/schema";
import type { Product } from "./products";

const adjustStockSchema = z.object({
  productId: z.string().uuid(),
  delta: z.number().int().refine((n) => n !== 0, "El ajuste no puede ser cero"),
});

export type AdjustStockResult =
  | { ok: true; product: Product }
  | { ok: false; error: string };

export async function adjustStock(input: unknown): Promise<AdjustStockResult> {
  const session = await auth();
  if (!session?.user?.id) {
    return { ok: false, error: "No autenticado" };
  }

  const parsed = adjustStockSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0].message };
  }
  const { productId, delta } = parsed.data;
  const userId = session.user.id;

  return db.transaction(async (tx) => {
    const [product] = await tx.select().from(products).where(eq(products.id, productId)).limit(1);
    if (!product) {
      return { ok: false, error: "El producto no existe" };
    }

    const newStock = product.stock + delta;
    if (newStock < 0) {
      return { ok: false, error: "No hay stock suficiente" };
    }

    const [updated] = await tx
      .update(products)
      .set({ stock: newStock })
      .where(eq(products.id, productId))
      .returning();

    await tx.insert(stockMovements).values({ productId, userId, delta });

    return { ok: true, product: updated };
  });
}
