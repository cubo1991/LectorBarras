"use server";

import { z } from "zod";
import { and, eq, gte, sql } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db/client";
import { products, stockMovements } from "@/lib/db/schema";
import type { Product } from "./products";

/** Tope por ajuste: frena el error de tipeo ("2400" por "24"). Un deshacer siempre cabe. */
const MAX_ADJUSTMENT = 9999;

const adjustStockSchema = z.object({
  productId: z.string().uuid(),
  delta: z
    .number("El ajuste debe ser un número")
    .int("El ajuste debe ser un número entero")
    .refine((n) => n !== 0, "El ajuste no puede ser cero")
    .refine((n) => Math.abs(n) <= MAX_ADJUSTMENT, `El ajuste no puede superar ${MAX_ADJUSTMENT} unidades`),
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

  return db.transaction(async (tx): Promise<AdjustStockResult> => {
    // Atómico: la suma y la condición "no queda negativo" se resuelven dentro de la misma
    // sentencia. Leer el stock y escribirlo después dejaba que dos ajustes simultáneos se
    // pisaran (dos +1 sobre 5 terminaban en 6).
    const [updated] = await tx
      .update(products)
      .set({ stock: sql`${products.stock} + ${delta}` })
      .where(and(eq(products.id, productId), gte(sql`${products.stock} + ${delta}`, 0)))
      .returning();

    if (!updated) {
      const [exists] = await tx.select({ id: products.id }).from(products).where(eq(products.id, productId)).limit(1);
      return { ok: false, error: exists ? "No hay stock suficiente" : "El producto no existe" };
    }

    await tx.insert(stockMovements).values({ productId, userId, delta });

    return { ok: true, product: updated };
  });
}
