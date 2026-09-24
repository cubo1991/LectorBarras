import { describe, expect, it } from "vitest";
import { isValidManualBarcode } from "./scanner";

describe("isValidManualBarcode", () => {
  it("accepts a 13-digit EAN-13 code", () => {
    expect(isValidManualBarcode("7791234567890")).toBe(true);
  });

  it("accepts a 12-digit UPC-A code", () => {
    expect(isValidManualBarcode("012345678905")).toBe(true);
  });

  it("trims surrounding whitespace", () => {
    expect(isValidManualBarcode("  7791234567890  ")).toBe(true);
  });

  it("rejects non-numeric input", () => {
    expect(isValidManualBarcode("not-a-barcode")).toBe(false);
  });

  it("rejects codes shorter than 8 digits", () => {
    expect(isValidManualBarcode("1234567")).toBe(false);
  });
});
