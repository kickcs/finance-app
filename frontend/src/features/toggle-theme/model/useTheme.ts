import { ref } from 'vue'

export type Theme = 'light' | 'dark' | 'system'

const STORAGE_KEY = 'theme'

// Singleton state - shared across all useTheme() calls
const theme = ref<Theme>('system')
const isDark = ref(false)
let initialized = false
let mediaQueryCleanup: (() => void) | null = null

function getSystemTheme(): boolean {
  return window.matchMedia('(prefers-color-scheme: dark)').matches
}

function applyTheme(newTheme: Theme) {
  const shouldBeDark = newTheme === 'dark' || (newTheme === 'system' && getSystemTheme())
  isDark.value = shouldBeDark

  if (shouldBeDark) {
    document.documentElement.classList.add('dark')
  } else {
    document.documentElement.classList.remove('dark')
  }

  document
    .querySelector('meta[name="theme-color"]')
    ?.setAttribute('content', shouldBeDark ? '#09090B' : '#FAFAFA')
}

export function useTheme() {
  function setTheme(newTheme: Theme) {
    theme.value = newTheme
    localStorage.setItem(STORAGE_KEY, newTheme)
    applyTheme(newTheme)
  }

  function toggleTheme() {
    const newTheme = isDark.value ? 'light' : 'dark'
    setTheme(newTheme)
  }

  function initTheme() {
    if (initialized) return

    const savedTheme = localStorage.getItem(STORAGE_KEY) as Theme | null
    theme.value = savedTheme || 'system'
    applyTheme(theme.value)

    // Listen for system theme changes
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')
    const handler = () => {
      if (theme.value === 'system') {
        applyTheme('system')
      }
    }
    mediaQuery.addEventListener('change', handler)
    mediaQueryCleanup = () => mediaQuery.removeEventListener('change', handler)

    initialized = true
  }

  function destroyTheme() {
    if (mediaQueryCleanup) {
      mediaQueryCleanup()
      mediaQueryCleanup = null
      initialized = false
    }
  }

  return {
    theme,
    isDark,
    setTheme,
    toggleTheme,
    initTheme,
    destroyTheme,
  }
}
