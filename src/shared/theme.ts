import { useSyncExternalStore } from 'react'
import { prefersReducedMotion } from './motion'

export type ThemeMode = 'light' | 'plain' | 'dark'

export const THEME_MODES: ThemeMode[] = ['light', 'plain', 'dark']

export const THEME_LABELS: Record<ThemeMode, string> = {
  light: '暖纸',
  plain: '素白',
  dark: '夜食',
}

const STORAGE_KEY = 'fan-map-theme'

function systemPrefersDark(): boolean {
  return (
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-color-scheme: dark)').matches
  )
}

export function getInitialTheme(): ThemeMode {
  if (typeof window === 'undefined') {
    return 'light'
  }

  try {
    const stored = window.localStorage.getItem(STORAGE_KEY)
    if (stored === 'light' || stored === 'plain' || stored === 'dark') {
      return stored
    }
  } catch {
    // localStorage unavailable; fall back to system preference
  }

  return systemPrefersDark() ? 'dark' : 'light'
}

let currentTheme: ThemeMode = getInitialTheme()
const listeners = new Set<() => void>()

let themeTransitionTimer: number | undefined

function applyTheme(theme: ThemeMode): void {
  if (typeof document !== 'undefined') {
    document.documentElement.dataset.theme = theme
  }
}

// Cross-fade surface colors on theme change. The class lives briefly on
// <html> so the transition never slows down ordinary interactions.
function runThemeTransition(): void {
  if (typeof document === 'undefined' || prefersReducedMotion()) {
    return
  }

  const root = document.documentElement
  root.classList.add('theme-xfade')
  window.clearTimeout(themeTransitionTimer)
  themeTransitionTimer = window.setTimeout(() => root.classList.remove('theme-xfade'), 260)
}

export function setTheme(theme: ThemeMode): void {
  const changed = theme !== currentTheme
  currentTheme = theme

  try {
    window.localStorage.setItem(STORAGE_KEY, theme)
  } catch {
    // ignore persistence failures (private mode, etc.)
  }

  if (changed) {
    runThemeTransition()
  }
  applyTheme(theme)
  for (const listener of listeners) {
    listener()
  }
}

export function toggleTheme(): void {
  const nextIndex = (THEME_MODES.indexOf(currentTheme) + 1) % THEME_MODES.length
  setTheme(THEME_MODES[nextIndex] ?? 'light')
}

function subscribe(callback: () => void): () => void {
  listeners.add(callback)
  return () => {
    listeners.delete(callback)
  }
}

export function useTheme(): ThemeMode {
  return useSyncExternalStore(
    subscribe,
    () => currentTheme,
    () => currentTheme,
  )
}

// Keep the DOM in sync on module load in case the inline boot script was skipped.
applyTheme(currentTheme)
