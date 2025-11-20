// src/components/Layout/Header.tsx
import React, { useState, useEffect } from 'react'
import { useAuth } from '@/hooks/useAuth'
import './Header.css'

interface HeaderProps {
  onLogout: () => void
}

export const Header: React.FC<HeaderProps> = ({ onLogout }) => {
  const { user } = useAuth()
  const [showUserMenu, setShowUserMenu] = useState(false)
  const [isOnline, setIsOnline] = useState(navigator.onLine)
  const [lastSync, setLastSync] = useState<Date>(new Date())

  // Monitor online/offline status
  useEffect(() => {
    const handleOnline = () => setIsOnline(true)
    const handleOffline = () => setIsOnline(false)

    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)

    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [])

  // Update last sync time
  useEffect(() => {
    const interval = setInterval(() => {
      setLastSync(new Date())
    }, 60000) // Update every minute

    return () => clearInterval(interval)
  }, [])

  const getTimeSinceSync = () => {
    const now = new Date()
    const diff = Math.floor((now.getTime() - lastSync.getTime()) / 1000)
    
    if (diff < 60) return `${diff}s ago`
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
    return `${Math.floor(diff / 3600)}h ago`
  }

  return (
    <header className="pos-header">
      <div className="header-left">
        <div className="logo">
          <span className="logo-icon">🏪</span>
          <span className="logo-text">POS System</span>
        </div>
      </div>

      <div className="header-center">
        <div className={`sync-status ${isOnline ? 'online' : 'offline'}`}>
          <span className="status-dot"></span>
          <span className="status-text">
            {isOnline ? 'Online' : 'Offline'}
          </span>
          {isOnline && (
            <span className="sync-info">
              ✅ Synced · {getTimeSinceSync()}
            </span>
          )}
        </div>
      </div>

      <div className="header-right">
        <div className="user-menu">
          <button
            className="user-menu-button"
            onClick={() => setShowUserMenu(!showUserMenu)}
          >
            <div className="user-avatar">
              {user?.first_name?.charAt(0) || 'U'}
            </div>
            <div className="user-info">
              <span className="user-name">
                {user?.first_name} {user?.last_name}
              </span>
              <span className="user-role">{user?.role}</span>
            </div>
            <span className="dropdown-arrow">▼</span>
          </button>

          {showUserMenu && (
            <>
              <div
                className="menu-overlay"
                onClick={() => setShowUserMenu(false)}
              ></div>
              <div className="user-dropdown">
                <div className="dropdown-header">
                  <div className="dropdown-user-name">
                    {user?.first_name} {user?.last_name}
                  </div>
                  <div className="dropdown-user-email">{user?.email}</div>
                </div>
                <div className="dropdown-divider"></div>
                <button className="dropdown-item" onClick={onLogout}>
                  <span className="dropdown-icon">🚪</span>
                  Logout
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </header>
  )
}
