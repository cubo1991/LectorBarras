"use client";

import { useCallback, useState } from "react";
import { BarcodeScanner } from "@/components/BarcodeScanner";
import { NewProductForm } from "@/components/NewProductForm";
import { lookupProductByBarcode, type ProductLookupResult } from "@/lib/actions/products";

export default function ScanPage() {
  const [result, setResult] = useState<ProductLookupResult | null>(null);
  const [loading, setLoading] = useState(false);

  const handleDetected = useCallback(async (barcode: string) => {
    setLoading(true);
    const lookup = await lookupProductByBarcode(barcode);
    setResult(lookup);
    setLoading(false);
  }, []);

  return (
    <main className="mx-auto flex max-w-md flex-col gap-6 p-8">
      <h1 className="text-xl font-semibold">Escanear producto</h1>

      <BarcodeScanner onDetected={handleDetected} />

      {loading && <p>Buscando...</p>}

      {!loading && result?.found && (
        <div className="border p-4">
          <p className="font-medium">{result.product.name}</p>
          <p className="text-sm text-gray-600">Código: {result.product.barcode}</p>
          <p className="text-sm text-gray-600">Stock actual: {result.product.stock}</p>
        </div>
      )}

      {!loading && result && !result.found && (
        <div className="flex flex-col gap-3">
          <p>No existe un producto con el código {result.barcode}.</p>
          <NewProductForm
            barcode={result.barcode}
            onCreated={(product) => setResult({ found: true, product })}
          />
        </div>
      )}
    </main>
  );
}
