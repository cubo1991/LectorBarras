type Variant = "primary" | "secondary";

const VARIANTS: Record<Variant, string> = {
  primary: "bg-accent text-accent-foreground",
  secondary: "border border-border-strong bg-surface text-foreground",
};

type ButtonProps = React.ComponentProps<"button"> & { variant?: Variant };

// min-h-11 = 44 px, el mínimo táctil (WCAG 2.5.5).
export function Button({ variant = "primary", className = "", type = "button", ...props }: ButtonProps) {
  return (
    <button
      type={type}
      className={`min-h-11 rounded-control px-4 py-2 font-medium disabled:opacity-60 ${VARIANTS[variant]} ${className}`}
      {...props}
    />
  );
}
