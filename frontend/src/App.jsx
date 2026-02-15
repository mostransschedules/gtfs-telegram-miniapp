// =============================================================================
// APP.JSX - Главный компонент приложения
// =============================================================================
// Управляет всем состоянием приложения и навигацией
// =============================================================================

import { useState, useEffect } from 'react'
import { initMiniApp, initBackButton } from '@telegram-apps/sdk'
import { getRoutes, getStops, getSchedule } from './utils/api'
import './App.css'

function App() {
  // =============================================================================
  // STATE (состояние приложения)
  // =============================================================================
  
  const [tg] = useState(() => window.Telegram?.WebApp)
  const [routes, setRoutes] = useState([])
  const [selectedRoute, setSelectedRoute] = useState(null)
  const [stops, setStops] = useState([])
  const [selectedStop, setSelectedStop] = useState(null)
  const [schedule, setSchedule] = useState([])
  const [direction, setDirection] = useState(0)
  const [dayType, setDayType] = useState('weekday')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [cacheWarning, setCacheWarning] = useState(null)

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

  const loadRoutes = async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await getRoutes()
      setRoutes(data)
    } catch (err) {
      setError('Не удалось загрузить маршруты')
    } finally {
      setLoading(false)
    }
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
        {error && (
          <div className="error">
            ❌ {error}
          </div>
        )}

        {/* Выбор типа дня */}
        <div className="day-type-selector mb-3">
          <button
            className={dayType === 'weekday' ? 'active' : ''}
            onClick={() => setDayType('weekday')}
          >
            Будни
          </button>
          <button
            className={dayType === 'weekend' ? 'active' : ''}
            onClick={() => setDayType('weekend')}
          >
            Выходные
          </button>
        </div>

        {/* Выбор направления */}
        <div className="direction-selector mb-3">
          <button
            className={direction === 0 ? 'active' : ''}
            onClick={() => setDirection(0)}
          >
            ➡️ Прямое
          </button>
          <button
            className={direction === 1 ? 'active' : ''}
            onClick={() => setDirection(1)}
          >
            ⬅️ Обратное
          </button>
        </div>

        {/* Список маршрутов */}
        {!selectedRoute && (
          <div className="routes-list">
            <h2>Выберите маршрут</h2>
            {loading ? (
              <div className="text-center mt-3">
                <div className="spinner"></div>
                <p className="mt-2">Загрузка...</p>
              </div>
            ) : (
              <div className="route-grid">
                {routes.map(route => (
                  <div
                    key={route.route_id}
                    className="route-card"
                    onClick={() => handleRouteSelect(route)}
                  >
                    <div className="route-number">{route.route_short_name}</div>
                    <div className="route-name">{route.route_long_name}</div>
                  </div>
                ))}
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
            <p className="mb-3">{selectedRoute.route_long_name}</p>
            
            {loading ? (
              <div className="text-center mt-3">
                <div className="spinner"></div>
                <p className="mt-2">Загружаем остановки...</p>
              </div>
            ) : (
              stops.map((stop, index) => (
                <div
                  key={index}
                  className="stop-card"
                  onClick={() => handleStopSelect(stop)}
                >
                  <div className="stop-number">{index + 1}</div>
                  <div className="stop-name">{stop.stop_name}</div>
                </div>
              ))
            )}
          </div>
        )}

        {/* Расписание */}
        {selectedStop && (
          <div className="schedule">
            <button className="back-button mb-2" onClick={() => setSelectedStop(null)}>
              ← Назад к остановкам
            </button>
            
            <h2>📍 {selectedStop.stop_name}</h2>
            <p className="mb-3">
              Маршрут {selectedRoute.route_short_name} · 
              {dayType === 'weekday' ? ' Будни' : ' Выходные'}
            </p>
            
            {loading ? (
              <div className="text-center mt-3">
                <div className="spinner"></div>
                <p className="mt-2">Загружаем расписание...</p>
              </div>
            ) : schedule.length > 0 ? (
              <div className="schedule-times">
                {schedule.map((time, index) => (
                  <div key={index} className="time-chip">
                    {time}
                  </div>
                ))}
              </div>
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
