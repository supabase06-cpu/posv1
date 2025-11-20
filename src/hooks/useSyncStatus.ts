// src/hooks/useSyncStatus.ts
import { useState, useEffect } from 'react'
import { getQueue } from '@/services/localQueue'
import { SYNC_CONFIG } from '@/config/syncConfig'

export interface SyncStatus {
  pendingSales: number
  lastSyncTime: string | null
  isSyncing: boolean
}

export const useSyncStatus = () => {
  const [syncStatus, setSyncStatus] = useState<SyncStatus>({
    pendingSales: 0,
    lastSyncTime: null,
    isSyncing: false,
  })

  const refreshSyncStatus = async () => {
    try {
      const queue = await getQueue(true) // Get only unsynced items
      const salesCount = queue.filter((item) => item.type === 'sale').length

      // Get last sync time from localStorage
      const lastSync = localStorage.getItem('last_sync_time')

      setSyncStatus({
        pendingSales: salesCount,
        lastSyncTime: lastSync,
        isSyncing: false,
      })
    } catch (err) {
      console.error('Error refreshing sync status:', err)
    }
  }

  useEffect(() => {
    // Initial load
    refreshSyncStatus()

    // Refresh periodically
    const interval = setInterval(
      refreshSyncStatus,
      SYNC_CONFIG.SYNC_STATUS_REFRESH_INTERVAL
    )

    return () => clearInterval(interval)
  }, [])

  return { syncStatus, refreshSyncStatus }
}
