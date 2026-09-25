type Tone = "danger" | "success" | "neutral";

const TONES: Record<Tone, string> = {
  danger: "border-danger text-danger",
  success: "border-success text-success",
  neutral: "border-border-strong text-muted",
};

/** Etiqueta de estado. Siempre lleva texto: el color solo no alcanza (WCAG 1.4.1). */
export function Badge({ tone = "neutral", children }: { tone?: Tone; children: React.ReactNode }) {
  return (
    <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium ${TONES[tone]}`}>
      {children}
    </span>
  );
}
