"use client";

import { useEffect, useRef, useState } from "react";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";
import { acceptReading, isValidBarcodeInput, normalizeBarcode } from "@/lib/barcode";
import { scanFeedback, setMuted, unlockAudio, useMuted } from "@/lib/feedback";
import { createConfirmer } from "@/lib/scan-confirm";
import { createZxingDecoder } from "@/lib/scan-decoder";
import { startScanLoop } from "@/lib/scan-loop";
import {
  CAMERA_CONSTRAINTS,
  cameraErrorMessage,
  CONFIRM_READS,
  CONFIRM_WINDOW_MS,
  GUIDE,
  insecureContextError,
  isCameraAvailable,
} from "@/lib/scanner";

type Props = {
  onDetected: (code: string) => void;
};

export function BarcodeScanner({ onDetected }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  // Fatal: la cámara nunca arrancó o no está disponible → no mostramos el video.
  const [fatalError, setFatalError] = useState<string | null>(null);
  // No fatal: la cámara anda pero una lectura falló de forma no esperada → avisamos
  // sin desmontar el video (desmontarlo cortaría el stream).
  const [readWarning, setReadWarning] = useState<string | null>(null);
  // El video puede tardar en arrancar (permiso, cámara lenta): sin este estado el
  // visor queda negro y mudo, indistinguible de una falla.
  const [ready, setReady] = useState(false);
  const muted = useMuted();
  const [manualCode, setManualCode] = useState("");
  const [manualError, setManualError] = useState<string | null>(null);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    let stream: MediaStream | undefined;
    let stopLoop: (() => void) | undefined;
    let cancelled = false;

    const start = async () => {
      // Se lanza en vez de setear estado acá: así el caso de HTTP sin
      // getUserMedia sale por el mismo .catch() que un permiso denegado.
      if (!isCameraAvailable()) throw insecureContextError();

      stream = await navigator.mediaDevices.getUserMedia(CAMERA_CONSTRAINTS);
      if (cancelled) return;
      video.srcObject = stream;
      await video.play();
      if (cancelled) return;

      const confirmer = createConfirmer(CONFIRM_READS, CONFIRM_WINDOW_MS);
      stopLoop = startScanLoop({
        video,
        decode: createZxingDecoder(),
        onReading: (reading) => {
          setReadWarning(null);
          // Descarta lo que no pasa el filtro (formato, dígito verificador, largo)...
          const code = acceptReading(reading.text, reading.format);
          if (!code) return;
          // ...y sólo acepta un código tras varias lecturas iguales seguidas.
          const confirmed = confirmer.push(code, Date.now());
          if (!confirmed) return;
          confirmer.reset();
          scanFeedback();
          onDetected(confirmed);
        },
        // Un frame sin código es lo normal (el decodificador lo devuelve como null);
        // llegar acá es un fallo real de lectura.
        onError: () => setReadWarning("Hubo un problema leyendo la cámara. Podés ingresar el código a mano."),
      });
    };

    start().catch((error: unknown) => {
      if (!cancelled) setFatalError(cameraErrorMessage(error));
    });

    return () => {
      cancelled = true;
      stopLoop?.();
      stream?.getTracks().forEach((track) => track.stop());
      video.srcObject = null;
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
            className="pointer-events-none absolute rounded-control border-2 border-white/80"
            style={{
              // Es exactamente la zona que se decodifica (GUIDE): lo de afuera se ignora.
              left: `${((1 - GUIDE.widthFraction) / 2) * 100}%`,
              right: `${((1 - GUIDE.widthFraction) / 2) * 100}%`,
              top: `${((1 - GUIDE.heightFraction) / 2) * 100}%`,
              bottom: `${((1 - GUIDE.heightFraction) / 2) * 100}%`,
            }}
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
