import { BrowserMultiFormatReader } from "@zxing/browser";
import { BarcodeFormat, DecodeHintType } from "@zxing/library";

const hints = new Map();
hints.set(DecodeHintType.POSSIBLE_FORMATS, [BarcodeFormat.EAN_13, BarcodeFormat.UPC_A]);

export function createBarcodeReader() {
  return new BrowserMultiFormatReader(hints);
}

export function isValidManualBarcode(value: string): boolean {
  return /^\d{8,14}$/.test(value.trim());
}
