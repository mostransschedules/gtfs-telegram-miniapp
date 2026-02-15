// =============================================================================
// CACHE UTILITY - Кэширование данных в LocalStorage
// =============================================================================
// Эта утилита позволяет сохранять данные в браузере
// Когда сервер "спит", мы показываем кэшированные данные
// =============================================================================

const CACHE_PREFIX = 'gtfs_cache_'
const CACHE_DURATION = 24 * 60 * 60 * 1000 // 24 часа в миллисекундах

/**
 * Сохранить данные в кэш
 * @param {string} key - Ключ для сохранения
 * @param {any} data - Данные для сохранения
 */
export const setCache = (key, data) => {
  try {
    const cacheItem = {
      data: data,
      timestamp: Date.now()
    }
    localStorage.setItem(CACHE_PREFIX + key, JSON.stringify(cacheItem))
  } catch (error) {
    console.error('Ошибка сохранения в кэш:', error)
  }
}

/**
 * Получить данные из кэша
 * @param {string} key - Ключ для получения
 * @returns {any|null} - Данные или null если кэш устарел/отсутствует
 */
export const getCache = (key) => {
  try {
    const cached = localStorage.getItem(CACHE_PREFIX + key)
    if (!cached) return null
    
    const cacheItem = JSON.parse(cached)
    const age = Date.now() - cacheItem.timestamp
    
    // Проверяем не устарел ли кэш
    if (age > CACHE_DURATION) {
      localStorage.removeItem(CACHE_PREFIX + key)
      return null
    }
    
    return cacheItem.data
  } catch (error) {
    console.error('Ошибка чтения из кэша:', error)
    return null
  }
}

/**
 * Очистить весь кэш
 */
export const clearCache = () => {
  try {
    const keys = Object.keys(localStorage)
    keys.forEach(key => {
      if (key.startsWith(CACHE_PREFIX)) {
        localStorage.removeItem(key)
      }
    })
  } catch (error) {
    console.error('Ошибка очистки кэша:', error)
  }
}

/**
 * Получить размер кэша в KB
 * @returns {number} - Размер кэша
 */
export const getCacheSize = () => {
  try {
    let total = 0
    const keys = Object.keys(localStorage)
    keys.forEach(key => {
      if (key.startsWith(CACHE_PREFIX)) {
        total += localStorage.getItem(key).length
      }
    })
    return (total / 1024).toFixed(2) // Возвращаем в KB
  } catch (error) {
    return 0
  }
}

/**
 * Проверить актуальность кэша
 * @param {string} key - Ключ
 * @returns {boolean} - true если кэш свежий
 */
export const isCacheFresh = (key) => {
  try {
    const cached = localStorage.getItem(CACHE_PREFIX + key)
    if (!cached) return false
    
    const cacheItem = JSON.parse(cached)
    const age = Date.now() - cacheItem.timestamp
    
    // Считаем кэш свежим если ему меньше 1 часа
    return age < (60 * 60 * 1000)
  } catch (error) {
    return false
  }
}
