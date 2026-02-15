// =============================================================================
// STATS TABS - Вкладки со статистикой и графиками
// =============================================================================

import { useState, useEffect } from 'react'
import { Line, Bar } from 'react-chartjs-2'
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend,
  Filler
} from 'chart.js'
import { getIntervals, getDurations } from '../utils/api'
import './StatsTabs.css'

// Регистрируем компоненты Chart.js
ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend,
  Filler
)

function StatsTabs({ route, stop, direction, dayType }) {
  const [activeTab, setActiveTab] = useState('intervals')
  const [intervals, setIntervals] = useState(null)
  const [durations, setDurations] = useState(null)
  const [loading, setLoading] = useState(false)

  // Загрузка данных при смене параметров
  useEffect(() => {
    if (route && stop) {
      loadData()
    }
  }, [route, stop, direction, dayType])

  const loadData = async () => {
    setLoading(true)
    try {
      // Загружаем интервалы
      const intervalsData = await getIntervals(
        route.route_short_name,
        stop.stop_name,
        direction,
        dayType
      )
      setIntervals(intervalsData)

      // Загружаем время рейсов
      const durationsData = await getDurations(
        route.route_short_name,
        direction,
        dayType
      )
      setDurations(durationsData)
    } catch (err) {
      console.error('Ошибка загрузки статистики:', err)
    } finally {
      setLoading(false)
    }
  }

  // Данные для графика интервалов
  const getIntervalsChartData = () => {
    if (!intervals) return null

    return {
      labels: intervals.hours.map(h => `${h}:00`),
      datasets: [
        {
          label: 'Минимальный интервал',
          data: intervals.min_intervals,
          borderColor: 'rgb(75, 192, 192)',
          backgroundColor: 'rgba(75, 192, 192, 0.2)',
          fill: true,
          tension: 0.4
        },
        {
          label: 'Максимальный интервал',
          data: intervals.max_intervals,
          borderColor: 'rgb(255, 99, 132)',
          backgroundColor: 'rgba(255, 99, 132, 0.2)',
          fill: true,
          tension: 0.4
        }
      ]
    }
  }

  // Данные для графика времени рейсов
  const getDurationsChartData = () => {
    if (!durations || !durations.trips) return null

    const labels = durations.trips.map(t => t.first_time)
    const data = durations.trips.map(t => t.duration)

    return {
      labels,
      datasets: [
        {
          label: 'Время рейса (мин)',
          data,
          backgroundColor: 'rgba(54, 162, 235, 0.5)',
          borderColor: 'rgb(54, 162, 235)',
          borderWidth: 1
        }
      ]
    }
  }

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        labels: {
          color: 'var(--tg-text)'
        }
      }
    },
    scales: {
      x: {
        ticks: { color: 'var(--tg-text)' },
        grid: { color: 'rgba(128, 128, 128, 0.1)' }
      },
      y: {
        ticks: { color: 'var(--tg-text)' },
        grid: { color: 'rgba(128, 128, 128, 0.1)' }
      }
    }
  }

  return (
    <div className="stats-tabs">
      {/* Переключатель вкладок */}
      <div className="tabs-header">
        <button
          className={activeTab === 'intervals' ? 'active' : ''}
          onClick={() => setActiveTab('intervals')}
        >
          📊 Интервалы
        </button>
        <button
          className={activeTab === 'durations' ? 'active' : ''}
          onClick={() => setActiveTab('durations')}
        >
          ⏱️ Время рейсов
        </button>
        <button
          className={activeTab === 'stats' ? 'active' : ''}
          onClick={() => setActiveTab('stats')}
        >
          📈 Статистика
        </button>
      </div>

      {/* Содержимое вкладок */}
      <div className="tabs-content">
        {loading ? (
          <div className="text-center mt-3">
            <div className="spinner"></div>
            <p className="mt-2">Загрузка статистики...</p>
          </div>
        ) : (
          <>
            {/* Вкладка: Интервалы */}
            {activeTab === 'intervals' && (
              <div className="tab-panel">
                <h3>График интервалов по часам</h3>
                {intervals && getIntervalsChartData() ? (
                  <div className="chart-container">
                    <Line 
                      data={getIntervalsChartData()} 
                      options={chartOptions}
                    />
                  </div>
                ) : (
                  <div className="info">
                    ℹ️ Нет данных об интервалах
                  </div>
                )}
              </div>
            )}

            {/* Вкладка: Время рейсов */}
            {activeTab === 'durations' && (
              <div className="tab-panel">
                <h3>Время выполнения рейсов</h3>
                {durations && getDurationsChartData() ? (
                  <>
                    <div className="stats-summary">
                      <div className="stat-item">
                        <span className="stat-label">Среднее:</span>
                        <span className="stat-value">{durations.average.toFixed(1)} мин</span>
                      </div>
                      <div className="stat-item">
                        <span className="stat-label">Минимум:</span>
                        <span className="stat-value">{durations.min} мин</span>
                      </div>
                      <div className="stat-item">
                        <span className="stat-label">Максимум:</span>
                        <span className="stat-value">{durations.max} мин</span>
                      </div>
                    </div>
                    <div className="chart-container">
                      <Bar 
                        data={getDurationsChartData()} 
                        options={chartOptions}
                      />
                    </div>
                  </>
                ) : (
                  <div className="info">
                    ℹ️ Нет данных о времени рейсов
                  </div>
                )}
              </div>
            )}

            {/* Вкладка: Статистика */}
            {activeTab === 'stats' && (
              <div className="tab-panel">
                <h3>Общая статистика</h3>
                
                {intervals && (
                  <div className="stats-card">
                    <h4>📊 Интервалы движения</h4>
                    <div className="stat-item">
                      <span className="stat-label">Средний интервал:</span>
                      <span className="stat-value">
                        {(
                          intervals.min_intervals.filter(i => i > 0).reduce((a, b) => a + b, 0) /
                          intervals.min_intervals.filter(i => i > 0).length
                        ).toFixed(1)} мин
                      </span>
                    </div>
                    <div className="stat-item">
                      <span className="stat-label">Минимальный:</span>
                      <span className="stat-value">
                        {Math.min(...intervals.min_intervals.filter(i => i > 0))} мин
                      </span>
                    </div>
                    <div className="stat-item">
                      <span className="stat-label">Максимальный:</span>
                      <span className="stat-value">
                        {Math.max(...intervals.max_intervals)} мин
                      </span>
                    </div>
                  </div>
                )}

                {durations && (
                  <div className="stats-card">
                    <h4>⏱️ Время рейсов</h4>
                    <div className="stat-item">
                      <span className="stat-label">Среднее время:</span>
                      <span className="stat-value">{durations.average.toFixed(1)} мин</span>
                    </div>
                    <div className="stat-item">
                      <span className="stat-label">Быстрейший:</span>
                      <span className="stat-value">{durations.min} мин</span>
                    </div>
                    <div className="stat-item">
                      <span className="stat-label">Самый долгий:</span>
                      <span className="stat-value">{durations.max} мин</span>
                    </div>
                    <div className="stat-item">
                      <span className="stat-label">Всего рейсов:</span>
                      <span className="stat-value">{durations.count}</span>
                    </div>
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}

export default StatsTabs
