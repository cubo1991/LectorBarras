import { describe, expect, it } from "vitest";
import {
  barcodeCandidates,
  expandUpcE,
  gs1CheckDigit,
  hasValidCheckDigit,
  isValidBarcodeInput,
  normalizeBarcode,
} from "./barcode";

// Vectores reales (no calculados con la propia función, para no probar en círculo).
const EAN13 = "4006381333931";
const EAN8 = "96385074";
const UPC_A = "036000291452";
const UPC_E = "04252614"; // expande a 042100005264
const UPC_E_EXPANDED = "042100005264";

describe("gs1CheckDigit", () => {
  it("calcula el verificador de los vectores conocidos", () => {
    expect(gs1CheckDigit("400638133393")).toBe(1);
    expect(gs1CheckDigit("9638507")).toBe(4);
    expect(gs1CheckDigit("03600029145")).toBe(2);
  });
});

describe("hasValidCheckDigit", () => {
  it("acepta los códigos GS1 válidos", () => {
    expect(hasValidCheckDigit(EAN13, "EAN_13")).toBe(true);
    expect(hasValidCheckDigit(EAN8, "EAN_8")).toBe(true);
    expect(hasValidCheckDigit(UPC_A, "UPC_A")).toBe(true);
    expect(hasValidCheckDigit(UPC_E, "UPC_E")).toBe(true);
  });

  it("rechaza un dígito verificador incorrecto", () => {
    expect(hasValidCheckDigit("4006381333932", "EAN_13")).toBe(false);
    expect(hasValidCheckDigit("96385075", "EAN_8")).toBe(false);
    expect(hasValidCheckDigit("036000291453", "UPC_A")).toBe(false);
    expect(hasValidCheckDigit("04252615", "UPC_E")).toBe(false);
  });

  it("rechaza un largo que no corresponde al formato", () => {
    expect(hasValidCheckDigit(UPC_A, "EAN_13")).toBe(false);
    expect(hasValidCheckDigit("123", "EAN_8")).toBe(false);
  });

  it("valida ITF-14 y deja pasar los ITF de otro largo (sin verificador)", () => {
    const body = "1001234567890";
    const itf14 = `${body}${gs1CheckDigit(body)}`;
    expect(hasValidCheckDigit(itf14, "ITF")).toBe(true);
    expect(hasValidCheckDigit(`${body}${(gs1CheckDigit(body) + 1) % 10}`, "ITF")).toBe(false);
    expect(hasValidCheckDigit("12345678", "ITF")).toBe(true);
  });

  it("Code 128, Code 39 y QR no tienen verificador propio: pasan", () => {
    expect(hasValidCheckDigit("ABC-1234", "CODE_128")).toBe(true);
    expect(hasValidCheckDigit("ABC-1234", "CODE_39")).toBe(true);
    expect(hasValidCheckDigit("https://x.test/1", "QR_CODE")).toBe(true);
  });
});

describe("expandUpcE", () => {
  it("expande según el último dígito del cuerpo (0-2, 3, 4 y 5-9)", () => {
    expect(expandUpcE(UPC_E)).toBe(UPC_E_EXPANDED);
    expect(expandUpcE("01234565")).toBe("012345000065"); // d6 = 6 → caso 5-9
    expect(expandUpcE("01234535")).toBe("012300000455"); // d6 = 3
    expect(expandUpcE("01234548")).toBe("012340000058"); // d6 = 4
  });

  it("devuelve null si no es un UPC-E (sistema 0/1, 8 dígitos)", () => {
    expect(expandUpcE("21234565")).toBeNull();
    expect(expandUpcE("0123456")).toBeNull();
  });
});

describe("normalizeBarcode", () => {
  it("pasa UPC-A (12 dígitos) a GTIN-13 con un 0 adelante", () => {
    expect(normalizeBarcode(UPC_A, "UPC_A")).toBe(`0${UPC_A}`);
    expect(normalizeBarcode(UPC_A)).toBe(`0${UPC_A}`); // sin formato: 12 dígitos = UPC-A
  });

  it("expande UPC-E y lo pasa a GTIN-13", () => {
    expect(normalizeBarcode(UPC_E, "UPC_E")).toBe(`0${UPC_E_EXPANDED}`);
  });

  it("deja EAN-13, EAN-8, ITF-14 y alfanuméricos como están", () => {
    expect(normalizeBarcode(EAN13, "EAN_13")).toBe(EAN13);
    expect(normalizeBarcode(EAN8)).toBe(EAN8);
    expect(normalizeBarcode("10012345678902")).toBe("10012345678902");
    expect(normalizeBarcode("ABC-1234", "CODE_128")).toBe("ABC-1234");
  });

  it("recorta espacios", () => {
    expect(normalizeBarcode("  ABC-1234  ")).toBe("ABC-1234");
  });

  it("un UPC-A y su EAN-13 equivalente dan el mismo código", () => {
    expect(normalizeBarcode(UPC_A, "UPC_A")).toBe(normalizeBarcode(`0${UPC_A}`, "EAN_13"));
  });
});

describe("barcodeCandidates", () => {
  it("un GTIN-13 con 0 adelante también se busca como 12 dígitos (productos viejos)", () => {
    expect(barcodeCandidates(`0${UPC_A}`)).toEqual([`0${UPC_A}`, UPC_A]);
    expect(barcodeCandidates(UPC_A)).toEqual([`0${UPC_A}`, UPC_A]);
  });

  it("un EAN-13 que no empieza con 0 tiene un solo candidato", () => {
    expect(barcodeCandidates(EAN13)).toEqual([EAN13]);
  });

  it("los alfanuméricos tienen un solo candidato", () => {
    expect(barcodeCandidates("ABC-1234")).toEqual(["ABC-1234"]);
  });
});

describe("isValidBarcodeInput", () => {
  it("acepta códigos numéricos, Code 128/39 y con espacios internos", () => {
    for (const ok of [EAN13, EAN8, "ABC-1234", "AB 12", "x".repeat(64)]) {
      expect(isValidBarcodeInput(ok), ok).toBe(true);
    }
  });

  it("recorta los espacios de los extremos antes de validar", () => {
    expect(isValidBarcodeInput("  ABC-1234 ")).toBe(true);
  });

  it("rechaza vacío, muy corto, muy largo y caracteres no imprimibles", () => {
    for (const bad of ["", "   ", "abc", "x".repeat(65), "AB\nCD", "código", "ABÇ-1"]) {
      expect(isValidBarcodeInput(bad), JSON.stringify(bad)).toBe(false);
    }
  });
});
