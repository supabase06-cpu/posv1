// src/hooks/useNetworkStatus.ts
import { useState, useEffect } from 'react'
import { SYNC_CONFIG } from '@/config/syncConfig'

export const useNetworkStatus = () => {
  const [isOnline, setIsOnline] = useState<boolean>(
    typeof navigator !== 'undefined' ? navigator.onLine : true
  )

  useEffect(() => {
    const handleOnline = () => {
      console.log('🟢 Network: Online')
      setIsOnline(true)
    }

    const handleOffline = () => {
      console.log('🔴 Network: Offline')
      setIsOnline(false)
    }

    // Listen for network status changes
    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)

    // Optional: Periodic check (fallback for unreliable events)
    const checkInterval = setInterval(() => {
      const currentStatus = navigator.onLine
      if (currentStatus !== isOnline) {
        setIsOnline(currentStatus)
      }
    }, SYNC_CONFIG.NETWORK_CHECK_INTERVAL)

    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
      clearInterval(checkInterval)
    }
  }, [isOnline])

  return { isOnline }
}
