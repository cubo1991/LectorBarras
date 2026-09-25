import { HELP_FIRST_MS, HELP_SECOND_MS } from "./scanner";

export type Hint = { level: "base" | "adjust" | "manual"; text: string };

/**
 * Pista del visor según cuánto hace que no hay ninguna lectura válida. Primero la
 * instrucción normal; a los ~8 s una acción concreta (acercar/alejar, o la linterna si
 * el dispositivo la tiene); a los ~20 s se sugiere el ingreso manual. Cualquier lectura
 * válida reinicia el contador (lo hace quien llama).
 */
export function helpFor(msWithoutReading: number, { torchAvailable }: { torchAvailable: boolean }): Hint {
  if (msWithoutReading >= HELP_SECOND_MS) {
    return { level: "manual", text: "¿Te cuesta? Escribí el código abajo" };
  }
  if (msWithoutReading >= HELP_FIRST_MS) {
    return {
      level: "adjust",
      text: torchAvailable
        ? "Probá acercar o alejar el celular. Si hay poca luz, encendé la linterna"
        : "Probá acercar o alejar un poco el celular",
    };
  }
  return { level: "base", text: "Poné el código dentro del marco" };
}
