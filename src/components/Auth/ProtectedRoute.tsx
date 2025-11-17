import React from 'react'
import { useAuth } from '@/hooks/useAuth'
import { LoginScreen } from './LoginScreen'

interface ProtectedRouteProps {
  children: React.ReactNode
  requiredRole?: 'admin' | 'manager' | 'cashier' | 'inventory' | 'all'
  fallback?: React.ReactNode
}

export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({
  children,
  requiredRole = 'all',
  fallback = <LoginScreen />,
}) => {
  const { isAuthenticated, isLoading, user } = useAuth()

  // Still loading
  if (isLoading) {
    return (
      <div className="loading-container">
        <div className="spinner">Loading...</div>
      </div>
    )
  }

  // Not authenticated
  if (!isAuthenticated || !user) {
    return <>{fallback}</>
  }

  // Check role - Admin can access everything
  if (requiredRole !== 'all') {
    const isAdmin = user.role === 'admin'
    const hasRequiredRole = user.role === requiredRole

    // Allow if admin OR has required role
    if (!isAdmin && !hasRequiredRole) {
      return (
        <div className="unauthorized-container">
          <div className="unauthorized-box">
            <h1>Access Denied</h1>
            <p>You don't have permission to access this page.</p>
            <p>Required role: {requiredRole}</p>
            <p>Your role: {user.role}</p>
          </div>
        </div>
      )
    }
  }

  // Authenticated and authorized
  return <>{children}</>
}
