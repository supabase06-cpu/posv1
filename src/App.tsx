// src/App.tsx
import { useEffect, useRef } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { useAuth } from '@/hooks/useAuth'
import { LoginScreen } from '@/components/Auth/LoginScreen'
import { Layout } from '@/components/Layout/Layout'
import { HomePage } from '@/pages/HomePage'
import { BillingScreen } from '@/components/Billing/BillingScreen'
import { startSyncLoop, stopSyncLoop } from '@/services/syncService'
import './App.css'

function App() {
  const { isAuthenticated, isLoading, user, logout } = useAuth()
  
  // Prevent multiple sync loop starts
  const syncStartedRef = useRef(false)

  useEffect(() => {
    // Prevent duplicate sync loop starts
    if (syncStartedRef.current) {
      console.log('⏭️ [App] Sync loop already started, skipping...')
      return
    }

    // Only start sync loop in environments with window (renderer / browser)
    try {
      if (typeof window !== 'undefined') {
        console.info('[App] Starting background sync loop')
        startSyncLoop()
        syncStartedRef.current = true
      }
    } catch (err) {
      console.warn('[App] Failed to start sync loop', err)
    }

    return () => {
      try {
        if (syncStartedRef.current) {
          console.info('[App] Stopping background sync loop')
          stopSyncLoop()
          syncStartedRef.current = false
        }
      } catch (err) {
        console.warn('[App] Failed to stop sync loop', err)
      }
    }
  }, []) // Empty dependency array - runs only once

  if (isLoading) {
    return (
      <div className="loading-container">
        <div className="spinner">Initializing...</div>
      </div>
    )
  }

  if (!isAuthenticated) {
    return <LoginScreen onLoginSuccess={() => window.location.reload()} />
  }

  const handleLogout = async () => {
    const result = await logout()
    if (result.success) {
      window.location.reload()
    }
  }

  return (
    <BrowserRouter>
      <Layout onLogout={handleLogout}>
        <Routes>
          {/* Home Page */}
          <Route path="/" element={<HomePage />} />
          
          {/* Billing Screen */}
          <Route
            path="/billing"
            element={
              <BillingScreen
                storeId={user?.store_id || 'store-001'}
                cashierId={user?.id || ''}
                cashierName={`${user?.first_name} ${user?.last_name}`}
              />
            }
          />
          
          {/* Redirect all other routes to home */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Layout>
    </BrowserRouter>
  )
}

export default App
