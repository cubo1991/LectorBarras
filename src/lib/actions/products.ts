"use server";

import { z } from "zod";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { products } from "@/lib/db/schema";

export type Product = typeof products.$inferSelect;

export type ProductLookupResult =
  | { found: true; product: Product }
  | { found: false; barcode: string };

export async function lookupProductByBarcode(barcode: string): Promise<ProductLookupResult> {
  const [product] = await db.select().from(products).where(eq(products.barcode, barcode)).limit(1);
  if (!product) return { found: false, barcode };
  return { found: true, product };
}

const createProductSchema = z.object({
  barcode: z.string().regex(/^\d{8,14}$/, "El código debe ser numérico, de 8 a 14 dígitos"),
  name: z.string().trim().min(1, "El nombre es obligatorio"),
  stock: z.coerce.number().int().min(0, "El stock inicial no puede ser negativo"),
});

export type CreateProductResult =
  | { ok: true; product: Product }
  | { ok: false; error: string };

export async function createProduct(input: unknown): Promise<CreateProductResult> {
  const parsed = createProductSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0].message };
  }

  const { barcode, name, stock } = parsed.data;

  const [existing] = await db.select().from(products).where(eq(products.barcode, barcode)).limit(1);
  if (existing) {
    return { ok: false, error: "Ya existe un producto con ese código" };
  }

  const [product] = await db.insert(products).values({ barcode, name, stock }).returning();
  return { ok: true, product };
}
