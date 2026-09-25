import { describe, expect, it, vi } from "vitest";
import { createNativeDecoder, withFallback, type Decoder, type NativeDetectorConstructor } from "./scan-decoder";

const canvas = {} as HTMLCanvasElement;

function fakeDetector(formats: string[], results: unknown[] | Error) {
  const detect = vi.fn(async () => {
    if (results instanceof Error) throw results;
    return results;
  });
  const Ctor = vi.fn(function () {
    return { detect };
  }) as unknown as NativeDetectorConstructor;
  Ctor.getSupportedFormats = async () => formats;
  return { Ctor, detect };
}

const box = (width: number, height: number) => ({ width, height });

describe("createNativeDecoder", () => {
  it("sin BarcodeDetector devuelve null (se usa zxing)", async () => {
    expect(await createNativeDecoder(undefined)).toBeNull();
  });

  it("si no soporta ninguno de nuestros formatos, devuelve null", async () => {
    const { Ctor } = fakeDetector(["aztec", "pdf417"], []);

    expect(await createNativeDecoder(Ctor)).toBeNull();
  });

  it("si el detector no se puede crear, devuelve null sin lanzar", async () => {
    const Ctor = { getSupportedFormats: async () => { throw new Error("boom"); } } as unknown as NativeDetectorConstructor;

    expect(await createNativeDecoder(Ctor)).toBeNull();
  });

  it("pide sólo los formatos que soporta y traduce el formato al nombre de zxing", async () => {
    const { Ctor, detect } = fakeDetector(["ean_13", "qr_code", "aztec"], [
      { rawValue: "4006381333931", format: "ean_13", boundingBox: box(200, 80) },
    ]);

    const decode = (await createNativeDecoder(Ctor))!;

    expect(Ctor).toHaveBeenCalledWith({ formats: ["ean_13", "qr_code"] });
    expect(await decode(canvas)).toEqual({ text: "4006381333931", format: "EAN_13" });
    expect(detect).toHaveBeenCalledOnce();
  });

  it("sin códigos en el cuadro devuelve null", async () => {
    const { Ctor } = fakeDetector(["ean_13"], []);

    expect(await (await createNativeDecoder(Ctor))!(canvas)).toBeNull();
  });

  it("con varios códigos elige el más grande", async () => {
    const { Ctor } = fakeDetector(["ean_13"], [
      { rawValue: "CHICO", format: "ean_13", boundingBox: box(50, 20) },
      { rawValue: "GRANDE", format: "ean_13", boundingBox: box(300, 100) },
    ]);

    expect((await (await createNativeDecoder(Ctor))!(canvas))?.text).toBe("GRANDE");
  });
});

describe("withFallback", () => {
  const primaryReading = { text: "P" };
  const fallbackReading = { text: "F" };

  it("usa el motor principal mientras funcione", async () => {
    const primary: Decoder = vi.fn(async () => primaryReading);
    const fallback: Decoder = vi.fn(() => fallbackReading);

    expect(await withFallback(primary, fallback)(canvas)).toBe(primaryReading);
    expect(fallback).not.toHaveBeenCalled();
  });

  it("si el principal falla en ejecución, pasa al respaldo y no vuelve a intentar con el principal", async () => {
    const primary: Decoder = vi.fn(async () => {
      throw new Error("detect failed");
    });
    const fallback: Decoder = vi.fn(() => fallbackReading);
    const decode = withFallback(primary, fallback);

    expect(await decode(canvas)).toBe(fallbackReading);
    expect(await decode(canvas)).toBe(fallbackReading);
    expect(primary).toHaveBeenCalledOnce();
  });
});
