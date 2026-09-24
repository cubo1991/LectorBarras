"use client";

import { useEffect, useRef, useState } from "react";
import {
  cameraErrorMessage,
  createBarcodeReader,
  insecureContextError,
  isCameraAvailable,
  isTransientDecodeError,
  isValidManualBarcode,
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

      return reader.decodeFromVideoDevice(
        undefined,
        videoRef.current ?? undefined,
        (result, error) => {
          if (result) {
            setReadWarning(null);
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
    if (!isValidManualBarcode(manualCode)) {
      setManualError("Ingresá un código numérico de 8 a 14 dígitos");
      return;
    }
    setManualError(null);
    onDetected(manualCode.trim());
  }

  return (
    <div className="flex flex-col gap-4">
      {!fatalError && (
        <video ref={videoRef} className="w-full rounded bg-black" muted playsInline />
      )}
      {fatalError && (
        <p role="alert" className="text-sm text-red-600">
          {fatalError}
        </p>
      )}
      {!fatalError && readWarning && (
        <p role="alert" className="text-sm text-amber-700">
          {readWarning}
        </p>
      )}

      <form onSubmit={handleManualSubmit} className="flex flex-wrap gap-2">
        <input
          type="text"
          inputMode="numeric"
          placeholder="Ingresar código manualmente"
          value={manualCode}
          onChange={(e) => setManualCode(e.target.value)}
          className="min-w-0 flex-1 border p-2"
        />
        <button type="submit" className="min-h-11 bg-black px-4 py-2 text-white">
          Buscar
        </button>
      </form>
      {manualError && (
        <p role="alert" className="text-sm text-red-600">
          {manualError}
        </p>
      )}
    </div>
  );
}
