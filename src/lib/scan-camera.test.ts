import { describe, expect, it, vi } from "vitest";
import { cameraControls, enableContinuousFocus, NO_CONTROLS, setTorch, setZoom } from "./scan-camera";

function fakeTrack(caps: unknown, settings: unknown = {}, applyConstraints = vi.fn(async () => {})) {
  return {
    getCapabilities: caps === undefined ? undefined : () => caps,
    getSettings: () => settings,
    applyConstraints,
  } as unknown as MediaStreamTrack;
}

describe("cameraControls", () => {
  it("sin getCapabilities (iOS, Firefox) no ofrece ningún control", () => {
    expect(cameraControls(fakeTrack(undefined))).toEqual(NO_CONTROLS);
  });

  it("una cámara sin linterna ni zoom (webcam) no ofrece controles", () => {
    expect(cameraControls(fakeTrack({ width: { min: 1, max: 1920 } }))).toEqual(NO_CONTROLS);
  });

  it("ofrece linterna si el dispositivo la declara", () => {
    expect(cameraControls(fakeTrack({ torch: true })).torch).toBe(true);
    expect(cameraControls(fakeTrack({ torch: false })).torch).toBe(false);
  });

  it("ofrece zoom con el rango y el valor actual del dispositivo", () => {
    const controls = cameraControls(fakeTrack({ zoom: { min: 1, max: 8, step: 0.5 } }, { zoom: 2 }));

    expect(controls.zoom).toEqual({ min: 1, max: 8, step: 0.5, value: 2 });
  });

  it("un zoom sin rango real (min = max) no se ofrece", () => {
    expect(cameraControls(fakeTrack({ zoom: { min: 1, max: 1, step: 0.1 } })).zoom).toBeNull();
  });

  it("si getCapabilities lanza, no ofrece controles ni rompe", () => {
    const track = { getCapabilities: () => { throw new Error("nope"); } } as unknown as MediaStreamTrack;

    expect(cameraControls(track)).toEqual(NO_CONTROLS);
  });
});

describe("enableContinuousFocus", () => {
  it("pide enfoque continuo sólo si el dispositivo lo soporta", async () => {
    const apply = vi.fn(async () => {});

    expect(await enableContinuousFocus(fakeTrack({ focusMode: ["manual", "continuous"] }, {}, apply))).toBe(true);
    expect(apply).toHaveBeenCalledWith({ advanced: [{ focusMode: "continuous" }] });
  });

  it("si no lo soporta, no toca la cámara", async () => {
    const apply = vi.fn(async () => {});

    expect(await enableContinuousFocus(fakeTrack({ focusMode: ["manual"] }, {}, apply))).toBe(false);
    expect(apply).not.toHaveBeenCalled();
  });
});

describe("setTorch", () => {
  it("enciende y apaga la linterna", async () => {
    const apply = vi.fn(async () => {});
    const track = fakeTrack({ torch: true }, {}, apply);

    expect(await setTorch(track, true)).toBe(true);
    expect(apply).toHaveBeenCalledWith({ advanced: [{ torch: true }] });
    await setTorch(track, false);
    expect(apply).toHaveBeenLastCalledWith({ advanced: [{ torch: false }] });
  });

  it("si el dispositivo la rechaza, devuelve false sin lanzar", async () => {
    const track = fakeTrack({ torch: true }, {}, vi.fn(async () => { throw new Error("busy"); }));

    expect(await setTorch(track, true)).toBe(false);
  });
});

describe("setZoom", () => {
  const range = { min: 1, max: 4, step: 0.5, value: 1 };

  it("respeta el rango del dispositivo", async () => {
    const apply = vi.fn(async () => {});
    const track = fakeTrack({}, {}, apply);

    expect(await setZoom(track, range, 10)).toBe(4);
    expect(await setZoom(track, range, -3)).toBe(1);
  });

  it("alinea el valor al paso del dispositivo", async () => {
    const track = fakeTrack({}, {}, vi.fn(async () => {}));

    expect(await setZoom(track, range, 2.3)).toBe(2.5);
  });

  it("si el dispositivo lo rechaza, devuelve null", async () => {
    const track = fakeTrack({}, {}, vi.fn(async () => { throw new Error("nope"); }));

    expect(await setZoom(track, range, 2)).toBeNull();
  });
});
