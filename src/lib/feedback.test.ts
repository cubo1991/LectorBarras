import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { isMuted, scanFeedback, setMuted } from "./feedback";

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

  it("vibra al detectar un código", () => {
    scanFeedback();

    expect(vibrate).toHaveBeenCalledOnce();
  });

  it("silenciado no vibra ni suena, y la preferencia persiste", () => {
    setMuted(true);

    scanFeedback();

    expect(vibrate).not.toHaveBeenCalled();
    expect(isMuted()).toBe(true);
    setMuted(false);
    expect(isMuted()).toBe(false);
  });

  it("sin navigator.vibrate ni AudioContext no rompe (iOS Safari)", () => {
    Object.defineProperty(navigator, "vibrate", { value: undefined, configurable: true });

    expect(() => scanFeedback()).not.toThrow();
  });

  it("con el storage bloqueado no rompe y cuenta como no silenciado", () => {
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
