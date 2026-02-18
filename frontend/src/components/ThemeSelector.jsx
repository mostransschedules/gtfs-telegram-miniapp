import React from 'react'
import { THEMES } from '../utils/theme'
import './ThemeSelector.css'

const ThemeSelector = ({ currentTheme, onThemeChange, onClose }) => {
  const themes = [
    { id: THEMES.SYSTEM, name: 'Follow System', icon: '🔄', description: 'Автоматически' },
    { id: THEMES.BLACK, name: 'Black', icon: '🌑', description: 'Тёмная тема' },
    { id: THEMES.WHITE, name: 'White', icon: '☀️', description: 'Светлая тема' },
    { id: THEMES.GLASS, name: 'Glass', icon: '✨', description: 'Стеклянная тема' }
  ]

  return (
    <div className="theme-modal-overlay" onClick={onClose}>
      <div className="theme-modal" onClick={(e) => e.stopPropagation()}>
        <div className="theme-modal-header">
          <h3>🎨 Выбор темы</h3>
          <button className="theme-modal-close" onClick={onClose}>✕</button>
        </div>
        
        <div className="theme-options">
          {themes.map(theme => (
            <button
              key={theme.id}
              className={`theme-option ${currentTheme === theme.id ? 'active' : ''}`}
              onClick={() => {
                onThemeChange(theme.id)
                setTimeout(onClose, 300) // Небольшая задержка для визуального эффекта
              }}
            >
              <span className="theme-option-icon">{theme.icon}</span>
              <div className="theme-option-text">
                <div className="theme-option-name">{theme.name}</div>
                <div className="theme-option-description">{theme.description}</div>
              </div>
              {currentTheme === theme.id && (
                <span className="theme-option-check">✓</span>
              )}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}

export default ThemeSelector
