// src/config/syncConfig.ts
/**
 * Sync and Network Status Configuration
 * Customize these settings without touching core logic
 */

export const SYNC_CONFIG = {
  // Sync interval in milliseconds (default: 30 seconds)
  SYNC_INTERVAL: 30000,

  // Max retry attempts for failed syncs
  MAX_RETRY_ATTEMPTS: 6,

  // Network status check interval (default: 5 seconds)
  NETWORK_CHECK_INTERVAL: 5000,

  // Show network status indicator
  SHOW_NETWORK_STATUS: true,

  // Show sync status (pending sales count)
  SHOW_SYNC_STATUS: true,

  // Auto-refresh sync status interval (default: 10 seconds)
  SYNC_STATUS_REFRESH_INTERVAL: 10000,

  // Network status colors
  COLORS: {
    ONLINE: '#10b981', // Green
    OFFLINE: '#ef4444', // Red
    SYNCING: '#f59e0b', // Amber
  },

  // Display messages
  MESSAGES: {
    ONLINE: '🟢 Online',
    OFFLINE: '🔴 Offline',
    SYNCING: '🔄 Syncing...',
    SYNC_COMPLETE: '✅ All sales synced',
    PENDING_SALES: '⏳ {count} sale(s) pending sync',
    LAST_SYNC: 'Last synced: {time}',
  },
}
