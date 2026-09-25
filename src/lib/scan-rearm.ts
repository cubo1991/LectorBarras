export type Rearm = {
  /** Llamar con CADA lectura válida (aunque todavía no esté confirmada): mide si el código sigue a la vista. */
  observe(code: string, now: number): void;
  /** ¿Esta lectura ya confirmada debe contarse como una presentación nueva? */
  shouldCount(code: string): boolean;
};

/**
 * Con la cámara siempre viva, el mismo código sigue a la vista después de confirmarse y
 * se volvería a confirmar cada ~0,3 s. Regla: un código ya contado NO vuelve a contar
 * mientras siga a la vista; recién vuelve a contar cuando salió del marco (pasaron
 * `absentMs` sin leerse) o cuando se confirma otro código distinto.
 *
 * Límite conocido: si el código sigue a la vista pero no se lee durante `absentMs` (borroso,
 * movimiento), se toma como que salió. Por eso el valor es ajustable (`scanner.ts`).
 */
export function createRearm(absentMs: number): Rearm {
  let counted: string | null = null;
  let lastSeenAt = 0;

  return {
    observe(code, now) {
      if (code !== counted) return;
      // Volvió a leerse tras una ausencia larga: es una presentación nueva.
      if (now - lastSeenAt >= absentMs) counted = null;
      lastSeenAt = now;
    },
    shouldCount(code) {
      if (code === counted) return false;
      counted = code;
      return true;
    },
  };
}
