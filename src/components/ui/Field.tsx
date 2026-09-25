type FieldProps = React.ComponentProps<"input"> & { label: string; error?: string };

/**
 * Label + input + error accesible. El placeholder es opcional y complementa al
 * label (nunca lo reemplaza: desaparece al escribir y no lo leen todos los lectores).
 */
export function Field({ label, error, id, className = "", ...props }: FieldProps) {
  const fieldId = id ?? props.name;
  const errorId = error ? `${fieldId}-error` : undefined;
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={fieldId} className="text-sm font-medium">
        {label}
      </label>
      <input
        id={fieldId}
        aria-invalid={error ? true : undefined}
        aria-describedby={errorId}
        className={`min-h-11 rounded-control border border-border-strong bg-background px-3 ${className}`}
        {...props}
      />
      {error && (
        <p id={errorId} role="alert" className="text-sm text-danger">
          {error}
        </p>
      )}
    </div>
  );
}
