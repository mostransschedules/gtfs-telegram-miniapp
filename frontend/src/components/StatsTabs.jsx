// =============================================================================
// STATS TABS - Улучшенная версия с всеми фичами
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
  const [expandedMin, setExpandedMin] = useState(false)
  const [expandedMax, setExpandedMax] = useState(false)

  useEffect(() => {
    if (route && stop) {
      loadData()
    }
  }, [route, stop, direction, dayType])

  const loadData = async () => {
    setLoading(true)
    try {
      const intervalsData = await getIntervals(
        route.route_short_name,
        stop.stop_name,
        direction,
        dayType
      )
      console.log('Intervals data:', intervalsData)
      setIntervals(intervalsData)

      const durationsData = await getDurations(
        route.route_short_name,
        direction,
        dayType
      )
      console.log('Durations data:', durationsData)
      setDurations(durationsData)
    } catch (err) {
      console.error('Ошибка загрузки статистики:', err)
    } finally {
      setLoading(false)
    }
  }

  // Получить все диапазоны времени для значения (хронологически)
  const getAllTimeRangesForDuration = (durations, value) => {
    if (!durations.trips) return []
    
    const matchingTrips = durations.trips.filter(t => t.duration === value)
    if (matchingTrips.length === 0) return []
    
    // Группируем последовательные рейсы в диапазоны
    const times = matchingTrips.map(t => t.first_time).sort((a, b) => {
      const [ha, ma] = a.split(':').map(Number)
      const [hb, mb] = b.split(':').map(Number)
      const ka = ha < 4 ? ha + 24 : ha
      const kb = hb < 4 ? hb + 24 : hb
      return (ka * 60 + ma) - (kb * 60 + mb)
    })
    
    // Если одно время
    if (times.length === 1) {
      return [`в ${times[0]}`]
    }
    
    // Группируем в диапазоны (если времена близко - в один диапазон)
    const ranges = []
    let rangeStart = times[0]
    let rangeLast = times[0]
    
    for (let i = 1; i < times.length; i++) {
      const [h1, m1] = rangeLast.split(':').map(Number)
      const [h2, m2] = times[i].split(':').map(Number)
      
      const diff = Math.abs((h2 * 60 + m2) - (h1 * 60 + m1))
      
      if (diff < 120) { // Если разница < 2 часов - в один диапазон
        rangeLast = times[i]
      } else {
        ranges.push(`с ${rangeStart} до ${rangeLast}`)
        rangeStart = times[i]
        rangeLast = times[i]
      }
    }
    ranges.push(`с ${rangeStart} до ${rangeLast}`)
    
    return ranges
  }

  // Данные для графика интервалов (сортировка от первого рейса)
  const getIntervalsChartData = () => {
    if (!intervals) return null

    // Сортируем часы начиная с 4:00
    const sortedIndices = intervals.hours.map((h, i) => ({ hour: h, index: i }))
      .sort((a, b) => {
        const ha = a.hour < 4 ? a.hour + 24 : a.hour
        const hb = b.hour < 4 ? b.hour + 24 : b.hour
        return ha - hb
      })
    
    const sortedHours = sortedIndices.map(x => `${x.hour}:00`)
    const sortedMin = sortedIndices.map(x => intervals.min_intervals[x.index])
    const sortedMax = sortedIndices.map(x => intervals.max_intervals[x.index])

    return {
      labels: sortedHours,
      datasets: [
        {
          label: 'Минимальный интервал',
          data: sortedMin,
          borderColor: 'rgb(75, 192, 192)',
          backgroundColor: 'rgba(75, 192, 192, 0.2)',
          fill: true,
          tension: 0.4
        },
        {
          label: 'Максимальный интервал',
          data: sortedMax,
          borderColor: 'rgb(255, 140, 0)',
          backgroundColor: 'rgba(255, 140, 0, 0.2)',
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
          color: window.Telegram?.WebApp?.themeParams?.text_color || '#000000'
        }
      }
    },
    scales: {
      x: {
        ticks: { 
          color: window.Telegram?.WebApp?.themeParams?.text_color || '#000000'
        },
        grid: { 
          color: window.Telegram?.WebApp?.colorScheme === 'dark' 
            ? 'rgba(255, 255, 255, 0.1)' 
            : 'rgba(0, 0, 0, 0.1)' 
        }
      },
      y: {
        ticks: { 
          color: window.Telegram?.WebApp?.themeParams?.text_color || '#000000'
        },
        grid: { 
          color: window.Telegram?.WebApp?.colorScheme === 'dark' 
            ? 'rgba(255, 255, 255, 0.1)' 
            : 'rgba(0, 0, 0, 0.1)' 
        }
      }
    }
  }

  return (
    <div className="stats-tabs">
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

      <div className="tabs-content">
        {loading ? (
          <div className="text-center mt-3">
            <div className="spinner"></div>
            <p className="mt-2">Загрузка статистики...</p>
          </div>
        ) : (
          <>
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

            {activeTab === 'durations' && (
              <div className="tab-panel">
                <h3>Время выполнения рейсов</h3>
                {durations && durations.trips && durations.trips.length > 0 ? (
                  <>
                    {/* Карточки */}
                    <div className="duration-cards">
                      <div className="duration-card">
                        <div className="duration-card-label">Среднее время</div>
                        <div className="duration-card-value">{durations.average.toFixed(1)} мин</div>
                      </div>
                      
                      {/* Минимальное */}
                      <div className="duration-card">
                        <div className="duration-card-label">Минимальное время</div>
                        <div className="duration-card-value">{durations.min} мин</div>
                        <div className="duration-card-time">
                          {getAllTimeRangesForDuration(durations, durations.min).length === 1 ? (
                            getAllTimeRangesForDuration(durations, durations.min)[0]
                          ) : (
                            <>
                              <button 
                                className="expand-btn"
                                onClick={() => setExpandedMin(!expandedMin)}
                              >
                                {expandedMin ? '▼' : '▶'} {getAllTimeRangesForDuration(durations, durations.min).length} периода
                              </button>
                              {expandedMin && (
                                <div className="time-ranges-list">
                                  {getAllTimeRangesForDuration(durations, durations.min).map((range, i) => (
                                    <div key={i}>{range}</div>
                                  ))}
                                </div>
                              )}
                            </>
                          )}
                        </div>
                      </div>
                      
                      {/* Максимальное */}
                      <div className="duration-card">
                        <div className="duration-card-label">Максимальное время</div>
                        <div className="duration-card-value">{durations.max} мин</div>
                        <div className="duration-card-time">
                          {getAllTimeRangesForDuration(durations, durations.max).length === 1 ? (
                            getAllTimeRangesForDuration(durations, durations.max)[0]
                          ) : (
                            <>
                              <button 
                                className="expand-btn"
                                onClick={() => setExpandedMax(!expandedMax)}
                              >
                                {expandedMax ? '▼' : '▶'} {getAllTimeRangesForDuration(durations, durations.max).length} периода
                              </button>
                              {expandedMax && (
                                <div className="time-ranges-list">
                                  {getAllTimeRangesForDuration(durations, durations.max).map((range, i) => (
                                    <div key={i}>{range}</div>
                                  ))}
                                </div>
                              )}
                            </>
                          )}
                        </div>
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
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}

export default StatsTabs
