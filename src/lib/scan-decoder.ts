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
