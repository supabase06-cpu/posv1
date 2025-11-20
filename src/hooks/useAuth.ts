import { useState, useEffect } from 'react'
import { getCurrentUser, loginUser, logoutUser, type AuthUser } from '@/services/auth'
import { loadAllProductsForCache, loadAllCustomersForCache } from '@/services/supabase'

export interface AuthSession {
  user: AuthUser
  timestamp: number
}

// GLOBAL SINGLETON - Survives React.StrictMode re-renders
let globalCacheLoading = false
let globalCacheLoaded = false

export const useAuth = () => {
  const [session, setSession] = useState<AuthSession | null>(null)
  const [loading, setLoading] = useState(true)
  const [isLoading, setIsLoading] = useState(false)
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
          
          // Check global flags (survives StrictMode)
          if (globalCacheLoaded) {
            console.log('⏭️ [useAuth] Cache already loaded, skipping...')
          } else if (globalCacheLoading) {
            console.log('⏭️ [useAuth] Cache load already in progress, skipping...')
          } else {
            console.log('📥 [useAuth] Loading offline cache (first time only)...')
            globalCacheLoading = true
            
            try {
              await Promise.all([
                loadAllProductsForCache(currentUser.store_id),
                loadAllCustomersForCache(currentUser.store_id),
              ])
              globalCacheLoaded = true
              console.log('✅ [useAuth] Offline cache loaded successfully')
            } catch (cacheErr) {
              console.warn('⚠️ [useAuth] Failed to pre-cache data:', cacheErr)
              globalCacheLoading = false
            }
          }
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
        
        // Reset global flags for new login
        globalCacheLoading = false
        globalCacheLoaded = false
        
        try {
          globalCacheLoading = true
          await Promise.all([
            loadAllProductsForCache(result.user.store_id),
            loadAllCustomersForCache(result.user.store_id),
          ])
          globalCacheLoaded = true
          console.log('✅ [useAuth] Offline cache loaded for', result.user.store_id)
        } catch (cacheErr) {
          console.warn('⚠️ [useAuth] Failed to pre-cache data:', cacheErr)
          globalCacheLoading = false
        }
        
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
        // Reset global flags
        globalCacheLoading = false
        globalCacheLoaded = false
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
    session,
    user: session?.user || null,
    loading,
    isLoading,
    isAuthenticated: !!session,
    error,
    login,
    logout
  }
}
