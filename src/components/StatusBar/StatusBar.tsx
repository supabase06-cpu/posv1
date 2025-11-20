// src/components/StatusBar/StatusBar.tsx
import React, { useState } from 'react'
import { useNetworkStatus } from '@/hooks/useNetworkStatus'
import { useSyncStatus } from '@/hooks/useSyncStatus'
import { SYNC_CONFIG } from '@/config/syncConfig'
import { SyncQueueViewer } from '@/components/SyncQueue/SyncQueueViewer'
import './StatusBar.css'

export const StatusBar: React.FC = () => {
  const { isOnline } = useNetworkStatus()
  const { syncStatus, refreshSyncStatus } = useSyncStatus()
  const [showQueueViewer, setShowQueueViewer] = useState(false)

  if (!SYNC_CONFIG.SHOW_NETWORK_STATUS && !SYNC_CONFIG.SHOW_SYNC_STATUS) {
    return null
  }

  const formatLastSyncTime = (timestamp: string | null) => {
    if (!timestamp) return 'Never'
    const date = new Date(timestamp)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffMins = Math.floor(diffMs / 60000)

    if (diffMins < 1) return 'Just now'
    if (diffMins < 60) return `${diffMins}m ago`
    const diffHours = Math.floor(diffMins / 60)
    if (diffHours < 24) return `${diffHours}h ago`
    return date.toLocaleString()
  }

  const getNetworkMessage = () => {
    if (syncStatus.isSyncing) return SYNC_CONFIG.MESSAGES.SYNCING
    return isOnline ? SYNC_CONFIG.MESSAGES.ONLINE : SYNC_CONFIG.MESSAGES.OFFLINE
  }

  const getSyncMessage = () => {
    if (syncStatus.pendingSales === 0) {
      return SYNC_CONFIG.MESSAGES.SYNC_COMPLETE
    }
    return SYNC_CONFIG.MESSAGES.PENDING_SALES.replace(
      '{count}',
      syncStatus.pendingSales.toString()
    )
  }

  const getStatusColor = () => {
    if (syncStatus.isSyncing) return SYNC_CONFIG.COLORS.SYNCING
    return isOnline ? SYNC_CONFIG.COLORS.ONLINE : SYNC_CONFIG.COLORS.OFFLINE
  }

  const handleSyncStatusClick = () => {
    if (syncStatus.pendingSales > 0) {
      setShowQueueViewer(true)
    }
  }

  const handleCloseQueueViewer = () => {
    setShowQueueViewer(false)
    refreshSyncStatus() // Refresh status after closing
  }

  return (
    <>
      <div className="status-bar">
        {SYNC_CONFIG.SHOW_NETWORK_STATUS && (
          <div
            className="status-badge network-status"
            style={{ backgroundColor: getStatusColor() }}
          >
            {getNetworkMessage()}
          </div>
        )}

        {SYNC_CONFIG.SHOW_SYNC_STATUS && (
          <div 
            className={`status-info ${syncStatus.pendingSales > 0 ? 'clickable' : ''}`}
            onClick={handleSyncStatusClick}
            title={syncStatus.pendingSales > 0 ? 'Click to view pending sales' : ''}
          >
            <span className="sync-status">{getSyncMessage()}</span>
            {syncStatus.lastSyncTime && (
              <span className="last-sync">
                Last sync: {formatLastSyncTime(syncStatus.lastSyncTime)}
              </span>
            )}
          </div>
        )}
      </div>

      {showQueueViewer && <SyncQueueViewer onClose={handleCloseQueueViewer} />}
    </>
  )
}
