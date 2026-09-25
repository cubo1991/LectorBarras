"use client";

import { NewProductForm } from "@/components/NewProductForm";
import { Alert } from "@/components/ui/Alert";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import type { Product, ProductLookupResult } from "@/lib/actions/products";

type Props = {
  result: ProductLookupResult;
  /** Hay una búsqueda en curso: el resultado anterior se atenúa pero sigue a la vista. */
  loading: boolean;
  adjustError: string | null;
  onAdjust: (productId: string, delta: number) => void;
  onCreated: (product: Product) => void;
};

/**
 * Lo que aparece BAJO el visor tras un escaneo: la ficha del producto o el formulario
 * para cargarlo. La cámara no se apaga: el próximo escaneo reemplaza este panel.
 */
export function ProductPanel({ result, loading, adjustError, onAdjust, onCreated }: Props) {
  const dim = loading ? "opacity-50" : "";

  if (result.found) {
    const { product } = result;
    return (
      <Card className={`flex flex-col gap-4 ${dim}`}>
        <div className="flex flex-col gap-1">
          <div className="flex items-start justify-between gap-2">
            <p className="text-lg font-semibold">{product.name}</p>
            {product.stock === 0 && <Badge tone="danger">Sin stock</Badge>}
          </div>
          <p className="text-sm text-muted">Código: {product.barcode}</p>
        </div>
        <p className="text-sm text-muted">
          Stock actual: <span className="text-3xl font-semibold text-foreground">{product.stock}</span>
        </p>
        <div className="flex gap-3">
          <Button variant="secondary" onClick={() => onAdjust(product.id, -1)} className="min-h-14 flex-1 text-2xl">
            -1
          </Button>
          <Button onClick={() => onAdjust(product.id, 1)} className="min-h-14 flex-1 text-2xl">
            +1
          </Button>
        </div>
        {adjustError && <Alert>{adjustError}</Alert>}
      </Card>
    );
  }

  return (
    <div className={`flex flex-col gap-3 ${dim}`}>
      <p>No existe un producto con el código {result.barcode}.</p>
      <NewProductForm barcode={result.barcode} onCreated={onCreated} />
    </div>
  );
}
