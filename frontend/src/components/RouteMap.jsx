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
  
  // Если нет остановок, не показываем карту
  if (!stops || stops.length === 0) {
    return (
      <div className="map-placeholder">
        <p>📍 Выберите маршрут чтобы увидеть карту</p>
      </div>
    )
  }

  // Вычисляем центр карты (средняя точка всех остановок)
  const center = [
    stops.reduce((sum, s) => sum + (s.stop_lat || 0), 0) / stops.length,
    stops.reduce((sum, s) => sum + (s.stop_lon || 0), 0) / stops.length
  ]

  // Путь маршрута (линия между остановками)
  const routePath = stops
    .filter(s => s.stop_lat && s.stop_lon)
    .map(s => [s.stop_lat, s.stop_lon])

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
    if (index === stops.length - 1) {
      return endIcon
    }
    // Обычная остановка
    return stopIcon
  }

  return (
    <div className="route-map-container">
      {/* Информация о маршруте */}
      <div className="map-info">
        <span>📍 {stops.length} остановок</span>
        <span>💡 Нажмите на остановку для просмотра расписания</span>
      </div>

      {/* Карта */}
      <MapContainer 
        center={center} 
        zoom={13}
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
        {routePath.length > 1 && (
          <Polyline 
            positions={routePath}
            color="#2196F3"
            weight={4}
            opacity={0.7}
          />
        )}
        
        {/* Маркеры остановок */}
        {stops.map((stop, index) => {
          // Пропускаем остановки без координат
          if (!stop.stop_lat || !stop.stop_lon) return null
          
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
                    Остановка {index + 1} из {stops.length}
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
