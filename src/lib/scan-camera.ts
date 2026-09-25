/**
 * Controles de cámara que sólo existen en algunos dispositivos (sobre todo Android
 * Chrome): enfoque continuo, linterna y zoom. Se descubren con `getCapabilities()` y
 * todo es opcional: si falta la API o el dispositivo no lo declara, no se muestra
 * nada y el escaneo sigue igual. Estas propiedades no están en los tipos DOM de TypeScript.
 */
type ExtendedCapabilities = {
  torch?: boolean;
  zoom?: { min: number; max: number; step: number };
  focusMode?: string[];
};
type ExtendedTrack = {
  getCapabilities?: () => ExtendedCapabilities;
  getSettings?: () => { zoom?: number };
};

export type ZoomRange = { min: number; max: number; step: number; value: number };
export type CameraControls = { torch: boolean; zoom: ZoomRange | null };

export const NO_CONTROLS: CameraControls = { torch: false, zoom: null };

function capabilitiesOf(track: MediaStreamTrack): ExtendedCapabilities {
  try {
    return (track as unknown as ExtendedTrack).getCapabilities?.() ?? {};
  } catch {
    return {};
  }
}

/** Qué controles ofrecer para esta cámara. Sin capacidades declaradas → ninguno. */
export function cameraControls(track: MediaStreamTrack): CameraControls {
  const caps = capabilitiesOf(track);
  const zoom = caps.zoom && caps.zoom.max > caps.zoom.min ? caps.zoom : null;
  return {
    torch: caps.torch === true,
    zoom: zoom && {
      min: zoom.min,
      max: zoom.max,
      step: zoom.step || 0.1,
      value: (track as unknown as ExtendedTrack).getSettings?.().zoom ?? zoom.min,
    },
  };
}

async function apply(track: MediaStreamTrack, constraint: Record<string, unknown>): Promise<boolean> {
  try {
    await track.applyConstraints({ advanced: [constraint] } as MediaTrackConstraints);
    return true;
  } catch {
    return false; // el dispositivo lo rechazó: se ignora, el escaneo no depende de esto
  }
}

/** Enfoque continuo (autofoco permanente) si el dispositivo lo soporta. */
export async function enableContinuousFocus(track: MediaStreamTrack): Promise<boolean> {
  if (!capabilitiesOf(track).focusMode?.includes("continuous")) return false;
  return apply(track, { focusMode: "continuous" });
}

export function setTorch(track: MediaStreamTrack, on: boolean): Promise<boolean> {
  return apply(track, { torch: on });
}

/** Fija el zoom dentro del rango del dispositivo y alineado a su paso. Devuelve el valor aplicado. */
export async function setZoom(track: MediaStreamTrack, zoom: ZoomRange, requested: number): Promise<number | null> {
  const stepped = zoom.min + Math.round((requested - zoom.min) / zoom.step) * zoom.step;
  const value = Math.min(Math.max(stepped, zoom.min), zoom.max);
  return (await apply(track, { zoom: value })) ? value : null;
}
