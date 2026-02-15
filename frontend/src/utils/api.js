// =============================================================================
// API UTILITY - Запросы к Backend с кэшированием
// =============================================================================
// Все HTTP запросы к backend проходят через эти функции
// Автоматическое кэширование, retry при ошибках, показ кэшированных данных
// =============================================================================

import axios from 'axios'
import { getCache, setCache } from './cache'

// URL backend API (будет заменён на продакшене)
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000'

// Создаём axios instance с настройками
const api = axios.create({
  baseURL: API_URL,
  timeout: 60000, // 60 секунд (для холодного старта Render)
  headers: {
    'Content-Type': 'application/json'
  }
})

/**
 * Выполнить запрос с кэшированием
 * @param {string} endpoint - Путь API (например, '/api/routes')
 * @param {object} params - Параметры запроса
 * @param {boolean} useCache - Использовать кэш
 * @returns {Promise<any>} - Данные ответа
 */
export const fetchWithCache = async (endpoint, params = {}, useCache = true) => {
  // Создаём уникальный ключ для кэша
  const cacheKey = endpoint + JSON.stringify(params)
  
  // Пытаемся получить из кэша
  if (useCache) {
    const cached = getCache(cacheKey)
    if (cached) {
      console.log('📦 Используем кэш для:', endpoint)
      return { data: cached, fromCache: true }
    }
  }
  
  try {
    console.log('🌐 Запрос к API:', endpoint)
    
    // Делаем запрос
    const response = await api.get(endpoint, { params })
    
    // Сохраняем в кэш
    if (useCache && response.data) {
      setCache(cacheKey, response.data)
    }
    
    return { data: response.data, fromCache: false }
    
  } catch (error) {
    console.error('❌ Ошибка API:', error.message)
    
    // Если сервер не отвечает, пытаемся использовать старый кэш
    const cached = getCache(cacheKey)
    if (cached) {
      console.log('⚠️ Сервер недоступен, используем старый кэш')
      return { 
        data: cached, 
        fromCache: true,
        error: 'Показаны сохранённые данные. Сервер временно недоступен.'
      }
    }
    
    throw error
  }
}

// =============================================================================
// API МЕТОДЫ (для удобства)
// =============================================================================

/**
 * Получить список всех маршрутов
 */
export const getRoutes = async () => {
  const result = await fetchWithCache('/api/routes')
  return result.data.routes || []
}

/**
 * Получить остановки маршрута
 * @param {string} routeName - Номер маршрута
 * @param {number} direction - Направление (0 или 1)
 */
export const getStops = async (routeName, direction) => {
  const result = await fetchWithCache(
    `/api/route/${routeName}/stops`,
    { direction }
  )
  return result.data.stops || []
}

/**
 * Получить расписание для остановки
 * @param {string} routeName - Номер маршрута
 * @param {string} stopName - Название остановки
 * @param {number} direction - Направление
 * @param {string} dayType - "weekday" или "weekend"
 */
export const getSchedule = async (routeName, stopName, direction, dayType) => {
  const result = await fetchWithCache(
    `/api/route/${routeName}/schedule`,
    { 
      stop_name: stopName,
      direction,
      day_type: dayType
    }
  )
  return {
    schedule: result.data.schedule || [],
    fromCache: result.fromCache,
    error: result.error
  }
}

/**
 * Получить интервалы движения
 */
export const getIntervals = async (routeName, stopName, direction, dayType) => {
  const result = await fetchWithCache(
    `/api/route/${routeName}/intervals`,
    {
      stop_name: stopName,
      direction,
      day_type: dayType
    }
  )
  return result.data.intervals || null
}

/**
 * Получить время выполнения рейсов
 */
export const getDurations = async (routeName, direction, dayType) => {
  const result = await fetchWithCache(
    `/api/route/${routeName}/durations`,
    {
      direction,
      day_type: dayType
    }
  )
  return result.data.durations || null
}

/**
 * Проверить здоровье сервера
 */
export const checkHealth = async () => {
  try {
    await api.get('/health', { timeout: 5000 })
    return true
  } catch (error) {
    return false
  }
}

export default api
