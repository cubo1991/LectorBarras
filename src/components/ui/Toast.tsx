"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/Button";

type Props = {
  message: string;
  /** Acción opcional (por ejemplo "Deshacer"). */
  actionLabel?: string;
  onAction?: () => void;
  onDismiss: () => void;
  durationMs: number;
};

/**
 * Aviso temporal con una acción. Se anuncia a los lectores de pantalla (`role="status"`),
 * se puede alcanzar con teclado y **no desaparece mientras tiene el foco o el puntero
 * encima**: alguien que está por tocar "Deshacer" no puede perder el botón bajo el dedo.
 * Es un componente de posición fija: se coloca sobre la barra de navegación del celular.
 */
export function Toast({ message, actionLabel, onAction, onDismiss, durationMs }: Props) {
  const [paused, setPaused] = useState(false);

  // Se reinicia con cada mensaje nuevo o al salir de la pausa.
  useEffect(() => {
    if (paused) return;
    const timer = setTimeout(onDismiss, durationMs);
    return () => clearTimeout(timer);
  }, [paused, message, durationMs, onDismiss]);

  return (
    <div
      role="status"
      onFocus={() => setPaused(true)}
      onBlur={() => setPaused(false)}
      onPointerEnter={() => setPaused(true)}
      onPointerLeave={() => setPaused(false)}
      className="fixed inset-x-4 bottom-16 z-20 mx-auto flex max-w-md items-center justify-between gap-3 rounded-control border border-border-strong bg-surface p-3 shadow-lg sm:bottom-4"
    >
      <span className="text-sm">{message}</span>
      {actionLabel && onAction && (
        <Button variant="secondary" onClick={onAction} className="shrink-0 text-sm">
          {actionLabel}
        </Button>
      )}
    </div>
  );
}
