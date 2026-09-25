"use client";

import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { BarcodeScanner } from "@/components/BarcodeScanner";
import { ProductPanel } from "@/components/ProductPanel";
import Link from "next/link";
import { Alert } from "@/components/ui/Alert";
import { Switch } from "@/components/ui/Switch";
import { Toast } from "@/components/ui/Toast";
import { lookupProductByBarcode, type ProductLookupResult } from "@/lib/actions/products";
import { adjustStock } from "@/lib/actions/stock";

/** Cuánto dura el aviso de "Deshacer" (se pausa mientras tiene el foco o el puntero). */
const UNDO_TOAST_MS = 6000;

type Notice = {
  message: string;
  /** Sólo el aviso de un ajuste tiene acción de deshacer. */
  undo?: { productId: string; delta: number; label: string };
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
  // Modo "Sumar al escanear": cada lectura de CÁMARA de un producto conocido suma +1
  // (recepción de mercadería). Arranca siempre apagado y NO se recuerda entre visitas: un
  // "sumo solo" olvidado cambiaría stock al sólo consultar. Vive también en una ref porque
  // los manejadores de la cámara no pueden cambiar de identidad (reiniciarían la cámara).
  const [sumMode, setSumMode] = useState(false);
  const sumModeRef = useRef(false);
  // Unidades consecutivas del mismo producto sumadas automáticamente ("+3").
  const streak = useRef<{ productId: string; count: number } | null>(null);
  // Cada búsqueda lleva un número: si otra empezó mientras tanto, sólo la última pinta.
  const latestLookup = useRef(0);

  function toggleSumMode(on: boolean) {
    sumModeRef.current = on;
    streak.current = null;
    setSumMode(on);
  }

  /** Consulta: muestra la ficha, sin tocar el stock. Es lo que hacen el ingreso manual y `?code=`. */
  const consultBarcode = useCallback(async (barcode: string) => {
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
        setLookupError("No pudimos buscar el producto.");
      }
    } finally {
      if (mine === latestLookup.current) setLoading(false);
    }
  }, []);

  // El visor avisa una vez por presentación del código (ya filtrado, confirmado y sin
  // repetirse mientras sigue a la vista). En modo Suma, un producto conocido suma +1.
  const handleCameraDetected = useCallback(
    async (barcode: string) => {
      if (!sumModeRef.current) return consultBarcode(barcode);

      const mine = ++latestLookup.current;
      setLoading(true);
      setAdjustError(null);
      setLookupError(null);
      setJustAdjusted(false);
      setAnnouncement("");
      try {
        const lookup = await lookupProductByBarcode(barcode);
        if (!lookup.found) {
          // Desconocido: no suma nada; se ofrece cargarlo.
          streak.current = null;
          if (mine === latestLookup.current) setResult(lookup);
          return;
        }
        const outcome = await adjustStock({ productId: lookup.product.id, delta: 1 });
        if (!outcome.ok) {
          setAdjustError(outcome.error);
          if (mine === latestLookup.current) setResult(lookup);
          return;
        }
        const { product } = outcome;
        const count = streak.current?.productId === product.id ? streak.current.count + 1 : 1;
        streak.current = { productId: product.id, count };
        setJustAdjusted(true);
        setAnnouncement(`${product.name}: sumó 1, stock ${product.stock}`);
        // Sin "→": es una suma automática; el "+N" cuenta las unidades seguidas del mismo producto.
        setNotice({
          message: `${product.name} +${count} · stock ${product.stock}`,
          undo: { productId: product.id, delta: 1, label: "Deshacer último" },
        });
        if (mine === latestLookup.current) setResult({ found: true, product });
      } catch {
        if (mine === latestLookup.current) {
          setLookupError("No pudimos buscar el producto.");
        }
      } finally {
        if (mine === latestLookup.current) setLoading(false);
      }
    },
    [consultBarcode],
  );

  // Entrada desde el listado de productos (/products): ?code=<barcode> abre
  // directamente la ficha, sin pasar por la cámara.
  const codeFromUrl = useSearchParams().get("code");
  const lastCodeFromUrl = useRef<string | null>(null);

  useEffect(() => {
    // Se compara con el último código atendido (no un booleano): si la URL pasa
    // de ?code=A a ?code=B hay que buscar B.
    if (!codeFromUrl || lastCodeFromUrl.current === codeFromUrl) return;
    lastCodeFromUrl.current = codeFromUrl;
    consultBarcode(codeFromUrl);
  }, [codeFromUrl, consultBarcode]);

  /** Devuelve `true` si el ajuste se aplicó. */
  async function handleAdjust(productId: string, delta: number): Promise<boolean> {
    setAdjustError(null);
    const outcome = await adjustStock({ productId, delta });
    if (!outcome.ok) {
      setAdjustError(outcome.error);
      return false;
    }
    streak.current = null; // un ajuste manual corta la racha de sumas automáticas
    setResult({ found: true, product: outcome.product });
    setJustAdjusted(true);
    setAnnouncement(`${outcome.product.name}: stock actualizado a ${outcome.product.stock}`);
    setNotice({
      message: `${outcome.product.name}: ${outcome.product.stock - delta} → ${outcome.product.stock}`,
      undo: { productId, delta, label: "Deshacer" },
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
    if (streak.current?.productId === undo.productId) {
      streak.current = { ...streak.current, count: Math.max(0, streak.current.count - 1) };
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
      <BarcodeScanner onDetected={handleCameraDetected} onManualEntry={consultBarcode} />

      <div className="flex flex-col gap-2">
        <Switch label="Sumar al escanear" checked={sumMode} onChange={toggleSumMode} />
        {sumMode && (
          <p role="status" className="rounded-control border-2 border-accent bg-surface p-3 text-sm font-medium">
            Modo suma: cada lectura suma +1
          </p>
        )}
      </div>

      {loading && <p role="status">Buscando...</p>}
      {lookupError && (
        <Alert>
          {lookupError}{" "}
          <Link href="/login" className="font-medium underline">
            Volver a iniciar sesión
          </Link>
        </Alert>
      )}

      {notice && (
        <Toast
          message={notice.message}
          actionLabel={notice.undo?.label}
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
