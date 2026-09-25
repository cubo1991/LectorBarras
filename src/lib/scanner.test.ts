import { ChecksumException, FormatException, NotFoundException } from "@zxing/library";
import { describe, expect, it } from "vitest";
import {
  cameraErrorMessage,
  INSECURE_CONTEXT_MESSAGE,
  insecureContextError,
  isCameraAvailable,
  isTransientDecodeError,
} from "./scanner";

describe("isTransientDecodeError", () => {
  it("trata los errores por frame como transitorios", () => {
    for (const name of ["NotFoundException", "ChecksumException", "FormatException"]) {
      expect(isTransientDecodeError({ name })).toBe(true);
    }
  });

  it("reconoce los errores reales de zxing aunque el minificador les cambie el name", () => {
    for (const E of [NotFoundException, ChecksumException, FormatException]) {
      const error = new E();
      Object.defineProperty(error, "name", { value: "t" }); // lo que queda en el bundle de producción
      expect(isTransientDecodeError(error)).toBe(true);
    }
  });

  it("no trata un fallo real de cámara como transitorio", () => {
    expect(isTransientDecodeError({ name: "NotReadableError" })).toBe(false);
  });

  it("tolera null/undefined y objetos sin name", () => {
    expect(isTransientDecodeError(null)).toBe(false);
    expect(isTransientDecodeError(undefined)).toBe(false);
    expect(isTransientDecodeError({})).toBe(false);
  });
});

describe("cameraErrorMessage", () => {
  it("explica el permiso denegado y ofrece el ingreso manual", () => {
    const message = cameraErrorMessage({ name: "NotAllowedError" });
    expect(message).toMatch(/permiso/i);
    expect(message).toMatch(/a mano/i);
  });

  it("distingue que no hay cámara en el dispositivo", () => {
    expect(cameraErrorMessage({ name: "NotFoundError" })).toMatch(/no se encontró/i);
  });

  it("distingue que la cámara está ocupada", () => {
    expect(cameraErrorMessage({ name: "NotReadableError" })).toMatch(/otra aplicación/i);
  });

  it("cae en un mensaje genérico ante un error desconocido", () => {
    expect(cameraErrorMessage(new Error("boom"))).toMatch(/no se pudo acceder/i);
  });
});

describe("isCameraAvailable", () => {
  it("es false cuando el navegador no expone getUserMedia (HTTP, no localhost)", () => {
    const original = navigator.mediaDevices;
    Object.defineProperty(navigator, "mediaDevices", { value: undefined, configurable: true });

    expect(isCameraAvailable()).toBe(false);

    Object.defineProperty(navigator, "mediaDevices", { value: original, configurable: true });
  });

  it("es true cuando getUserMedia existe", () => {
    const original = navigator.mediaDevices;
    Object.defineProperty(navigator, "mediaDevices", {
      value: { getUserMedia: () => Promise.resolve({} as MediaStream) },
      configurable: true,
    });

    expect(isCameraAvailable()).toBe(true);

    Object.defineProperty(navigator, "mediaDevices", { value: original, configurable: true });
  });
});

describe("insecureContextError", () => {
  it("cameraErrorMessage lo traduce al mensaje de HTTPS", () => {
    expect(cameraErrorMessage(insecureContextError())).toBe(INSECURE_CONTEXT_MESSAGE);
  });
});
