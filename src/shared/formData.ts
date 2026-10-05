export function getString(form: FormData, key: string): string {
  return String(form.get(key) ?? '').trim()
}

export function getNumber(form: FormData, key: string, fallback: number): number {
  const value = Number(form.get(key))
  return Number.isFinite(value) ? value : fallback
}

export function getOptionalNumber(form: FormData, key: string): number | undefined {
  const raw = form.get(key)
  if (raw === null || String(raw).trim() === '') {
    return undefined
  }

  const value = Number(raw)
  return Number.isFinite(value) ? value : undefined
}

export function getOptionalNumberFromString(raw: string): number | undefined {
  if (raw.trim() === '') {
    return undefined
  }

  const value = Number(raw)
  return Number.isFinite(value) ? value : undefined
}

export function setFormControlValue(form: HTMLFormElement, name: string, value: string): void {
  const field = form.elements.namedItem(name)

  if (
    field instanceof HTMLInputElement ||
    field instanceof HTMLSelectElement ||
    field instanceof HTMLTextAreaElement
  ) {
    field.value = value
  }
}
