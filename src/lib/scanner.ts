import { BrowserMultiFormatReader } from "@zxing/browser";
import { BarcodeFormat, DecodeHintType } from "@zxing/library";

const hints = new Map();
hints.set(DecodeHintType.POSSIBLE_FORMATS, [
  BarcodeFormat.EAN_13,
  BarcodeFormat.UPC_A,
  BarcodeFormat.EAN_8,
]);
// Más lento por frame, pero las webcams de notebook (foco fijo, mucho ruido) fallan sin esto.
hints.set(DecodeHintType.TRY_HARDER, true);

// El default de zxing pide ~640x480, poco para leer las barras finas de un código
// chico con una webcam. "ideal" no rompe si la cámara no llega a esa resolución.
export const CAMERA_CONSTRAINTS: MediaStreamConstraints = {
  video: {
    facingMode: { ideal: "environment" },
    width: { ideal: 1920 },
    height: { ideal: 1080 },
  },
};

export function createBarcodeReader() {
  return new BrowserMultiFormatReader(hints);
}

export function isValidManualBarcode(value: string): boolean {
  return /^\d{8,14}$/.test(value.trim());
}

/**
 * Excepciones que zxing dispara en cada frame que no contiene un código legible.
 * No son fallas de cámara: si se tratan como tales, un frame borroso apaga el
 * video para siempre.
 */
const TRANSIENT_DECODE_ERRORS = ["NotFoundException", "ChecksumException", "FormatException"];

export function isTransientDecodeError(error: unknown): boolean {
  // `name` sale de constructor.name (ts-custom-error), que el minificador de
  // producción renombra ("t", "e"...). `kind` es una propiedad estática, no se toca.
  const kind =
    typeof (error as { getKind?: unknown } | null)?.getKind === "function"
      ? String((error as { getKind: () => unknown }).getKind())
      : "";
  return [kind, errorName(error)].some((n) => TRANSIENT_DECODE_ERRORS.includes(n));
}

/** `getUserMedia` sólo existe en contextos seguros: HTTPS o localhost. */
export function isCameraAvailable(): boolean {
  return typeof navigator !== "undefined" && typeof navigator.mediaDevices?.getUserMedia === "function";
}

export const INSECURE_CONTEXT_MESSAGE =
  "La cámara necesita HTTPS (o localhost). Ingresá el código a mano.";

/**
 * Se lanza cuando `getUserMedia` no existe, para que el caso viaje por el mismo
 * `.catch()` que los errores de permiso en vez de necesitar un setState aparte.
 */
export function insecureContextError(): Error {
  const error = new Error(INSECURE_CONTEXT_MESSAGE);
  error.name = "InsecureContextError";
  return error;
}

/** Traduce el error de `getUserMedia` a algo que el usuario pueda accionar. */
export function cameraErrorMessage(error: unknown): string {
  switch (errorName(error)) {
    case "InsecureContextError":
      return INSECURE_CONTEXT_MESSAGE;
    case "NotAllowedError":
    case "SecurityError":
      return "Denegaste el permiso de cámara. Habilitalo desde el candado de la barra de direcciones, o ingresá el código a mano.";
    case "NotFoundError":
    case "OverconstrainedError":
      return "No se encontró ninguna cámara en este dispositivo. Ingresá el código a mano.";
    case "NotReadableError":
      return "Otra aplicación está usando la cámara. Cerrala e intentá de nuevo, o ingresá el código a mano.";
    default:
      return "No se pudo acceder a la cámara. Ingresá el código a mano.";
  }
}

function errorName(error: unknown): string {
  if (typeof error === "object" && error !== null && "name" in error) {
    return String((error as { name: unknown }).name);
  }
  return "";
}
