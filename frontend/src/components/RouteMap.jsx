// =============================================================================
// ROUTE MAP - Карта маршрута с остановками
// =============================================================================

import { useEffect } from 'react'
import { MapContainer, TileLayer, Marker, Polyline, Popup } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import './RouteMap.css'

// Исправление иконок Leaflet (известная проблема с Webpack/Vite)
delete L.Icon.Default.prototype._getIconUrl
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
})

// Кастомные иконки
const createIcon = (emoji, className = '') => {
  return L.divIcon({
    html: `<div class="custom-marker ${className}">${emoji}</div>`,
    className: 'custom-marker-wrapper',
    iconSize: [30, 30],
    iconAnchor: [15, 30],
    popupAnchor: [0, -30]
  })
}

const startIcon = createIcon('🟢', 'start')
const endIcon = createIcon('🔴', 'end')
const stopIcon = createIcon('🚏', 'stop')
const selectedIcon = createIcon('📍', 'selected')

function RouteMap({ stops, selectedStop, onStopClick }) {
  const [roadRoute, setRoadRoute] = useState([])
  const [loadingRoute, setLoadingRoute] = useState(false)
  
  // Если нет остановок, не показываем карту
  if (!stops || stops.length === 0) {
    return (
      <div className="map-placeholder">
        <p>📍 Выберите маршрут чтобы увидеть карту</p>
      </div>
    )
  }

  // Фильтруем остановки с валидными координатами
  const validStops = stops.filter(s => 
    s.stop_lat && 
    s.stop_lon && 
    !isNaN(s.stop_lat) && 
    !isNaN(s.stop_lon) &&
    s.stop_lat >= -90 && s.stop_lat <= 90 &&
    s.stop_lon >= -180 && s.stop_lon <= 180
  )

  console.log('Total stops:', stops.length)
  console.log('Valid stops:', validStops.length)
  console.log('First valid stop:', validStops[0])

  if (validStops.length === 0) {
    return (
      <div className="map-placeholder">
        <p>❌ У остановок этого маршрута нет координат</p>
      </div>
    )
  }

  // Центр карты - первая остановка (начало маршрута)
  const center = [validStops[0].stop_lat, validStops[0].stop_lon]

  // Путь маршрута (линия между остановками)
  const routePath = validStops.map(s => [s.stop_lat, s.stop_lon])

  // Вычисляем bounds для показа всех остановок
  const bounds = validStops.length > 1 ? [
    [Math.min(...validStops.map(s => s.stop_lat)), Math.min(...validStops.map(s => s.stop_lon))],
    [Math.max(...validStops.map(s => s.stop_lat)), Math.max(...validStops.map(s => s.stop_lon))]
  ] : null

  // Загружаем маршрут по дорогам через OSRM API
  useEffect(() => {
    if (validStops.length < 2) return
    
    setLoadingRoute(true)
    
    // Ограничиваем до 100 остановок (лимит OSRM)
    const stopsForRoute = validStops.length > 100 ? validStops.filter((_, i) => i % 2 === 0) : validStops
    
    // Формируем координаты для OSRM (lon,lat формат)
    const coords = stopsForRoute
      .map(s => `${s.stop_lon},${s.stop_lat}`)
      .join(';')
    
    // Запрос к OSRM API
    fetch(`https://router.project-osrm.org/route/v1/driving/${coords}?geometries=geojson&overview=full`)
      .then(res => res.json())
      .then(data => {
        if (data.routes && data.routes.length > 0) {
          // Конвертируем координаты из [lon, lat] в [lat, lon] для Leaflet
          const route = data.routes[0].geometry.coordinates.map(c => [c[1], c[0]])
          setRoadRoute(route)
          console.log(`✅ Маршрут по дорогам загружен: ${route.length} точек`)
        } else {
          console.warn('⚠️ OSRM не вернул маршрут, используем прямые линии')
          setRoadRoute([])
        }
      })
      .catch(err => {
        console.error('❌ Ошибка загрузки маршрута:', err)
        console.log('Используем прямые линии между остановками')
        setRoadRoute([])
      })
      .finally(() => {
        setLoadingRoute(false)
      })
  }, [validStops])

  // Определяем иконку для остановки
  const getStopIcon = (stop, index) => {
    // Если остановка выбрана
    if (selectedStop && selectedStop.stop_id === stop.stop_id) {
      return selectedIcon
    }
    // Первая остановка
    if (index === 0) {
      return startIcon
    }
    // Последняя остановка
    if (index === validStops.length - 1) {
      return endIcon
    }
    // Обычная остановка
    return stopIcon
  }

  return (
    <div className="route-map-container">
      {/* Информация о маршруте */}
      <div className="map-info">
        <span>📍 {validStops.length} остановок</span>
        {loadingRoute ? (
          <span>🔄 Загружаем маршрут по дорогам...</span>
        ) : roadRoute.length > 0 ? (
          <span>✅ Маршрут построен по дорогам</span>
        ) : (
          <span>💡 Нажмите на остановку для просмотра расписания</span>
        )}
      </div>

      {/* Карта */}
      <MapContainer 
        center={center} 
        zoom={13}
        bounds={bounds}
        className="route-map"
        scrollWheelZoom={false}
        touchZoom={true}
      >
        {/* Тайлы OpenStreetMap */}
        <TileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        />
        
        {/* Линия маршрута */}
        {roadRoute.length > 0 ? (
          // Маршрут по дорогам от OSRM
          <Polyline 
            positions={roadRoute}
            color="#2196F3"
            weight={4}
            opacity={0.8}
          />
        ) : routePath.length > 1 ? (
          // Прямые линии между остановками (fallback)
          <Polyline 
            positions={routePath}
            color="#2196F3"
            weight={4}
            opacity={0.5}
            dashArray="10, 10"
          />
        ) : null}
        
        {/* Маркеры остановок */}
        {validStops.map((stop, index) => {
          return (
            <Marker
              key={stop.stop_id}
              position={[stop.stop_lat, stop.stop_lon]}
              icon={getStopIcon(stop, index)}
              eventHandlers={{
                click: () => {
                  if (onStopClick) {
                    onStopClick(stop)
                  }
                }
              }}
            >
              <Popup>
                <div className="stop-popup">
                  <strong>{stop.stop_name}</strong>
                  <div className="stop-meta">
                    Остановка {index + 1} из {validStops.length}
                  </div>
                  <div className="stop-coords">
                    {stop.stop_lat.toFixed(6)}, {stop.stop_lon.toFixed(6)}
                  </div>
                  {selectedStop && selectedStop.stop_id === stop.stop_id && (
                    <div className="selected-badge">✓ Выбрана</div>
                  )}
                </div>
              </Popup>
            </Marker>
          )
        })}
      </MapContainer>

      {/* Легенда */}
      <div className="map-legend">
        <div className="legend-item">
          <span className="legend-icon">🟢</span>
          <span>Начало маршрута</span>
        </div>
        <div className="legend-item">
          <span className="legend-icon">🚏</span>
          <span>Остановка</span>
        </div>
        <div className="legend-item">
          <span className="legend-icon">🔴</span>
          <span>Конец маршрута</span>
        </div>
        <div className="legend-item">
          <span className="legend-icon">📍</span>
          <span>Выбранная остановка</span>
        </div>
      </div>
    </div>
  )
}

export default RouteMap
