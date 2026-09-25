"use client";

import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { BarcodeScanner } from "@/components/BarcodeScanner";
import { ProductPanel } from "@/components/ProductPanel";
import { Alert } from "@/components/ui/Alert";
import { Toast } from "@/components/ui/Toast";
import { lookupProductByBarcode, type ProductLookupResult } from "@/lib/actions/products";
import { adjustStock } from "@/lib/actions/stock";

/** Cuánto dura el aviso de "Deshacer" (se pausa mientras tiene el foco o el puntero). */
const UNDO_TOAST_MS = 6000;

type Notice = {
  message: string;
  /** Sólo el aviso de un ajuste tiene acción de deshacer. */
  undo?: { productId: string; delta: number };
};

function ScanPageContent() {
  const [result, setResult] = useState<ProductLookupResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [adjustError, setAdjustError] = useState<string | null>(null);
  const [lookupError, setLookupError] = useState<string | null>(null);
  // Tras un ajuste: se resalta el número y se anuncia el cambio a los lectores de pantalla.
  const [justAdjusted, setJustAdjusted] = useState(false);
  const [announcement, setAnnouncement] = useState("");
  const [notice, setNotice] = useState<Notice | null>(null);
  const dismissNotice = useCallback(() => setNotice(null), []);
  // Cada búsqueda lleva un número: si otra empezó mientras tanto, sólo la última pinta.
  const latestLookup = useRef(0);

  // El visor avisa una vez por presentación del código (ya filtrado, confirmado y sin
  // repetirse mientras sigue a la vista), así que acá no hace falta ninguna guarda.
  const handleDetected = useCallback(async (barcode: string) => {
    const mine = ++latestLookup.current;
    setLoading(true);
    setAdjustError(null);
    setLookupError(null);
    setJustAdjusted(false);
    setAnnouncement("");
    try {
      const lookup = await lookupProductByBarcode(barcode);
      if (mine === latestLookup.current) setResult(lookup);
    } catch {
      if (mine === latestLookup.current) {
        setLookupError("No se pudo buscar el producto. Volvé a iniciar sesión e intentá de nuevo.");
      }
    } finally {
      if (mine === latestLookup.current) setLoading(false);
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

  /** Devuelve `true` si el ajuste se aplicó. */
  async function handleAdjust(productId: string, delta: number): Promise<boolean> {
    setAdjustError(null);
    const outcome = await adjustStock({ productId, delta });
    if (!outcome.ok) {
      setAdjustError(outcome.error);
      return false;
    }
    setResult({ found: true, product: outcome.product });
    setJustAdjusted(true);
    setAnnouncement(`${outcome.product.name}: stock actualizado a ${outcome.product.stock}`);
    setNotice({
      message: `${outcome.product.name}: ${outcome.product.stock - delta} → ${outcome.product.stock}`,
      undo: { productId, delta },
    });
    return true;
  }

  /** Deshacer = el ajuste inverso: queda registrado como un movimiento más (no se borra historial). */
  async function handleUndo(undo: { productId: string; delta: number }) {
    const outcome = await adjustStock({ productId: undo.productId, delta: -undo.delta });
    if (!outcome.ok) {
      // Casi siempre es porque otra persona movió el stock y el inverso dejaría negativo.
      setNotice({
        message:
          outcome.error === "No hay stock suficiente"
            ? "El stock cambió: no se puede deshacer"
            : `No se pudo deshacer: ${outcome.error}`,
      });
      return;
    }
    setResult({ found: true, product: outcome.product });
    setJustAdjusted(true);
    setAnnouncement(`Se deshizo el ajuste: ${outcome.product.name} vuelve a ${outcome.product.stock}`);
    setNotice(null);
  }

  return (
    <main className="mx-auto flex max-w-md flex-col gap-6 p-4 sm:p-8">
      <h1 className="text-2xl font-semibold">Escanear producto</h1>

      {/* La cámara queda siempre viva: escanear otro producto reemplaza la ficha de abajo. */}
      <BarcodeScanner onDetected={handleDetected} />

      {loading && <p role="status">Buscando...</p>}
      {lookupError && <Alert>{lookupError}</Alert>}

      {notice && (
        <Toast
          message={notice.message}
          actionLabel={notice.undo ? "Deshacer" : undefined}
          onAction={notice.undo ? () => void handleUndo(notice.undo!) : undefined}
          onDismiss={dismissNotice}
          durationMs={UNDO_TOAST_MS}
        />
      )}

      {result && (
        <ProductPanel
          result={result}
          loading={loading}
          adjustError={adjustError}
          justAdjusted={justAdjusted}
          announcement={announcement}
          onAdjust={handleAdjust}
          onCreated={(product) => setResult({ found: true, product })}
        />
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
