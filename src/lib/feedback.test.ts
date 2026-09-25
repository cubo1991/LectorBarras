import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/** AudioContext mínimo: cuenta los osciladores que arrancan (cada beep arranca uno). */
function stubAudio() {
  const started = vi.fn();
  class FakeAudioContext {
    currentTime = 0;
    destination = {};
    resume = async () => {};
    createGain() {
      return { gain: { value: 0 }, connect: (next: unknown) => next };
    }
    createOscillator() {
      const gain = this.createGain();
      return { frequency: { value: 0 }, connect: () => gain, start: started, stop: () => {} };
    }
  }
  vi.stubGlobal("AudioContext", FakeAudioContext);
  return started;
}

// El módulo guarda el AudioContext creado: se reimporta en cada test para que cada uno
// use su propio AudioContext simulado (si no, un test heredaría el del anterior).
const load = async () => {
  vi.resetModules();
  return import("./feedback");
};

describe("feedback", () => {
  const vibrate = vi.fn();

  beforeEach(() => {
    localStorage.clear();
    vibrate.mockClear();
    Object.defineProperty(navigator, "vibrate", { value: vibrate, configurable: true });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("suena al confirmar un código", async () => {
    const started = stubAudio();
    const { scanFeedback } = await load();

    scanFeedback();

    expect(started).toHaveBeenCalledOnce();
  });

  it("nunca vibra, aunque el dispositivo pueda", async () => {
    stubAudio();
    const { scanFeedback } = await load();

    scanFeedback();

    expect(vibrate).not.toHaveBeenCalled();
  });

  it("silenciado no suena, y la preferencia persiste", async () => {
    const started = stubAudio();
    const { isMuted, scanFeedback, setMuted } = await load();
    setMuted(true);

    scanFeedback();

    expect(started).not.toHaveBeenCalled();
    expect(isMuted()).toBe(true);
    setMuted(false);
    expect(isMuted()).toBe(false);
  });

  it("sin AudioContext no rompe (el escaneo sigue igual)", async () => {
    const { scanFeedback } = await load();
    expect(() => scanFeedback()).not.toThrow();
  });

  it("con el storage bloqueado no rompe y cuenta como no silenciado", async () => {
    const { isMuted, scanFeedback, setMuted } = await load();
    vi.stubGlobal("localStorage", {
      getItem: () => {
        throw new Error("blocked");
      },
      setItem: () => {
        throw new Error("blocked");
      },
    });

    expect(isMuted()).toBe(false);
    expect(() => setMuted(true)).not.toThrow();
    expect(() => scanFeedback()).not.toThrow();
  });
});
