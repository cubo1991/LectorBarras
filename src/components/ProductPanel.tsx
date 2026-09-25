"use client";

import { useState } from "react";
import { NewProductForm } from "@/components/NewProductForm";
import { Alert } from "@/components/ui/Alert";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Field } from "@/components/ui/Field";
import type { Product, ProductLookupResult } from "@/lib/actions/products";

/** Mismo tope que el servidor (`adjustStock`): se valida acá para avisar sin un viaje de red. */
const MAX_QUANTITY = 9999;

type Props = {
  result: ProductLookupResult;
  /** Hay una búsqueda en curso: el resultado anterior se atenúa pero sigue a la vista. */
  loading: boolean;
  adjustError: string | null;
  /** El stock recién cambió por un ajuste: se resalta el número. */
  justAdjusted: boolean;
  /** Texto para lectores de pantalla ("Leche: stock actualizado a 13"). */
  announcement: string;
  /** Devuelve `true` si el ajuste se aplicó. */
  onAdjust: (productId: string, delta: number) => Promise<boolean>;
  onCreated: (product: Product) => void;
};

/**
 * Lo que aparece BAJO el visor tras un escaneo: la ficha del producto o el formulario
 * para cargarlo. La cámara no se apaga: el próximo escaneo reemplaza este panel.
 */
export function ProductPanel({ result, loading, adjustError, justAdjusted, announcement, onAdjust, onCreated }: Props) {
  const dim = loading ? "opacity-50" : "";

  if (!result.found) {
    return (
      <div className={`flex flex-col gap-3 ${dim}`}>
        <p>No existe un producto con el código {result.barcode}.</p>
        <NewProductForm barcode={result.barcode} onCreated={onCreated} />
      </div>
    );
  }

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
        Stock actual:{" "}
        <span
          // `key` reinicia la animación en cada cambio de stock.
          key={`${product.id}-${product.stock}`}
          className={`rounded px-1 text-3xl font-semibold text-foreground ${justAdjusted ? "stock-flash" : ""}`}
        >
          {product.stock}
        </span>
      </p>
      {/* Lo anuncia el lector de pantalla; el cambio visual es el resaltado del número. */}
      <p role="status" data-testid="stock-announcement" className="sr-only">
        {announcement}
      </p>

      <div className="grid grid-cols-4 gap-2">
        <Button variant="secondary" onClick={() => void onAdjust(product.id, -1)} className="min-h-14 px-0 text-xl">
          -1
        </Button>
        <Button onClick={() => void onAdjust(product.id, 1)} className="min-h-14 px-0 text-xl">
          +1
        </Button>
        <Button onClick={() => void onAdjust(product.id, 5)} className="min-h-14 px-0 text-xl">
          +5
        </Button>
        <Button onClick={() => void onAdjust(product.id, 10)} className="min-h-14 px-0 text-xl">
          +10
        </Button>
      </div>

      <CustomQuantity key={product.id} onAdjust={(delta) => onAdjust(product.id, delta)} />

      {adjustError && <Alert>{adjustError}</Alert>}
    </Card>
  );
}

/** "Otra cantidad": un número libre para sumar o restar (por ejemplo, una caja de 24). */
function CustomQuantity({ onAdjust }: { onAdjust: (delta: number) => Promise<boolean> }) {
  const [value, setValue] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function apply(sign: 1 | -1) {
    const quantity = Number(value);
    if (!/^\d+$/.test(value.trim()) || quantity < 1 || quantity > MAX_QUANTITY) {
      setError(`Ingresá una cantidad entera entre 1 y ${MAX_QUANTITY}`);
      return;
    }
    setError(null);
    if (await onAdjust(sign * quantity)) setValue("");
  }

  return (
    <div className="flex flex-col gap-2">
      <Field
        label="Otra cantidad"
        name="custom-quantity"
        inputMode="numeric"
        autoComplete="off"
        placeholder="Ej.: 24"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        error={error ?? undefined}
      />
      <div className="grid grid-cols-2 gap-2">
        <Button variant="secondary" onClick={() => void apply(-1)}>
          Restar
        </Button>
        <Button onClick={() => void apply(1)}>Sumar</Button>
      </div>
    </div>
  );
}
