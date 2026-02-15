// =============================================================================
// MAIN.JSX - Точка входа React приложения
// =============================================================================
// Этот файл первым запускается после загрузки страницы
// Он инициализирует React и монтирует приложение в DOM
// =============================================================================

import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import './index.css'

// Убираем экран загрузки после монтирования React
const hideLoadingScreen = () => {
  const loadingScreen = document.getElementById('loading-screen')
  if (loadingScreen) {
    loadingScreen.style.opacity = '0'
    loadingScreen.style.transition = 'opacity 0.3s'
    setTimeout(() => {
      loadingScreen.remove()
    }, 300)
  }
}

// Монтируем React приложение
ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)

// Скрываем загрузочный экран после монтирования
setTimeout(hideLoadingScreen, 100)
