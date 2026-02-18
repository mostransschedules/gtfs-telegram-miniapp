/**
 * Управление темами приложения
 */

const THEME_KEY = 'app-theme'

export const THEMES = {
  SYSTEM: 'system',
  BLACK: 'black',
  WHITE: 'white',
  GLASS: 'glass'
}

/**
 * Получить сохранённую тему
 */
export const getSavedTheme = () => {
  try {
    const saved = localStorage.getItem(THEME_KEY)
    return saved || THEMES.SYSTEM
  } catch (error) {
    return THEMES.SYSTEM
  }
}

/**
 * Сохранить тему
 */
export const saveTheme = (theme) => {
  try {
    localStorage.setItem(THEME_KEY, theme)
  } catch (error) {
    console.error('Failed to save theme:', error)
  }
}

/**
 * Определить системную тему
 */
export const getSystemTheme = () => {
  if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
    return 'dark'
  }
  return 'light'
}

/**
 * Применить тему к документу
 */
export const applyTheme = (theme) => {
  const root = document.documentElement
  
  // Удаляем все классы тем
  root.classList.remove('theme-black', 'theme-white', 'theme-glass')
  
  if (theme === THEMES.SYSTEM) {
    // Следуем системной теме
    const systemTheme = getSystemTheme()
    root.classList.add(systemTheme === 'dark' ? 'theme-black' : 'theme-white')
  } else {
    // Применяем выбранную тему
    root.classList.add(`theme-${theme}`)
  }
}

/**
 * Слушать изменения системной темы
 */
export const watchSystemTheme = (callback) => {
  if (window.matchMedia) {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')
    const handler = (e) => callback(e.matches ? 'dark' : 'light')
    
    // Современный API
    if (mediaQuery.addEventListener) {
      mediaQuery.addEventListener('change', handler)
      return () => mediaQuery.removeEventListener('change', handler)
    }
    // Старый API
    else if (mediaQuery.addListener) {
      mediaQuery.addListener(handler)
      return () => mediaQuery.removeListener(handler)
    }
  }
  return () => {}
}
