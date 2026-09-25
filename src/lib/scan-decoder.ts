import { BarcodeFormat } from "@zxing/library";
import type { BarcodeFormatName } from "./barcode";
import { createBarcodeReader, isTransientDecodeError } from "./scanner";

/** Una lectura: el texto del código y, si el motor lo informa, su formato. */
export type Reading = { text: string; format?: BarcodeFormatName };

/** Motor de decodificación: recibe la zona del marco ya recortada en un canvas. */
export type Decoder = (canvas: HTMLCanvasElement) => Promise<Reading | null> | Reading | null;

const KNOWN_FORMATS: BarcodeFormatName[] = [
  "EAN_13",
  "EAN_8",
  "UPC_A",
  "UPC_E",
  "CODE_128",
  "CODE_39",
  "ITF",
  "QR_CODE",
];

function formatName(format: BarcodeFormat): BarcodeFormatName | undefined {
  const name = BarcodeFormat[format] as BarcodeFormatName;
  return KNOWN_FORMATS.includes(name) ? name : undefined;
}

/**
 * Motor de respaldo (software): funciona en cualquier navegador. Un frame sin código
 * legible es lo normal mientras se apunta la cámara, así que se devuelve `null`; cualquier
 * otro error sí se propaga.
 */
export function createZxingDecoder(): Decoder {
  const reader = createBarcodeReader();
  return (canvas) => {
    try {
      const result = reader.decodeFromCanvas(canvas);
      return { text: result.getText(), format: formatName(result.getBarcodeFormat()) };
    } catch (error) {
      if (isTransientDecodeError(error)) return null;
      throw error;
    }
  };
}

// ---- Motor nativo (Android Chrome) --------------------------------------------------
// `BarcodeDetector` no está en los tipos de TypeScript ni en todos los navegadores.

type NativeDetected = { rawValue: string; format: string; boundingBox: { width: number; height: number } };
type NativeDetector = { detect(image: CanvasImageSource): Promise<NativeDetected[]> };
export type NativeDetectorConstructor = {
  new (options: { formats: string[] }): NativeDetector;
  getSupportedFormats(): Promise<string[]>;
};

const NATIVE_FORMATS: Record<string, BarcodeFormatName> = {
  ean_13: "EAN_13",
  ean_8: "EAN_8",
  upc_a: "UPC_A",
  upc_e: "UPC_E",
  code_128: "CODE_128",
  code_39: "CODE_39",
  itf: "ITF",
  qr_code: "QR_CODE",
};

/**
 * Motor nativo del sistema: más preciso que el de software con desenfoque, ángulo y poca
 * luz. Devuelve `null` si el navegador no lo tiene o no soporta ninguno de nuestros formatos.
 * Con varios códigos dentro del marco elige el más grande (el que el usuario apunta).
 */
export async function createNativeDecoder(
  Detector: NativeDetectorConstructor | undefined = (globalThis as { BarcodeDetector?: NativeDetectorConstructor })
    .BarcodeDetector,
): Promise<Decoder | null> {
  if (!Detector) return null;
  try {
    const supported = await Detector.getSupportedFormats();
    const formats = Object.keys(NATIVE_FORMATS).filter((f) => supported.includes(f));
    if (formats.length === 0) return null;

    const detector = new Detector({ formats });
    return async (canvas) => {
      const found = await detector.detect(canvas);
      if (found.length === 0) return null;
      const area = (b: NativeDetected) => b.boundingBox.width * b.boundingBox.height;
      const best = found.reduce((a, b) => (area(b) > area(a) ? b : a));
      return { text: best.rawValue, format: NATIVE_FORMATS[best.format] };
    };
  } catch {
    return null; // un detector que ni se puede crear equivale a no tenerlo
  }
}

/** Usa `primary`; si falla en ejecución, pasa a `fallback` para siempre (sin mostrar error). */
export function withFallback(primary: Decoder, fallback: Decoder): Decoder {
  let primaryBroken = false;
  return async (canvas) => {
    if (!primaryBroken) {
      try {
        return await primary(canvas);
      } catch {
        primaryBroken = true;
      }
    }
    return fallback(canvas);
  };
}

/** El mejor motor disponible: nativo si existe (con zxing de respaldo), si no zxing. */
export async function createDecoder(): Promise<Decoder> {
  const zxing = createZxingDecoder();
  const native = await createNativeDecoder();
  return native ? withFallback(native, zxing) : zxing;
}
