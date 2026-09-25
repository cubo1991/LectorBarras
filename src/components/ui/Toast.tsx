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
 *
 * Posición fija que NUNCA tapa contenido con el que se interactúa (un aviso encima de un
 * botón se lleva el toque: se podría deshacer sin querer):
 *  - celular: barra a todo el ancho abajo, en el lugar de la barra de navegación (el
 *    contenido ya reserva ese espacio) → tapa la navegación unos segundos, no la ficha;
 *  - escritorio (sm+): tarjeta arriba a la derecha, en el margen libre junto a la columna.
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
      className="fixed inset-x-0 bottom-0 z-20 flex items-center justify-between gap-3 border-t border-border-strong bg-surface px-3 py-2 shadow-lg sm:inset-x-auto sm:bottom-auto sm:right-4 sm:top-16 sm:w-80 sm:rounded-control sm:border"
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
