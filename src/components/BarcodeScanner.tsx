"use client";

import { useEffect, useRef, useState } from "react";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";
import { isValidBarcodeInput, normalizeBarcode } from "@/lib/barcode";
import { scanFeedback, setMuted, unlockAudio, useMuted } from "@/lib/feedback";
import {
  CAMERA_CONSTRAINTS,
  cameraErrorMessage,
  createBarcodeReader,
  insecureContextError,
  isCameraAvailable,
  isTransientDecodeError,
} from "@/lib/scanner";

type Props = {
  onDetected: (code: string) => void;
};

export function BarcodeScanner({ onDetected }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  // Fatal: la cámara nunca arrancó o no está disponible → no mostramos el video.
  const [fatalError, setFatalError] = useState<string | null>(null);
  // No fatal: la cámara anda pero un frame falló de forma no esperada → avisamos
  // sin desmontar el video, porque desmontarlo deja al reader sin destino.
  const [readWarning, setReadWarning] = useState<string | null>(null);
  // El video puede tardar en arrancar (permiso, cámara lenta): sin este estado el
  // visor queda negro y mudo, indistinguible de una falla.
  const [ready, setReady] = useState(false);
  const muted = useMuted();
  // zxing entrega el mismo código en cada frame: el feedback suena una vez por detección.
  const lastFeedbackAt = useRef(0);
  const [manualCode, setManualCode] = useState("");
  const [manualError, setManualError] = useState<string | null>(null);

  useEffect(() => {
    const reader = createBarcodeReader();
    let controls: { stop: () => void } | undefined;
    let cancelled = false;

    const start = async () => {
      // Se lanza en vez de setear estado acá: así el caso de HTTP sin
      // getUserMedia sale por el mismo .catch() que un permiso denegado.
      if (!isCameraAvailable()) throw insecureContextError();

      return reader.decodeFromConstraints(
        CAMERA_CONSTRAINTS,
        videoRef.current ?? undefined,
        (result, error) => {
          if (result) {
            setReadWarning(null);
            if (Date.now() - lastFeedbackAt.current > 2000) {
              lastFeedbackAt.current = Date.now();
              scanFeedback();
            }
            onDetected(result.getText());
            return;
          }
          // Los errores por frame (sin código, checksum, formato) son lo normal
          // mientras se apunta la cámara: se ignoran.
          if (error && !isTransientDecodeError(error)) {
            setReadWarning("Hubo un problema leyendo la cámara. Podés ingresar el código a mano.");
          }
        },
      );
    };

    start()
      .then((c) => {
        if (cancelled) {
          c.stop();
          return;
        }
        controls = c;
      })
      .catch((error: unknown) => {
        setFatalError(cameraErrorMessage(error));
      });

    return () => {
      cancelled = true;
      controls?.stop();
    };
  }, [onDetected]);

  function handleManualSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!isValidBarcodeInput(manualCode)) {
      setManualError("Ingresá un código de 4 a 64 caracteres (letras, números o símbolos)");
      return;
    }
    setManualError(null);
    onDetected(normalizeBarcode(manualCode));
  }

  return (
    // El primer toque en el escáner desbloquea el audio (los navegadores no dejan sonar antes).
    <div className="flex flex-col gap-4" onPointerDown={unlockAudio}>
      {!fatalError && (
        <div className="relative aspect-video overflow-hidden rounded-control bg-black">
          <video
            ref={videoRef}
            className="size-full object-cover"
            muted
            playsInline
            onPlaying={() => setReady(true)}
          />
          {/* Marco de encuadre: orienta dónde poner el código. Decorativo. */}
          <div
            aria-hidden
            className="pointer-events-none absolute inset-x-[10%] inset-y-[25%] rounded-control border-2 border-white/80"
          />
          {!ready && (
            <p role="status" className="absolute inset-0 flex items-center justify-center text-sm text-white">
              Iniciando cámara…
            </p>
          )}
        </div>
      )}
      {!fatalError && (
        <Button
          variant="secondary"
          onClick={() => setMuted(!muted)}
          className="self-end text-sm"
        >
          {muted ? "Sonido: silenciado" : "Sonido: activado"}
        </Button>
      )}
      {fatalError && <Alert>{fatalError}</Alert>}
      {!fatalError && readWarning && <Alert tone="warning">{readWarning}</Alert>}

      <form onSubmit={handleManualSubmit} className="flex items-start gap-2">
        <div className="min-w-0 flex-1">
          <Field
            label="Código de barras"
            type="text"
            name="manual-code"
            autoCapitalize="off"
            autoComplete="off"
            spellCheck={false}
            placeholder="Ingresar código manualmente"
            value={manualCode}
            onChange={(e) => setManualCode(e.target.value)}
            error={manualError ?? undefined}
          />
        </div>
        <Button type="submit" className="mt-6">
          Buscar
        </Button>
      </form>
    </div>
  );
}
