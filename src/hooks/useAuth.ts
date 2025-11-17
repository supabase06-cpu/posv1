import { useState, useEffect } from 'react'
import { getCurrentUser, loginUser, logoutUser, type AuthUser } from '@/services/auth'

export interface AuthSession {
  user: AuthUser
  timestamp: number
}

export const useAuth = () => {
  const [session, setSession] = useState<AuthSession | null>(null)
  const [loading, setLoading] = useState(true)
  const [isLoading, setIsLoading] = useState(false) // For login loading
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const loadSession = async () => {
      try {
        setLoading(true)
        const currentUser = await getCurrentUser()
        
        if (currentUser) {
          const currentSession: AuthSession = {
            user: currentUser,
            timestamp: Date.now()
          }
          setSession(currentSession)
          console.log('✅ [useAuth] User authenticated:', currentUser.email)
        } else {
          console.log('ℹ️ [useAuth] No authenticated user')
          setSession(null)
        }
      } catch (err) {
        console.error('❌ [useAuth] Error loading session:', err)
        setError('Failed to load authentication')
        setSession(null)
      } finally {
        setLoading(false)
      }
    }

    loadSession()
  }, [])

  const login = async (email: string, password: string) => {
    try {
      setIsLoading(true)
      setError(null)
      
      const result = await loginUser(email, password)
      
      if (result.success && result.user) {
        const newSession: AuthSession = {
          user: result.user,
          timestamp: Date.now()
        }
        setSession(newSession)
        console.log('✅ [useAuth] Login successful:', result.user.email)
        return { success: true }
      } else {
        setError(result.error || 'Login failed')
        console.error('❌ [useAuth] Login failed:', result.error)
        return { success: false, error: result.error || 'Login failed' }
      }
    } catch (err) {
      const errorMsg = 'An unexpected error occurred'
      setError(errorMsg)
      console.error('❌ [useAuth] Login exception:', err)
      return { success: false, error: errorMsg }
    } finally {
      setIsLoading(false)
    }
  }

  const logout = async () => {
    try {
      setIsLoading(true)
      const result = await logoutUser()
      
      if (result.success) {
        setSession(null)
        setError(null)
        console.log('✅ [useAuth] Logout successful')
        return { success: true }
      } else {
        setError(result.error || 'Logout failed')
        return { success: false, error: result.error || 'Logout failed' }
      }
    } catch (err) {
      const errorMsg = 'Logout failed'
      setError(errorMsg)
      console.error('❌ [useAuth] Logout exception:', err)
      return { success: false, error: errorMsg }
    } finally {
      setIsLoading(false)
    }
  }

  return {
    // Current session data
    session,
    user: session?.user || null,
    
    // Loading states
    loading, // Initial auth loading
    isLoading, // Login/logout loading
    
    // Status
    isAuthenticated: !!session,
    error,
    
    // Actions
    login,
    logout
  }
}
