"use server";

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
