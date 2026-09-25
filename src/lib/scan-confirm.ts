export type Confirmer = {
  /** Registra una lectura; devuelve el código si ya está confirmado, o `null`. */
  push(code: string, now: number): string | null;
  reset(): void;
};

/**
 * Acepta un código recién cuando se leyó igual `needed` veces seguidas dentro de
 * `windowMs`. Una lectura suelta (o un código distinto en el medio) reinicia la
 * cuenta: es lo que evita ajustar el stock del producto equivocado por una mala lectura.
 */
export function createConfirmer(needed: number, windowMs: number): Confirmer {
  let last: string | null = null;
  let count = 0;
  let firstAt = 0;

  return {
    push(code, now) {
      if (code !== last || now - firstAt > windowMs) {
        last = code;
        count = 0;
        firstAt = now;
      }
      count += 1;
      return count >= needed ? code : null;
    },
    reset() {
      last = null;
      count = 0;
    },
  };
}
