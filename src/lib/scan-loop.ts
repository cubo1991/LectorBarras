import type { Decoder, Reading } from "./scan-decoder";
import { guideToVideoRect } from "./scan-geometry";
import { GUIDE, SCAN_INTERVAL_MS } from "./scanner";

type Options = {
  video: HTMLVideoElement;
  decode: Decoder;
  onReading: (reading: Reading) => void;
  /** Una vuelta que no encontró ningún código (lo normal mientras no hay nada en el marco). */
  onMiss?: () => void;
  onError: (error: unknown) => void;
};

/**
 * Bucle de lectura: cada `SCAN_INTERVAL_MS` recorta del video SÓLO la zona del marco,
 * la dibuja en un canvas y la decodifica. Lo que queda fuera del marco nunca llega al
 * decodificador. Las lecturas no se encolan: la siguiente se agenda cuando termina la
 * actual, así una decodificación lenta no acumula trabajo. Devuelve la función que lo detiene.
 */
export function startScanLoop({ video, decode, onReading, onMiss, onError }: Options): () => void {
  const canvas = document.createElement("canvas");
  // Se lee el canvas en cada vuelta: este hint evita copiarlo a la GPU y de vuelta.
  const context = canvas.getContext("2d", { willReadFrequently: true });
  let stopped = false;
  let timer: ReturnType<typeof setTimeout> | undefined;

  async function tick() {
    const startedAt = performance.now();
    try {
      if (context && video.videoWidth > 0 && video.videoHeight > 0) {
        const rect = guideToVideoRect(
          { width: video.videoWidth, height: video.videoHeight },
          { width: video.clientWidth, height: video.clientHeight },
          GUIDE,
        );
        if (rect.width > 0 && rect.height > 0) {
          canvas.width = rect.width;
          canvas.height = rect.height;
          context.drawImage(video, rect.x, rect.y, rect.width, rect.height, 0, 0, rect.width, rect.height);
          const reading = await decode(canvas);
          if (!stopped) {
            if (reading) onReading(reading);
            else onMiss?.();
          }
        }
      }
    } catch (error) {
      if (!stopped) onError(error);
    }
    if (!stopped) {
      timer = setTimeout(tick, Math.max(0, SCAN_INTERVAL_MS - (performance.now() - startedAt)));
    }
  }

  timer = setTimeout(tick, SCAN_INTERVAL_MS);

  return () => {
    stopped = true;
    if (timer) clearTimeout(timer);
  };
}
