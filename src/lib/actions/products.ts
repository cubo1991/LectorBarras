"use server";

import { z } from "zod";
import { asc, eq, ilike, or, sql } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db/client";
import { products, stockMovements } from "@/lib/db/schema";
import { PRODUCTS_PAGE_SIZE } from "@/lib/pagination";
import { escapeLike, isUniqueViolation } from "@/lib/sql";

export type Product = typeof products.$inferSelect;

export type ProductLookupResult =
  | { found: true; product: Product }
  | { found: false; barcode: string };

// Las server actions son invocables por HTTP sin pasar por el proxy (que sólo
// protege navegación), así que cada una que lee o escribe datos verifica la sesión.
async function requireUserId(): Promise<string> {
  const session = await auth();
  if (!session?.user?.id) throw new Error("No autenticado");
  return session.user.id;
}

export async function lookupProductByBarcode(barcode: string): Promise<ProductLookupResult> {
  await requireUserId();
  const [product] = await db.select().from(products).where(eq(products.barcode, barcode)).limit(1);
  if (!product) return { found: false, barcode };
  return { found: true, product };
}

const searchProductsSchema = z.object({
  query: z.string().trim().default(""),
  // ?page=abc / 0 / -1 / 1.5 vienen de la URL: caen a la página 1 en vez de tirar un 500.
  page: z.coerce.number().int().min(1).default(1).catch(1),
});

export type SearchProductsResult = {
  products: Product[];
  page: number;
  totalPages: number;
  total: number;
};

/**
 * Busca por código exacto o por nombre parcial (case-insensitive), paginado.
 * No trae el catálogo completo: siempre limita a PRODUCTS_PAGE_SIZE.
 */
export async function searchProducts(input: unknown): Promise<SearchProductsResult> {
  await requireUserId();
  const { query, page } = searchProductsSchema.parse(input ?? {});

  const where = query
    ? or(eq(products.barcode, query), ilike(products.name, `%${escapeLike(query)}%`))
    : undefined;

  const [{ count }] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(products)
    .where(where);

  const rows = await db
    .select()
    .from(products)
    .where(where)
    .orderBy(asc(products.name))
    .limit(PRODUCTS_PAGE_SIZE)
    .offset((page - 1) * PRODUCTS_PAGE_SIZE);

  return {
    products: rows,
    page,
    total: count,
    totalPages: Math.max(1, Math.ceil(count / PRODUCTS_PAGE_SIZE)),
  };
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

  // La validación va antes de auth() a propósito: un input inválido se rechaza
  // sin consultar la sesión ni la DB.
  const session = await auth();
  if (!session?.user?.id) {
    return { ok: false, error: "No autenticado" };
  }
  const userId = session.user.id;

  const duplicate: CreateProductResult = { ok: false, error: "Ya existe un producto con ese código" };

  try {
    return await db.transaction(async (tx): Promise<CreateProductResult> => {
      const [existing] = await tx
        .select()
        .from(products)
        .where(eq(products.barcode, barcode))
        .limit(1);
      if (existing) return duplicate;

      const [product] = await tx.insert(products).values({ barcode, name, stock }).returning();

      // El stock inicial es un cambio de stock: queda registrado como movimiento
      // para que el historial pueda explicar el stock actual (Boundary del SPEC).
      if (stock > 0) {
        await tx.insert(stockMovements).values({ productId: product.id, userId, delta: stock });
      }

      return { ok: true, product };
    });
  } catch (error) {
    // Dos altas simultáneas del mismo código pasan el SELECT; la segunda choca
    // con el índice único. Es el mismo caso que `existing`, no un crash.
    if (isUniqueViolation(error)) return duplicate;
    throw error;
  }
}
