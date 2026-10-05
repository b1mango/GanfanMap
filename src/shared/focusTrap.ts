const panelFocusableSelector = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(',')

/** Keep Tab cycling inside a floating panel until it closes. */
export function trapPanelFocus(event: React.KeyboardEvent, panel: HTMLElement | null): void {
  if (event.key !== 'Tab' || !panel) {
    return
  }

  const focusable = Array.from(panel.querySelectorAll<HTMLElement>(panelFocusableSelector))
  const first = focusable[0]
  const last = focusable[focusable.length - 1]
  if (!first || !last) {
    event.preventDefault()
    return
  }

  if (event.shiftKey && document.activeElement === first) {
    event.preventDefault()
    last.focus()
  } else if (!event.shiftKey && document.activeElement === last) {
    event.preventDefault()
    first.focus()
  }
}
