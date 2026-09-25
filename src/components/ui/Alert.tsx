type AlertProps = { children: React.ReactNode; className?: string };

/** Mensaje de error. Lleva ícono además de color: el color no es la única señal. */
export function Alert({ children, className = "" }: AlertProps) {
  return (
    <div
      role="alert"
      className={`flex items-start gap-2 rounded-control border border-danger bg-surface p-3 text-sm text-danger ${className}`}
    >
      <svg aria-hidden viewBox="0 0 20 20" className="mt-0.5 size-4 shrink-0" fill="currentColor">
        <path d="M10 1.5 19 17.5H1L10 1.5Zm-1 5.5v5h2V7H9Zm0 6.5v2h2v-2H9Z" />
      </svg>
      <span>{children}</span>
    </div>
  );
}
