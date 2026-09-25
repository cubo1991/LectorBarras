export type Rearm = {
  /** Llamar con CADA lectura válida (aunque todavía no esté confirmada): mide si el código sigue a la vista. */
  observe(code: string, now: number): void;
  /** Llamar cada vez que una vuelta del bucle NO encontró ningún código válido. */
  miss(): void;
  /** ¿Esta lectura ya confirmada debe contarse como una presentación nueva? */
  shouldCount(code: string): boolean;
};

/**
 * Con la cámara siempre viva, el mismo código sigue a la vista después de confirmarse y
 * se volvería a confirmar cada ~0,3 s. Regla: un código ya contado NO vuelve a contar
 * mientras siga a la vista; recién vuelve a contar cuando salió del marco o cuando se
 * confirma otro código distinto.
 *
 * "Salió del marco" exige DOS cosas a la vez: que hayan pasado `absentMs` sin leerse y que
 * hayan fallado al menos `minMisses` vueltas seguidas. Sólo el tiempo no alcanza: en un
 * celular lento cada decodificación puede tardar más que `absentMs`, y un código quieto
 * a la vista pasaría por "ausente" y se contaría dos veces (se vio en los e2e).
 *
 * Límite conocido: un código a la vista pero ilegible (borroso, en movimiento) durante ese
 * lapso se toma como que salió. Los valores se ajustan en `scanner.ts`.
 */
export function createRearm(absentMs: number, minMisses: number): Rearm {
  let counted: string | null = null;
  let lastSeenAt = 0;
  let misses = 0;

  return {
    observe(code, now) {
      if (code === counted) {
        // Volvió a leerse tras una ausencia larga y con vueltas vacías de por medio: presentación nueva.
        if (now - lastSeenAt >= absentMs && misses >= minMisses) counted = null;
        lastSeenAt = now;
      }
      misses = 0;
    },
    miss() {
      misses += 1;
    },
    shouldCount(code) {
      if (code === counted) return false;
      counted = code;
      return true;
    },
  };
}
