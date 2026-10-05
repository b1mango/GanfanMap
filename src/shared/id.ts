export function createId(prefix: string): string {
  return `${prefix}_${crypto.randomUUID()}`
}

export function nowIso(): string {
  return new Date().toISOString()
}

