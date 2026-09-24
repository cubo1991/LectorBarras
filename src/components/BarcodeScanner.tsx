"use client";

import { useEffect, useRef, useState } from "react";
import { createBarcodeReader, isValidManualBarcode } from "@/lib/scanner";

type Props = {
  onDetected: (code: string) => void;
};

export function BarcodeScanner({ onDetected }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [manualCode, setManualCode] = useState("");
  const [manualError, setManualError] = useState<string | null>(null);

  useEffect(() => {
    const reader = createBarcodeReader();
    let controls: { stop: () => void } | undefined;

    reader
      .decodeFromVideoDevice(undefined, videoRef.current ?? undefined, (result, error) => {
        if (result) {
          onDetected(result.getText());
        }
        // NotFoundException se dispara en cada frame sin código: no es un error real, se ignora.
        if (error && error.name !== "NotFoundException") {
          setCameraError("No se pudo leer la cámara. Usá el ingreso manual.");
        }
      })
      .then((c) => {
        controls = c;
      })
      .catch(() => {
        setCameraError("No se pudo acceder a la cámara. Usá el ingreso manual.");
      });

    return () => controls?.stop();
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
      {!cameraError && <video ref={videoRef} className="w-full max-w-md" muted playsInline />}
      {cameraError && <p className="text-sm text-red-600">{cameraError}</p>}

      <form onSubmit={handleManualSubmit} className="flex gap-2">
        <input
          type="text"
          inputMode="numeric"
          placeholder="Ingresar código manualmente"
          value={manualCode}
          onChange={(e) => setManualCode(e.target.value)}
          className="flex-1 border p-2"
        />
        <button type="submit" className="bg-black px-4 py-2 text-white">
          Buscar
        </button>
      </form>
      {manualError && <p className="text-sm text-red-600">{manualError}</p>}
    </div>
  );
}
