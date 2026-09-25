type Props = {
  /** Etiqueta FIJA ("Sonido"): el estado lo dice `aria-checked`, no el texto. */
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  className?: string;
};

/**
 * Interruptor accesible (`role="switch"`). Un botón cuyo texto cambia ("Sonido: activado")
 * no dice qué pasa al tocarlo; un interruptor con etiqueta fija sí. El estado se ve por la
 * posición de la perilla, no sólo por el color. Se opera con Espacio/Enter (es un <button>).
 */
export function Switch({ label, checked, onChange, className = "" }: Props) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={`flex min-h-11 items-center gap-3 rounded-control px-2 text-sm ${className}`}
    >
      <span>{label}</span>
      <span
        aria-hidden
        className={`relative h-6 w-11 shrink-0 rounded-full border border-border-strong transition-colors ${
          checked ? "bg-accent" : "bg-surface"
        }`}
      >
        <span
          className={`absolute top-0.5 size-4 rounded-full transition-all ${
            checked ? "left-6 bg-accent-foreground" : "left-0.5 bg-muted"
          }`}
        />
      </span>
    </button>
  );
}
