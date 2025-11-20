// src/main.tsx
import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './index.css'

const rootElement = document.getElementById('root')!
const root = ReactDOM.createRoot(rootElement)

// Only use StrictMode in development
if (import.meta.env.DEV) {
  root.render(
    <React.StrictMode>
      <App />
    </React.StrictMode>
  )
} else {
  root.render(<App />)
}

/**
 * Remove the splash screen inserted in index.html.
 */
function removeSplash(): void {
  try {
    const winAny = window as any
    if (winAny.__SPLASH_TIMEOUT) {
      clearTimeout(winAny.__SPLASH_TIMEOUT)
      winAny.__SPLASH_TIMEOUT = undefined
    }

    const splash = document.getElementById('app-splash')
    if (splash) {
      splash.classList.add('hidden')
      setTimeout(() => {
        try {
          if (splash.parentNode) splash.parentNode.removeChild(splash)
        } catch (e) {
          console.warn('Failed to remove splash element:', e)
        }
      }, 420)
    }

    const rootEl = document.getElementById('root')
    if (rootEl) rootEl.style.visibility = 'visible'
  } catch (e) {
    console.warn('removeSplash error', e)
  }
}

if (document.readyState === 'complete' || document.readyState === 'interactive') {
  setTimeout(removeSplash, 120)
} else {
  window.addEventListener('DOMContentLoaded', () => setTimeout(removeSplash, 120))
}
