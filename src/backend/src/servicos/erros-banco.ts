/** Identifica violação de unicidade do PostgreSQL (código 23505), com ou sem wrapper do Drizzle. */
export function ehViolacaoUnicidade(err: unknown, restricao?: string): boolean {
  const causa = ((err as { cause?: unknown })?.cause ?? err) as {
    code?: string
    constraint?: string
  }
  return causa?.code === '23505' && (!restricao || causa.constraint === restricao)
}
