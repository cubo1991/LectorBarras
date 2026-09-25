import Link from "next/link";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";
import { searchProducts } from "@/lib/actions/products";

type Props = {
  searchParams: Promise<{ q?: string; page?: string }>;
};

const PAGER_LINK =
  "inline-flex min-h-11 items-center rounded-control border border-border-strong bg-surface px-4 font-medium";

export default async function ProductsPage({ searchParams }: Props) {
  const { q = "", page = "1" } = await searchParams;
  const { products, page: currentPage, totalPages, total } = await searchProducts({ query: q, page });

  function pageHref(target: number) {
    const params = new URLSearchParams();
    if (q) params.set("q", q);
    params.set("page", String(target));
    return `/products?${params}`;
  }

  return (
    <main className="mx-auto flex max-w-md flex-col gap-6 p-4 sm:p-8">
      <h1 className="text-2xl font-semibold">Buscar productos</h1>

      <form action="/products" className="flex items-start gap-2">
        <div className="min-w-0 flex-1">
          <Field label="Nombre o código" name="q" defaultValue={q} placeholder="Nombre o código" />
        </div>
        <Button type="submit" className="mt-6">
          Buscar
        </Button>
      </form>

      {total === 0 && (
        <p className="text-sm text-muted">
          {q ? `No hay productos que coincidan con "${q}".` : "Todavía no hay productos cargados."}
        </p>
      )}

      {total > 0 && (
        <>
          <p className="text-sm text-muted">
            {total} {total === 1 ? "producto" : "productos"}
          </p>

          <ul className="flex flex-col gap-2">
            {products.map((product) => (
              <li key={product.id}>
                <Link
                  href={`/scan?code=${encodeURIComponent(product.barcode)}`}
                  className="flex min-h-11 flex-col gap-1 rounded-control border border-border bg-surface p-4"
                >
                  <span className="flex items-start justify-between gap-2">
                    <span className="font-medium">{product.name}</span>
                    {product.stock === 0 && <Badge tone="danger">Sin stock</Badge>}
                  </span>
                  <span className="text-sm text-muted">Código: {product.barcode}</span>
                  <span className="text-sm text-muted">Stock: {product.stock}</span>
                </Link>
              </li>
            ))}
          </ul>

          {totalPages > 1 && (
            <div className="flex items-center justify-between gap-2">
              {currentPage > 1 ? (
                <Link href={pageHref(currentPage - 1)} className={PAGER_LINK}>
                  Anterior
                </Link>
              ) : (
                <span />
              )}
              <span className="text-sm text-muted">
                Página {currentPage} de {totalPages}
              </span>
              {currentPage < totalPages ? (
                <Link href={pageHref(currentPage + 1)} className={PAGER_LINK}>
                  Siguiente
                </Link>
              ) : (
                <span />
              )}
            </div>
          )}
        </>
      )}
    </main>
  );
}
