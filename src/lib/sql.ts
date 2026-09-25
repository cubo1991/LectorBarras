/** Escapa `\`, `%` y `_` para que un texto del usuario se use literal dentro de un LIKE/ILIKE. */
export function escapeLike(text: string): string {
  return text.replace(/[\\%_]/g, "\\$&");
}

/**
 * Postgres 23505 = unique_violation. Drizzle envuelve el error del driver en
 * `cause`, así que se mira en los dos niveles.
 */
export function isUniqueViolation(error: unknown): boolean {
  const code = (e: unknown) => (e as { code?: unknown } | null)?.code;
  return code(error) === "23505" || code((error as { cause?: unknown } | null)?.cause) === "23505";
}
