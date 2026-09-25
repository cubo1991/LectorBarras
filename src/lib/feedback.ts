import { useSyncExternalStore } from "react";

/**
 * Aviso de "código aceptado": un beep corto, y nada más. Se descartó la vibración a
 * pedido del usuario. El audio necesita un gesto previo para desbloquearse (ver
 * `unlockAudio`); si algo falta, no pasa nada y el escaneo sigue igual.
 */
const STORAGE_KEY = "lectorbarras:muted";

const listeners = new Set<() => void>();

export function isMuted(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) === "1";
  } catch {
    return false; // storage bloqueado (modo privado, datos del sitio bloqueados)
  }
}

export function setMuted(muted: boolean): void {
  try {
    localStorage.setItem(STORAGE_KEY, muted ? "1" : "0");
  } catch {
    // sin storage la preferencia sólo vale hasta recargar; no es un error
  }
  listeners.forEach((notify) => notify());
}

function subscribe(notify: () => void) {
  listeners.add(notify);
  return () => listeners.delete(notify);
}

/** Estado de silencio para React. En el server (y en la hidratación) es `false`. */
export function useMuted(): boolean {
  return useSyncExternalStore(subscribe, isMuted, () => false);
}

let audio: AudioContext | undefined;

function audioContext(): AudioContext | undefined {
  if (audio) return audio;
  const Ctx =
    globalThis.AudioContext ?? (globalThis as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctx) return undefined;
  audio = new Ctx();
  return audio;
}

/** Llamar desde un gesto del usuario (toque/click): los navegadores no dejan sonar antes. */
export function unlockAudio(): void {
  void audioContext()?.resume().catch(() => {});
}

function beep(): void {
  const ctx = audioContext();
  if (!ctx) return;
  const oscillator = ctx.createOscillator();
  const gain = ctx.createGain();
  oscillator.frequency.value = 1000;
  gain.gain.value = 0.1;
  oscillator.connect(gain).connect(ctx.destination);
  oscillator.start();
  oscillator.stop(ctx.currentTime + 0.12);
}

export function scanFeedback(): void {
  if (isMuted()) return;
  try {
    beep();
  } catch {
    // el feedback nunca debe romper el escaneo
  }
}
