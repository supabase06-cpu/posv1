import { useState } from 'react'
import { useAuth } from '@/hooks/useAuth'
import { ProtectedRoute } from '@/components/Auth/ProtectedRoute'
import { LoginScreen } from '@/components/Auth/LoginScreen'
import { BillingScreen } from '@/components/Billing/BillingScreen'
import './App.css'

function App() {
  const { isAuthenticated, isLoading, user, logout } = useAuth()
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false)

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
    <div className="app-container">
      <div className="app-header">
        <div className="app-header-left">
          <h1>POS System</h1>
        </div>
        <div className="app-header-right">
          <span className="user-info">
            {user?.first_name} {user?.last_name} ({user?.role})
          </span>
          <button onClick={() => setShowLogoutConfirm(true)} className="btn-logout">
            Logout
          </button>
        </div>
      </div>

      <div className="app-content">
        <ProtectedRoute requiredRole="cashier">
          <BillingScreen
            storeId={user?.store_id || 'store-001'}
            cashierId={user?.id || ''}
            cashierName={`${user?.first_name} ${user?.last_name}`}
          />
        </ProtectedRoute>
      </div>

      {showLogoutConfirm && (
        <div className="modal-overlay">
          <div className="modal">
            <h2>Confirm Logout</h2>
            <p>Are you sure you want to logout?</p>
            <div className="modal-actions">
              <button
                onClick={() => setShowLogoutConfirm(false)}
                className="btn btn-secondary"
              >
                Cancel
              </button>
              <button onClick={handleLogout} className="btn btn-danger">
                Logout
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default App
