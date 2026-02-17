// =============================================================================
// APP.JSX - Главный компонент приложения
// =============================================================================
// Управляет всем состоянием приложения и навигацией
// =============================================================================

import { useState, useEffect } from 'react'
import { initMiniApp, initBackButton } from '@telegram-apps/sdk'
import { getRoutes, getStops, getSchedule } from './utils/api'
import { getFavorites, addFavorite, removeFavorite, isFavorite } from './utils/favorites'
import StatsTabs from './components/StatsTabs'
import './App.css'

function App() {
  // =============================================================================
  // STATE (состояние приложения)
  // =============================================================================
  
  const [tg] = useState(() => window.Telegram?.WebApp)
  const [routes, setRoutes] = useState([])
  const [filteredRoutes, setFilteredRoutes] = useState([])
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedRoute, setSelectedRoute] = useState(null)
  const [stops, setStops] = useState([])
  const [selectedStop, setSelectedStop] = useState(null)
  const [schedule, setSchedule] = useState([])
  const [direction, setDirection] = useState(0)
  const [dayType, setDayType] = useState('weekday')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [showError, setShowError] = useState(true)
  const [cacheWarning, setCacheWarning] = useState(null)
  const [favorites, setFavorites] = useState([])
  const [showingFavorites, setShowingFavorites] = useState(false)
  const [favoritesExpanded, setFavoritesExpanded] = useState(false)
  const [routeViewMode, setRouteViewMode] = useState('grid') // 'grid' или 'list'

  // =============================================================================
  // ИНИЦИАЛИЗАЦИЯ TELEGRAM
  // =============================================================================
  
  useEffect(() => {
    if (tg) {
      // Инициализация Telegram Mini App
      tg.ready()
      tg.expand() // Раскрыть на весь экран
      tg.enableClosingConfirmation() // Подтверждение при закрытии
      
      console.log('✅ Telegram WebApp инициализирован')
      console.log('Пользователь:', tg.initDataUnsafe?.user)
    }
  }, [tg])

  // =============================================================================
  // ЗАГРУЗКА ДАННЫХ
  // =============================================================================
  
  // Загрузить список маршрутов при старте
  useEffect(() => {
    loadRoutes()
  }, [])

  // Фильтрация маршрутов при изменении поиска
  useEffect(() => {
    if (searchQuery.trim() === '') {
      setFilteredRoutes(routes)
    } else {
      const query = searchQuery.toLowerCase()
      const filtered = routes.filter(route => 
        route.route_short_name.toLowerCase().includes(query)
      )
      setFilteredRoutes(filtered)
    }
  }, [searchQuery, routes])

  // Загрузить избранное при старте
  useEffect(() => {
    setFavorites(getFavorites())
  }, [])

  const loadStopsForRoute = async () => {
    if (!selectedRoute) return
    
    setLoading(true)
    try {
      const data = await getStops(selectedRoute.route_short_name, direction)
      setStops(data)
      setNextDepartures({})
      
      // Передаём routeName явно - избегаем проблемы с замыканием
      loadAllNextDepartures(data, selectedRoute.route_short_name, direction, dayType)
    } catch (err) {
      setError('Не удалось загрузить остановки')
    } finally {
      setLoading(false)
    }
  }

  // Загрузить ближайшие рейсы для всех остановок сразу
  const loadAllNextDepartures = async (stopsData, routeName, dir, dt) => {
    if (!routeName || !stopsData?.length) return

    console.log(`🚌 Загружаем ближайшие рейсы для ${stopsData.length} остановок маршрута ${routeName}...`)

    const chunkSize = 5
    for (let i = 0; i < stopsData.length; i += chunkSize) {
      const chunk = stopsData.slice(i, i + chunkSize)
      await Promise.all(chunk.map(async (stop) => {
        try {
          const result = await getSchedule(routeName, stop.stop_name, dir, dt)
          console.log(`✅ ${stop.stop_name}: ${result.schedule?.length} рейсов`)
          const next = getNextDeparture(result.schedule)
          console.log(`   → ближайший: ${next ? next.time + ' через ' + next.diffMin + ' мин' : 'нет'}`)
          setNextDepartures(prev => ({
            ...prev,
            [stop.stop_name]: next
          }))
        } catch (err) {
          console.error(`❌ Ошибка для ${stop.stop_name}:`, err)
        }
      }))
    }
    console.log('✅ Загрузка ближайших рейсов завершена')
  }

  // Загрузить расписание для остановки (с текущими direction и dayType)
  const loadScheduleForStop = async (stop, newDirection = direction, newDayType = dayType) => {
    if (!selectedRoute || !stop) return

    setLoading(true)
    setCacheWarning(null)

    try {
      const result = await getSchedule(
        selectedRoute.route_short_name,
        stop.stop_name,
        newDirection,
        newDayType
      )
      setSchedule(result.schedule)

      if (result.fromCache) {
        setCacheWarning(result.error || 'Показаны сохранённые данные')
      }
    } catch (err) {
      setError('Не удалось загрузить расписание')
    } finally {
      setLoading(false)
    }
  }

  // При смене направления - ищем ту же остановку в новом направлении
  const handleDirectionChange = async (newDirection) => {
    if (!selectedRoute) return

    setLoading(true)
    setCacheWarning(null)

    try {
      // Загружаем остановки нового направления
      const newStops = await getStops(selectedRoute.route_short_name, newDirection)
      setStops(newStops)

      if (selectedStop) {
        // Ищем ту же остановку в новом направлении
        const sameStop = newStops.find(s => s.stop_name === selectedStop.stop_name)

        if (sameStop) {
          // Остановка есть в новом направлении - загружаем расписание
          setSelectedStop(sameStop)
          const result = await getSchedule(
            selectedRoute.route_short_name,
            sameStop.stop_name,
            newDirection,
            dayType
          )
          setSchedule(result.schedule)
          if (result.fromCache) setCacheWarning(result.error || 'Показаны сохранённые данные')
        } else {
          // Остановки нет в новом направлении - возвращаемся к списку
          setSelectedStop(null)
          setSchedule([])
        }
      }
    } catch (err) {
      setError('Не удалось загрузить данные')
    } finally {
      setLoading(false)
    }
  }

  const loadRoutes = async () => {
    setLoading(true)
    setError(null)
    setShowError(true)
    try {
      const data = await getRoutes()
      setRoutes(data)
      setFilteredRoutes(data)
    } catch (err) {
      setError('Не удалось загрузить маршруты')
    } finally {
      setLoading(false)
    }
  }

  // Группировать расписание по часам
  const groupScheduleByHour = (times) => {
    const grouped = {}
    times.forEach(time => {
      const hour = parseInt(time.split(':')[0])
      if (!grouped[hour]) {
        grouped[hour] = []
      }
      grouped[hour].push(time)
    })
    return grouped
  }

  // Загрузить остановки при выборе маршрута
  const handleRouteSelect = async (route) => {
    setSelectedRoute(route)
    setSelectedStop(null)
    setSchedule([])
    setCacheWarning(null)
    setLoading(true)
    
    try {
      const data = await getStops(route.route_short_name, direction)
      setStops(data)
    } catch (err) {
      setError('Не удалось загрузить остановки')
    } finally {
      setLoading(false)
    }
  }

  // Получить название маршрута с учётом направления
  const getRouteDisplayName = (route) => {
    if (!route || !route.route_long_name) return ''
    
    const name = route.route_long_name
    
    // Если есть разделитель " - " и выбрано обратное направление
    if (name.includes(' - ') && direction === 1) {
      const parts = name.split(' - ')
      // Разворачиваем: "A - B" → "B - A"
      return parts.reverse().join(' - ')
    }
    
    return name
  }

  // Загрузить расписание при выборе остановки
  const handleStopSelect = async (stop) => {
    setSelectedStop(stop)
    setLoading(true)
    setCacheWarning(null)
    
    try {
      const result = await getSchedule(
        selectedRoute.route_short_name,
        stop.stop_name,
        direction,
        dayType
      )
      
      setSchedule(result.schedule)
      
      if (result.fromCache) {
        setCacheWarning(result.error || 'Показаны сохранённые данные')
      }
    } catch (err) {
      setError('Не удалось загрузить расписание')
    } finally {
      setLoading(false)
    }
  }

  // =============================================================================
  // ИЗБРАННОЕ
  // =============================================================================

  // Вычислить ближайший рейс из расписания относительно текущего времени
  const getNextDeparture = (scheduleData) => {
    if (!scheduleData || scheduleData.length === 0) return null

    const now = new Date()
    const currentMinutes = now.getHours() * 60 + now.getMinutes()

    // Нормализуем текущее время для транспортных суток
    const normalizedNow = currentMinutes < 4 * 60
      ? currentMinutes + 24 * 60
      : currentMinutes

    // schedule - плоский массив строк ["06:12", "06:22", ...]
    const allTimes = scheduleData.map(time => {
      const [h, m] = time.substring(0, 5).split(':').map(Number)
      const totalMin = h < 4 ? (h + 24) * 60 + m : h * 60 + m
      return { time: time.substring(0, 5), totalMin }
    })

    // Сортируем по времени
    allTimes.sort((a, b) => a.totalMin - b.totalMin)

    // Ищем первый рейс после текущего времени
    const next = allTimes.find(t => t.totalMin > normalizedNow)

    if (!next) return null

    const diffMin = next.totalMin - normalizedNow
    return { time: next.time, diffMin }
  }

  // Кэш ближайших рейсов для остановок {stopName: {time, diffMin}}
  const [nextDepartures, setNextDepartures] = useState({})

  const loadNextDeparture = async (stop) => {
    // Уже загружали - пропускаем
    if (nextDepartures[stop.stop_name] !== undefined) return

    try {
      const result = await getSchedule(
        selectedRoute.route_short_name,
        stop.stop_name,
        direction,
        dayType
      )
      const next = getNextDeparture(result.schedule)
      setNextDepartures(prev => ({
        ...prev,
        [stop.stop_name]: next
      }))
    } catch (err) {
      setNextDepartures(prev => ({
        ...prev,
        [stop.stop_name]: null
      }))
    }
  }

  const handleToggleFavorite = () => {
    if (!selectedRoute || !selectedStop) return

    const favoriteData = {
      routeName: selectedRoute.route_short_name,
      routeLongName: selectedRoute.route_long_name,
      stopName: selectedStop.stop_name,
      direction: direction,
      dayType: dayType,
      type: 'stop' // тип избранного: 'stop' или 'route'
    }

    const isCurrentlyFavorite = isFavorite(
      selectedRoute.route_short_name,
      selectedStop.stop_name,
      direction,
      dayType
    )

    if (isCurrentlyFavorite) {
      const id = `${favoriteData.routeName}_${favoriteData.stopName}_${favoriteData.direction}_${favoriteData.dayType}`
      removeFavorite(id)
    } else {
      addFavorite(favoriteData)
    }

    // Обновляем список избранного
    setFavorites(getFavorites())
  }

  const handleToggleFavoriteRoute = (route, event) => {
    event.stopPropagation()

    const favoriteData = {
      routeName: route.route_short_name,
      routeLongName: route.route_long_name,
      type: 'route' // маршрут без остановки
    }

    // Проверяем есть ли этот маршрут в избранном
    const existingFavorites = getFavorites()
    const exists = existingFavorites.some(f => 
      f.type === 'route' && f.routeName === route.route_short_name
    )

    if (exists) {
      const favToRemove = existingFavorites.find(f => 
        f.type === 'route' && f.routeName === route.route_short_name
      )
      if (favToRemove) {
        removeFavorite(favToRemove.id)
      }
    } else {
      addFavorite(favoriteData)
    }

    setFavorites(getFavorites())
  }

  const isFavoriteRoute = (routeName) => {
    return favorites.some(f => f.type === 'route' && f.routeName === routeName)
  }

  const handleLoadFavorite = async (fav) => {
    // Находим маршрут
    const route = routes.find(r => r.route_short_name === fav.routeName)
    if (!route) {
      setError('Маршрут не найден')
      return
    }

    setSelectedRoute(route)
    setDirection(fav.direction)
    setDayType(fav.dayType)

    // Загружаем остановки
    setLoading(true)
    try {
      const stopsData = await getStops(route.route_short_name, fav.direction)
      setStops(stopsData)

      // Находим остановку
      const stop = stopsData.find(s => s.stop_name === fav.stopName)
      if (stop) {
        setSelectedStop(stop)

        // Загружаем расписание
        const result = await getSchedule(
          route.route_short_name,
          stop.stop_name,
          fav.direction,
          fav.dayType
        )
        setSchedule(result.schedule)
      }
    } catch (err) {
      setError('Не удалось загрузить избранный маршрут')
    } finally {
      setLoading(false)
    }
  }

  // =============================================================================
  // RENDER
  // =============================================================================

  return (
    <div className="app">
      <div className="container">
        
        {/* Заголовок */}
        <header className="header">
          <h1>🚌 Расписание транспорта</h1>
          <p className="subtitle">Москва</p>
        </header>

        {/* Предупреждение о кэше */}
        {cacheWarning && (
          <div className="warning">
            ⚠️ {cacheWarning}
          </div>
        )}

        {/* Ошибка */}
        {error && showError && (
          <div className="error">
            <div className="error-content">
              <span>❌ {error}</span>
              <button 
                className="error-close"
                onClick={() => setShowError(false)}
                aria-label="Закрыть"
              >
                ✕
              </button>
            </div>
          </div>
        )}

        {/* Выбор типа дня */}
        <div className="day-type-selector mb-3">
          <button
            className={dayType === 'weekday' ? 'active' : ''}
            onClick={() => {
              setDayType('weekday')
              if (selectedRoute && selectedStop) {
                loadScheduleForStop(selectedStop, direction, 'weekday')
              } else if (selectedRoute && stops.length > 0) {
                setNextDepartures({})
                loadAllNextDepartures(stops, selectedRoute.route_short_name, direction, 'weekday')
              }
            }}
          >
            Будни
          </button>
          <button
            className={dayType === 'weekend' ? 'active' : ''}
            onClick={() => {
              setDayType('weekend')
              if (selectedRoute && selectedStop) {
                loadScheduleForStop(selectedStop, direction, 'weekend')
              } else if (selectedRoute && stops.length > 0) {
                setNextDepartures({})
                loadAllNextDepartures(stops)
              }
            }}
          >
            Выходные
          </button>
        </div>

        {/* Выбор направления */}
        <div className="direction-selector mb-3">
          <button
            className={direction === 0 ? 'active' : ''}
            onClick={() => {
              setDirection(0)
              handleDirectionChange(0)
            }}
          >
            ➡️ Прямое
          </button>
          <button
            className={direction === 1 ? 'active' : ''}
            onClick={() => {
              setDirection(1)
              handleDirectionChange(1)
            }}
          >
            ⬅️ Обратное
          </button>
        </div>

        {/* Список маршрутов */}
        {!selectedRoute && (
          <div className="routes-list">
            <h2>Выберите маршрут</h2>
            
            {/* Избранное */}
            {favorites.length > 0 && (
              <div className="favorites-section">
                <div className="favorites-header" onClick={() => setFavoritesExpanded(!favoritesExpanded)}>
                  <h3>⭐ Избранное ({favorites.length})</h3>
                  <button className="expand-toggle">
                    {favoritesExpanded ? '▼' : '▶'}
                  </button>
                </div>
                
                {favoritesExpanded && (
                  <div className="favorites-content">
                    {/* Избранные маршруты */}
                    {favorites.filter(f => f.type === 'route').length > 0 && (
                      <div className="favorites-group">
                        <h4>🚌 Маршруты</h4>
                        <div className="favorites-list">
                          {favorites.filter(f => f.type === 'route').map(fav => (
                            <div
                              key={fav.id}
                              className="favorite-card"
                              onClick={() => {
                                const route = routes.find(r => r.route_short_name === fav.routeName)
                                if (route) handleRouteSelect(route)
                              }}
                            >
                              <div className="favorite-header">
                                <span className="favorite-route">{fav.routeName}</span>
                                <button
                                  className="favorite-remove"
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    removeFavorite(fav.id)
                                    setFavorites(getFavorites())
                                  }}
                                >
                                  ✕
                                </button>
                              </div>
                              <div className="favorite-details">
                                <div className="favorite-stop">{fav.routeLongName}</div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Избранные остановки */}
                    {favorites.filter(f => f.type === 'stop').length > 0 && (
                      <div className="favorites-group">
                        <h4>📍 Остановки</h4>
                        <div className="favorites-list">
                          {favorites.filter(f => f.type === 'stop').map(fav => (
                            <div
                              key={fav.id}
                              className="favorite-card"
                              onClick={() => handleLoadFavorite(fav)}
                            >
                              <div className="favorite-header">
                                <span className="favorite-route">{fav.routeName}</span>
                                <button
                                  className="favorite-remove"
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    removeFavorite(fav.id)
                                    setFavorites(getFavorites())
                                  }}
                                >
                                  ✕
                                </button>
                              </div>
                              <div className="favorite-details">
                                <div className="favorite-stop">📍 {fav.stopName}</div>
                                <div className="favorite-meta">
                                  {fav.direction === 0 ? '→ Прямое' : '← Обратное'} · {fav.dayType === 'weekday' ? 'Будни' : 'Выходные'}
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
            
            {/* Поле поиска */}
            <div className="search-box mb-3">
              <input
                type="text"
                placeholder="🔍 Поиск по номеру маршрута..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="search-input"
              />
              {searchQuery && (
                <button 
                  className="clear-search"
                  onClick={() => setSearchQuery('')}
                >
                  ✕
                </button>
              )}
            </div>

            {loading ? (
              <div className="text-center mt-3">
                <div className="spinner"></div>
                <p className="mt-2">Загрузка...</p>
              </div>
            ) : filteredRoutes.length > 0 ? (
              <>
                {/* Переключатель вида */}
                <div className="view-toggle">
                  <button
                    className={`view-toggle-btn ${routeViewMode === 'grid' ? 'active' : ''}`}
                    onClick={() => setRouteViewMode('grid')}
                    title="Сетка"
                  >
                    ⊞
                  </button>
                  <button
                    className={`view-toggle-btn ${routeViewMode === 'list' ? 'active' : ''}`}
                    onClick={() => setRouteViewMode('list')}
                    title="Список"
                  >
                    ☰
                  </button>
                </div>

                <div className={routeViewMode === 'grid' ? 'route-grid' : 'route-list'}>
                  {filteredRoutes.map(route => (
                    <div
                      key={route.route_id}
                      className={routeViewMode === 'grid' ? 'route-card' : 'route-card-list'}
                      onClick={() => handleRouteSelect(route)}
                    >
                      {routeViewMode === 'grid' ? (
                        <>
                          <div className="route-number">{route.route_short_name}</div>
                          <div className="route-name">{getRouteDisplayName(route)}</div>
                        </>
                      ) : (
                        <>
                          <div className="route-list-content">
                            <span className="route-number-list">{route.route_short_name}</span>
                            <span className="route-name-list">{getRouteDisplayName(route)}</span>
                          </div>
                          <button
                            className={`route-favorite-btn ${isFavoriteRoute(route.route_short_name) ? 'active' : ''}`}
                            onClick={(e) => handleToggleFavoriteRoute(route, e)}
                            title={isFavoriteRoute(route.route_short_name) ? 'Удалить из избранного' : 'Добавить в избранное'}
                          >
                            {isFavoriteRoute(route.route_short_name) ? '⭐' : '☆'}
                          </button>
                        </>
                      )}
                    </div>
                  ))}
                </div>
                {searchQuery && (
                  <p className="search-results-text mt-2">
                    Найдено: {filteredRoutes.length} из {routes.length}
                  </p>
                )}
              </>
            ) : searchQuery ? (
              <div className="info mt-3">
                ℹ️ Ничего не найдено по запросу "{searchQuery}"
              </div>
            ) : (
              <div className="info mt-3">
                ℹ️ Нет доступных маршрутов
              </div>
            )}
          </div>
        )}

        {/* Список остановок */}
        {selectedRoute && !selectedStop && (
          <div className="stops-list">
            <button className="back-button mb-2" onClick={() => setSelectedRoute(null)}>
              ← Назад к маршрутам
            </button>
            
            <h2>Маршрут {selectedRoute.route_short_name}</h2>
            <p className="mb-3">{getRouteDisplayName(selectedRoute)}</p>
            {Object.keys(nextDepartures).length > 0 && Object.keys(nextDepartures).length < stops.length && (
              <p className="next-departures-loading">
                🕐 Загружаем время рейсов... {Object.keys(nextDepartures).length}/{stops.length}
              </p>
            )}
            
            {loading ? (
              <div className="text-center mt-3">
                <div className="spinner"></div>
                <p className="mt-2">Загружаем остановки...</p>
              </div>
            ) : (
              stops.map((stop, index) => {
                const next = nextDepartures[stop.stop_name]
                const isStopFav = isFavorite(
                  selectedRoute.route_short_name,
                  stop.stop_name,
                  direction,
                  dayType
                )

                return (
                  <div
                    key={index}
                    className="stop-card"
                    onClick={() => handleStopSelect(stop)}
                  >
                    <div className="stop-number">{index + 1}</div>
                    <div className="stop-info">
                      <div className="stop-name">{stop.stop_name}</div>
                      {next && (
                        <div className="stop-next-departure">
                          🕐 {next.time}
                          {next.diffMin <= 60
                            ? ` · через ${next.diffMin} мин`
                            : ''}
                        </div>
                      )}
                    </div>
                    <button
                      className={`stop-favorite-btn ${isStopFav ? 'active' : ''}`}
                      onClick={(e) => {
                        e.stopPropagation()
                        const favoriteData = {
                          routeName: selectedRoute.route_short_name,
                          routeLongName: selectedRoute.route_long_name,
                          stopName: stop.stop_name,
                          direction: direction,
                          dayType: dayType,
                          type: 'stop'
                        }
                        if (isStopFav) {
                          removeFavorite(`${selectedRoute.route_short_name}_${stop.stop_name}_${direction}_${dayType}`)
                        } else {
                          addFavorite(favoriteData)
                          // Подгружаем ближайший рейс сразу
                          loadNextDeparture(stop)
                        }
                        setFavorites(getFavorites())
                      }}
                    >
                      {isStopFav ? '⭐' : '☆'}
                    </button>
                  </div>
                )
              })
            )}
          </div>
        )}

        {/* Расписание */}
        {selectedStop && (
          <div className="schedule">
            <button className="back-button mb-2" onClick={() => setSelectedStop(null)}>
              ← Назад к остановкам
            </button>
            
            <div className="schedule-header">
              <div>
                <h2>📍 {selectedStop.stop_name}</h2>
                <p className="mb-3">
                  Маршрут {selectedRoute.route_short_name} · 
                  {dayType === 'weekday' ? ' Будни' : ' Выходные'}
                </p>
              </div>
              <button
                className={`favorite-button ${isFavorite(selectedRoute.route_short_name, selectedStop.stop_name, direction, dayType) ? 'active' : ''}`}
                onClick={handleToggleFavorite}
                title={isFavorite(selectedRoute.route_short_name, selectedStop.stop_name, direction, dayType) ? 'Удалить из избранного' : 'Добавить в избранное'}
              >
                {isFavorite(selectedRoute.route_short_name, selectedStop.stop_name, direction, dayType) ? '⭐' : '☆'}
              </button>
            </div>
            
            {loading ? (
              <div className="text-center mt-3">
                <div className="spinner"></div>
                <p className="mt-2">Загружаем расписание...</p>
              </div>
            ) : schedule.length > 0 ? (
              <>
                <div className="schedule-by-hour">
                  {(() => {
                    // Группируем по часам
                    const byHour = {}
                    schedule.forEach(time => {
                      const hour = time.split(':')[0]
                      if (!byHour[hour]) byHour[hour] = []
                      byHour[hour].push(time.substring(0, 5))
                    })
                    
                    // Сортируем часы начиная с 4:00 (начало транспортных суток)
                    const sortedHours = Object.keys(byHour).sort((a, b) => {
                      const ha = parseInt(a)
                      const hb = parseInt(b)
                      const ka = ha < 4 ? ha + 24 : ha
                      const kb = hb < 4 ? hb + 24 : hb
                      return ka - kb
                    })
                    
                    return sortedHours.map(hour => (
                      <div key={hour} className="hour-group">
                        <div className="hour-header">{hour}:00</div>
                        <div className="hour-times">
                          {byHour[hour].map((time, idx) => (
                            <div key={idx} className="time-chip-small">
                              {time}
                            </div>
                          ))}
                        </div>
                      </div>
                    ))
                  })()}
                </div>

                {/* Статистика и графики */}
                <StatsTabs
                  route={selectedRoute}
                  stop={selectedStop}
                  direction={direction}
                  dayType={dayType}
                  schedule={schedule}
                  stops={stops}
                  onStopClick={handleStopSelect}
                />
              </>
            ) : (
              <div className="info">
                ℹ️ Нет расписания для выбранных параметров
              </div>
            )}
          </div>
        )}

      </div>
    </div>
  )
}

export default App
