/**
 * Fuente de verdad única para validar y normalizar códigos de barras: la usan el
 * escáner, el ingreso manual y el backend. Módulo puro (sin React ni DB).
 *
 * Los nombres de formato coinciden con `BarcodeFormat` de @zxing/library.
 */
export type BarcodeFormatName =
  | "EAN_13"
  | "EAN_8"
  | "UPC_A"
  | "UPC_E"
  | "CODE_128"
  | "CODE_39"
  | "ITF"
  | "QR_CODE";

const DIGITS = /^\d+$/;

/** Dígito verificador GS1 (módulo 10) de un código SIN su último dígito. */
export function gs1CheckDigit(body: string): number {
  let sum = 0;
  // De derecha a izquierda, empezando con peso 3 (el dígito verificador tendría peso 1).
  for (let i = 0; i < body.length; i++) {
    const digit = Number(body[body.length - 1 - i]);
    sum += digit * (i % 2 === 0 ? 3 : 1);
  }
  return (10 - (sum % 10)) % 10;
}

function hasValidGs1Digit(code: string): boolean {
  return DIGITS.test(code) && gs1CheckDigit(code.slice(0, -1)) === Number(code.slice(-1));
}

/** Expande un UPC-E de 8 dígitos (sistema 0/1 + 6 + verificador) al UPC-A de 12. */
export function expandUpcE(code: string): string | null {
  if (!/^[01]\d{7}$/.test(code)) return null;
  const system = code[0];
  const [d1, d2, d3, d4, d5, d6] = code.slice(1, 7);
  const check = code[7];

  let body: string;
  if ("012".includes(d6)) body = `${system}${d1}${d2}${d6}0000${d3}${d4}${d5}`;
  else if (d6 === "3") body = `${system}${d1}${d2}${d3}00000${d4}${d5}`;
  else if (d6 === "4") body = `${system}${d1}${d2}${d3}${d4}00000${d5}`;
  else body = `${system}${d1}${d2}${d3}${d4}${d5}0000${d6}`;

  return body + check;
}

/**
 * ¿El dígito verificador del código es válido para su formato? Los formatos sin
 * verificador propio (Code 39, QR, ITF de largo distinto de 14) devuelven `true`:
 * ahí la garantía es la confirmación por lecturas repetidas y la corrección de
 * errores del propio formato (Code 128 y QR).
 */
export function hasValidCheckDigit(code: string, format: BarcodeFormatName): boolean {
  switch (format) {
    case "EAN_13":
      return code.length === 13 && hasValidGs1Digit(code);
    case "EAN_8":
      return code.length === 8 && hasValidGs1Digit(code);
    case "UPC_A":
      return code.length === 12 && hasValidGs1Digit(code);
    case "UPC_E": {
      const upcA = expandUpcE(code);
      return upcA !== null && hasValidGs1Digit(upcA);
    }
    case "ITF":
      return DIGITS.test(code) && code.length === 14 ? hasValidGs1Digit(code) : true;
    default:
      return true;
  }
}

/**
 * Forma canónica con la que se guarda y se busca un producto. UPC-A (12 dígitos) y
 * UPC-E pasan a GTIN-13 (`0` + UPC-A), porque un mismo producto puede leerse como 12
 * dígitos o como EAN-13 con un `0` adelante según el motor de lectura. El resto
 * (EAN-13, EAN-8, ITF-14, alfanuméricos) queda igual. Sin `format`, un código de 12
 * dígitos se toma por UPC-A y uno de 8 por EAN-8.
 */
export function normalizeBarcode(raw: string, format?: BarcodeFormatName): string {
  const code = raw.trim();
  if (format === "UPC_E") {
    const upcA = expandUpcE(code);
    return upcA ? `0${upcA}` : code;
  }
  if ((format === "UPC_A" || format === undefined) && /^\d{12}$/.test(code)) return `0${code}`;
  return code;
}

/**
 * Códigos con los que puede estar guardado un producto: el canónico y, si es un
 * GTIN-13 que empieza con `0`, su variante de 12 dígitos (productos cargados antes
 * de normalizar). Sin duplicados, el canónico primero.
 */
export function barcodeCandidates(raw: string, format?: BarcodeFormatName): string[] {
  const canonical = normalizeBarcode(raw, format);
  const candidates = [canonical];
  if (/^0\d{12}$/.test(canonical)) candidates.push(canonical.slice(1));
  return candidates;
}

/**
 * Validación del ingreso manual: tolerante a propósito. Un comercio puede usar
 * códigos internos (numéricos sin GTIN válido, Code 128/39 alfanuméricos), así que
 * sólo se exige un texto ASCII imprimible de 4 a 64 caracteres. El dígito
 * verificador se exige únicamente a las lecturas de cámara, donde se conoce el formato.
 */
export function isValidBarcodeInput(raw: string): boolean {
  return /^[\x20-\x7E]{4,64}$/.test(raw.trim());
}
