"use client";

import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { BarcodeScanner } from "@/components/BarcodeScanner";
import { LogoutButton } from "@/components/LogoutButton";
import { NewProductForm } from "@/components/NewProductForm";
import { lookupProductByBarcode, type ProductLookupResult } from "@/lib/actions/products";
import { adjustStock } from "@/lib/actions/stock";

function ScanPageContent() {
  const [result, setResult] = useState<ProductLookupResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [adjustError, setAdjustError] = useState<string | null>(null);
  const [lookupError, setLookupError] = useState<string | null>(null);
  // El scanner dispara onDetected en cada frame con el código a la vista: mientras
  // hay una búsqueda en curso se ignoran las demás.
  const lookingUp = useRef(false);

  const handleDetected = useCallback(async (barcode: string) => {
    if (lookingUp.current) return;
    lookingUp.current = true;
    setLoading(true);
    setAdjustError(null);
    setLookupError(null);
    let failed = false;
    try {
      setResult(await lookupProductByBarcode(barcode));
    } catch {
      failed = true;
      setLookupError("No se pudo buscar el producto. Volvé a iniciar sesión e intentá de nuevo.");
    } finally {
      setLoading(false);
      // Tras un error el scanner sigue disparando frames: pausa para no martillar el server.
      if (failed) setTimeout(() => (lookingUp.current = false), 3000);
      else lookingUp.current = false;
    }
  }, []);

  // Entrada desde el listado de productos (/products): ?code=<barcode> abre
  // directamente la ficha, sin pasar por la cámara.
  const codeFromUrl = useSearchParams().get("code");
  const lastCodeFromUrl = useRef<string | null>(null);

  useEffect(() => {
    // Se compara con el último código atendido (no un booleano): si la URL pasa
    // de ?code=A a ?code=B hay que buscar B.
    if (!codeFromUrl || lastCodeFromUrl.current === codeFromUrl) return;
    lastCodeFromUrl.current = codeFromUrl;
    handleDetected(codeFromUrl);
  }, [codeFromUrl, handleDetected]);

  function handleReset() {
    setResult(null);
    setAdjustError(null);
  }

  async function handleAdjust(productId: string, delta: number) {
    setAdjustError(null);
    const outcome = await adjustStock({ productId, delta });
    if (!outcome.ok) {
      setAdjustError(outcome.error);
      return;
    }
    setResult({ found: true, product: outcome.product });
  }

  return (
    <main className="mx-auto flex max-w-md flex-col gap-6 p-4 sm:p-8">
      <h1 className="text-xl font-semibold">Escanear producto</h1>

      {!result && <BarcodeScanner onDetected={handleDetected} />}

      {loading && <p>Buscando...</p>}
      {lookupError && (
        <p role="alert" className="text-sm text-red-600">
          {lookupError}
        </p>
      )}

      {!loading && result?.found && (
        <div className="flex flex-col gap-3 border p-4">
          <p className="font-medium">{result.product.name}</p>
          <p className="text-sm text-gray-600">Código: {result.product.barcode}</p>
          <p className="text-sm text-gray-600">Stock actual: {result.product.stock}</p>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => handleAdjust(result.product.id, -1)}
              className="min-h-11 flex-1 border text-lg"
            >
              -1
            </button>
            <button
              type="button"
              onClick={() => handleAdjust(result.product.id, 1)}
              className="min-h-11 flex-1 border text-lg"
            >
              +1
            </button>
          </div>
          {adjustError && <p className="text-sm text-red-600">{adjustError}</p>}
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

      {!loading && result && (
        <button type="button" onClick={handleReset} className="min-h-11 border px-4 py-2">
          Escanear otro código
        </button>
      )}

      <div className="flex items-center justify-between gap-4 border-t pt-4">
        <Link href="/products" className="text-sm underline">
          Buscar productos sin escanear
        </Link>
        <LogoutButton />
      </div>
    </main>
  );
}

export default function ScanPage() {
  return (
    <Suspense>
      <ScanPageContent />
    </Suspense>
  );
}
