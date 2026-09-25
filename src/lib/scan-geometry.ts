export type Size = { width: number; height: number };
export type Rect = { x: number; y: number; width: number; height: number };

/**
 * El video se muestra con `object-cover`: se escala hasta cubrir el contenedor y lo
 * que sobra se recorta. Por eso el marco que ve el usuario (un % del contenedor) no
 * es el mismo % del cuadro del video. Esto devuelve, en píxeles del video, el
 * rectángulo que queda bajo el marco centrado — la zona que hay que decodificar.
 */
export function guideToVideoRect(
  video: Size,
  container: Size,
  guide: { widthFraction: number; heightFraction: number },
): Rect {
  const scale = Math.max(container.width / video.width, container.height / video.height);
  const offsetX = (container.width - video.width * scale) / 2;
  const offsetY = (container.height - video.height * scale) / 2;

  const guideWidth = container.width * guide.widthFraction;
  const guideHeight = container.height * guide.heightFraction;
  const guideX = (container.width - guideWidth) / 2;
  const guideY = (container.height - guideHeight) / 2;

  const left = clamp((guideX - offsetX) / scale, 0, video.width);
  const top = clamp((guideY - offsetY) / scale, 0, video.height);
  const right = clamp((guideX + guideWidth - offsetX) / scale, 0, video.width);
  const bottom = clamp((guideY + guideHeight - offsetY) / scale, 0, video.height);

  return {
    x: Math.round(left),
    y: Math.round(top),
    width: Math.round(right - left),
    height: Math.round(bottom - top),
  };
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}
