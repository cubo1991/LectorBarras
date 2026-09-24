import Link from "next/link";
import { LogoutButton } from "@/components/LogoutButton";
import { searchProducts } from "@/lib/actions/products";

type Props = {
  searchParams: Promise<{ q?: string; page?: string }>;
};

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
      <h1 className="text-xl font-semibold">Buscar productos</h1>

      <form action="/products" className="flex gap-2">
        <input
          type="text"
          name="q"
          defaultValue={q}
          placeholder="Nombre o código"
          className="flex-1 border p-2"
        />
        <button type="submit" className="min-h-11 bg-black px-4 py-2 text-white">
          Buscar
        </button>
      </form>

      {total === 0 && (
        <p className="text-sm text-gray-600">
          {q ? `No hay productos que coincidan con "${q}".` : "Todavía no hay productos cargados."}
        </p>
      )}

      {total > 0 && (
        <>
          <p className="text-sm text-gray-600">
            {total} {total === 1 ? "producto" : "productos"}
          </p>

          <ul className="flex flex-col gap-2">
            {products.map((product) => (
              <li key={product.id}>
                <Link
                  href={`/scan?code=${product.barcode}`}
                  className="flex flex-col border p-4 hover:bg-gray-50"
                >
                  <span className="font-medium">{product.name}</span>
                  <span className="text-sm text-gray-600">Código: {product.barcode}</span>
                  <span className="text-sm text-gray-600">Stock: {product.stock}</span>
                </Link>
              </li>
            ))}
          </ul>

          {totalPages > 1 && (
            <div className="flex items-center justify-between">
              {currentPage > 1 ? (
                <Link href={pageHref(currentPage - 1)} className="inline-flex min-h-11 items-center border px-4 py-2">
                  Anterior
                </Link>
              ) : (
                <span />
              )}
              <span className="text-sm text-gray-600">
                Página {currentPage} de {totalPages}
              </span>
              {currentPage < totalPages ? (
                <Link href={pageHref(currentPage + 1)} className="inline-flex min-h-11 items-center border px-4 py-2">
                  Siguiente
                </Link>
              ) : (
                <span />
              )}
            </div>
          )}
        </>
      )}

      <div className="flex items-center justify-between gap-4 border-t pt-4">
        <Link href="/scan" className="text-sm underline">
          Escanear un código
        </Link>
        <LogoutButton />
      </div>
    </main>
  );
}
