// src/services/sync.ts
import { getQueue, updateQueueItem, removeQueueItem, enqueue, QueueItem } from './localQueue'
import { createSale } from './supabase' // use your existing createSale
import type { Database } from '@/types/database'

// Settings
const SYNC_INTERVAL_MS = Number(import.meta.env.VITE_SYNC_INTERVAL || 300000) // default 5min
const MAX_ATTEMPTS = 5

let syncTimer: number | undefined = undefined
let isSyncing = false

/** Generic server sender — adapt for types beyond 'sale' */
async function sendToServer(item: QueueItem): Promise<{ ok: boolean; error?: any }> {
  try {
    if (item.type === 'sale') {
      // Attempt to create sale via existing supabase helper
      const payload = item.payload as Database['public']['Tables']['sales']['Insert']
      const res = await createSale(payload)
      if (res) {
        return { ok: true }
      } else {
        // createSale returns null on error
        return { ok: false, error: 'createSale returned null' }
      }
    }

    // For other types (product / inventory) we attempt a generic REST insert using supabase client
    // Adapt as needed: you can implement createProduct, updateInventory functions and call them here.
    // For now, return not implemented
    return { ok: false, error: `No handler for type "${item.type}"` }
  } catch (err) {
    return { ok: false, error: err }
  }
}

/** Run one sync pass */
export async function runSyncOnce(): Promise<{ success: number; failed: number }> {
  if (isSyncing) return { success: 0, failed: 0 }
  isSyncing = true
  let success = 0
  let failed = 0

  try {
    const items = await getQueue(true)
    // sort by created_at (oldest first)
    items.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())

    for (const item of items) {
      // Skip if attempts exceed limit
      if (item.attempts >= MAX_ATTEMPTS) {
        failed++
        // leave it in queue for manual inspection, or move to a dead-letter store. For now we mark last_error.
        await updateQueueItem(item.id, { last_error: 'Max attempts exceeded' })
        continue
      }

      // try to send
      const result = await sendToServer(item)
      if (result.ok) {
        success++
        await removeQueueItem(item.id)
      } else {
        failed++
        const attempts = (item.attempts || 0) + 1
        await updateQueueItem(item.id, { attempts, last_error: String(result.error) })
      }
    }
  } finally {
    isSyncing = false
  }

  return { success, failed }
}

/** Start periodic sync. Returns a stop function. */
export function startPeriodicSync(intervalMs: number = SYNC_INTERVAL_MS): () => void {
  // immediate run
  runSyncOnce().catch((e) => console.warn('runSyncOnce error', e))

  // clear previous timer
  if (syncTimer) {
    clearInterval(syncTimer)
  }

  syncTimer = window.setInterval(() => {
    runSyncOnce().catch((e) => console.warn('runSyncOnce error', e))
  }, intervalMs)

  return () => {
    if (syncTimer) {
      clearInterval(syncTimer)
      syncTimer = undefined
    }
  }
}

/** Utility to queue a sale (convenience wrapper) */
export async function queueSale(salePayload: any) {
  // default: ensure store_id present
  const payload = {
    ...salePayload,
    store_id: salePayload.store_id || (import.meta.env.VITE_STORE_ID || 'store-001'),
  }
  return await enqueue('sale', payload)
}
