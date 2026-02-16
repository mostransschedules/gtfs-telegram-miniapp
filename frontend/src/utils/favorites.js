// =============================================================================
// FAVORITES - Работа с избранными маршрутами
// =============================================================================

const FAVORITES_KEY = 'gtfs_favorites'

/**
 * Получить список избранных маршрутов
 * @returns {Array} Массив объектов {routeName, stopName, direction, dayType, timestamp}
 */
export const getFavorites = () => {
  try {
    const stored = localStorage.getItem(FAVORITES_KEY)
    return stored ? JSON.parse(stored) : []
  } catch (error) {
    console.error('Error reading favorites:', error)
    return []
  }
}

/**
 * Добавить маршрут в избранное
 * @param {Object} favorite - {routeName, stopName, direction, dayType}
 */
export const addFavorite = (favorite) => {
  try {
    const favorites = getFavorites()
    
    // Проверяем что такого нет уже
    const exists = favorites.some(f => 
      f.routeName === favorite.routeName &&
      f.stopName === favorite.stopName &&
      f.direction === favorite.direction &&
      f.dayType === favorite.dayType
    )
    
    if (exists) {
      console.log('Already in favorites')
      return false
    }
    
    // Добавляем с timestamp
    favorites.unshift({
      ...favorite,
      timestamp: Date.now(),
      id: `${favorite.routeName}_${favorite.stopName}_${favorite.direction}_${favorite.dayType}`
    })
    
    localStorage.setItem(FAVORITES_KEY, JSON.stringify(favorites))
    return true
  } catch (error) {
    console.error('Error adding favorite:', error)
    return false
  }
}

/**
 * Удалить из избранного
 * @param {string} id - ID избранного
 */
export const removeFavorite = (id) => {
  try {
    const favorites = getFavorites()
    const filtered = favorites.filter(f => f.id !== id)
    localStorage.setItem(FAVORITES_KEY, JSON.stringify(filtered))
    return true
  } catch (error) {
    console.error('Error removing favorite:', error)
    return false
  }
}

/**
 * Проверить находится ли маршрут в избранном
 * @param {string} routeName 
 * @param {string} stopName 
 * @param {number} direction 
 * @param {string} dayType 
 * @returns {boolean}
 */
export const isFavorite = (routeName, stopName, direction, dayType) => {
  const favorites = getFavorites()
  return favorites.some(f => 
    f.routeName === routeName &&
    f.stopName === stopName &&
    f.direction === direction &&
    f.dayType === dayType
  )
}

/**
 * Очистить все избранные
 */
export const clearFavorites = () => {
  try {
    localStorage.removeItem(FAVORITES_KEY)
    return true
  } catch (error) {
    console.error('Error clearing favorites:', error)
    return false
  }
}
