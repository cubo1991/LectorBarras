"use client";

import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { BarcodeScanner } from "@/components/BarcodeScanner";
import { NewProductForm } from "@/components/NewProductForm";
import { Alert } from "@/components/ui/Alert";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
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
      <h1 className="text-2xl font-semibold">Escanear producto</h1>

      {!result && <BarcodeScanner onDetected={handleDetected} />}

      {loading && <p role="status">Buscando...</p>}
      {lookupError && <Alert>{lookupError}</Alert>}

      {!loading && result?.found && (
        <Card className="flex flex-col gap-4">
          <div className="flex flex-col gap-1">
            <div className="flex items-start justify-between gap-2">
              <p className="text-lg font-semibold">{result.product.name}</p>
              {result.product.stock === 0 && <Badge tone="danger">Sin stock</Badge>}
            </div>
            <p className="text-sm text-muted">Código: {result.product.barcode}</p>
          </div>
          <p className="text-sm text-muted">
            Stock actual: <span className="text-3xl font-semibold text-foreground">{result.product.stock}</span>
          </p>
          <div className="flex gap-3">
            <Button
              variant="secondary"
              onClick={() => handleAdjust(result.product.id, -1)}
              className="min-h-14 flex-1 text-2xl"
            >
              -1
            </Button>
            <Button onClick={() => handleAdjust(result.product.id, 1)} className="min-h-14 flex-1 text-2xl">
              +1
            </Button>
          </div>
          {adjustError && <Alert>{adjustError}</Alert>}
        </Card>
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
        <Button variant="secondary" onClick={handleReset}>
          Escanear otro código
        </Button>
      )}
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
