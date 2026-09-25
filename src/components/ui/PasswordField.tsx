"use client";

import { useState } from "react";

type Props = Omit<React.ComponentProps<"input">, "type"> & { label: string; error?: string };

/**
 * Campo de contraseña con "Mostrar": tipear una contraseña en el celular con una mano
 * genera errores y el único feedback sería "incorrecta". Es una mejora sobre un
 * `<input type="password">` normal: sin JavaScript (antes de hidratar) el campo sigue
 * siendo un password que se envía por POST; el botón es `type="button"` y no envía el form.
 * El botón tiene etiqueta fija ("Mostrar contraseña") y su estado en `aria-pressed`.
 */
export function PasswordField({ label, error, id, className = "", ...props }: Props) {
  const [visible, setVisible] = useState(false);
  const fieldId = id ?? props.name;
  const errorId = error ? `${fieldId}-error` : undefined;

  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={fieldId} className="text-sm font-medium">
        {label}
      </label>
      <div className="relative">
        <input
          id={fieldId}
          type={visible ? "text" : "password"}
          aria-invalid={error ? true : undefined}
          aria-describedby={errorId}
          className={`min-h-11 w-full rounded-control border border-border-strong bg-background pl-3 pr-24 ${className}`}
          {...props}
        />
        <button
          type="button"
          aria-pressed={visible}
          aria-label="Mostrar contraseña"
          onClick={() => setVisible((v) => !v)}
          className={`absolute right-0 top-0 h-11 min-w-11 rounded-r-control border-l border-border-strong px-3 text-sm font-medium ${
            visible ? "bg-accent text-accent-foreground" : "bg-surface text-foreground"
          }`}
        >
          Mostrar
        </button>
      </div>
      {error && (
        <p id={errorId} role="alert" className="text-sm text-danger">
          {error}
        </p>
      )}
    </div>
  );
}
