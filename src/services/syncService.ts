// src/services/syncService.ts
import { createSale, markSaleSynced } from './supabase'
import {
  enqueue,
  getQueue,
  updateQueueItem,
  removeQueueItem,
  type QueueItem,
} from './localQueue'

const DEFAULT_SYNC_INTERVAL = Number(import.meta.env.VITE_SYNC_INTERVAL) || 30000 // 30s
const MAX_ATTEMPTS = 6

let syncTimer: number | null = null
let running = false

function isOnline(): boolean {
  // In Tauri, navigator.onLine still works. Additionally, you can add more checks later.
  return typeof navigator !== 'undefined' ? navigator.onLine : true
}

function computeItemDelay(attempts: number): number {
  const base = 2000
  const delay = Math.min(base * Math.pow(2, attempts), 30 * 60 * 1000)
  return delay
}

/** Try to sync a single queue item (push-only for type === 'sale') */
async function syncItem(item: QueueItem): Promise<boolean> {
  if (item.synced) return true
  if ((item.attempts ?? 0) >= MAX_ATTEMPTS) {
    await updateQueueItem(item.id, {
      last_error: `max attempts reached (${item.attempts})`,
    })
    return false
  }

  if ((item.attempts ?? 0) > 0) {
    const wait = computeItemDelay((item.attempts ?? 1) - 1)
    const created = new Date(item.created_at).getTime()
    const nextAllowed = created + wait
    if (Date.now() < nextAllowed) {
      return false
    }
  }

  try {
    if (item.type === 'sale') {
      // payload expected to match Database['sales']['Insert'] shape
      const res = await createSale(item.payload)
      if (res) {
        // Mark the sale as synced in the database
        const dbSynced = await markSaleSynced(res.id)
        if (!dbSynced) {
          const attempts = (item.attempts ?? 0) + 1
          await updateQueueItem(item.id, {
            attempts,
            last_error: 'markSaleSynced failed',
          })
          return false
        }

        // Mark queue item as synced
        await updateQueueItem(item.id, {
          synced: true,
          last_error: null,
        })

        await removeQueueItem(item.id)
        return true
      } else {
        const attempts = (item.attempts ?? 0) + 1
        await updateQueueItem(item.id, {
          attempts,
          last_error: 'createSale returned null',
        })
        return false
      }
    } else {
      await updateQueueItem(item.id, {
        last_error: `unsupported-item-type:${item.type}`,
      })
      return false
    }
  } catch (err: any) {
    const attempts = (item.attempts ?? 0) + 1
    const message = err?.message ? String(err.message) : String(err)
    await updateQueueItem(item.id, {
      attempts,
      last_error: message,
    })
    return false
  }
}

/** Run 1 sync pass (walk queue and try to sync items). */
export async function runSyncOnce(): Promise<void> {
  if (running) return
  running = true
  let successCount = 0
  
  try {
    if (!isOnline()) return

    const items = await getQueue(true)
    if (!items || items.length === 0) return

    for (const item of items) {
      try {
        const result = await syncItem(item)
        if (result) successCount++
      } catch (err) {
        console.warn('[syncService] syncItem threw', err)
      }
    }

    if (successCount > 0) {
      localStorage.setItem('last_sync_time', new Date().toISOString())
      console.log(`✅ [syncService] Successfully synced ${successCount} items`)
    }
  } finally {
    running = false
  }
}

/** Start periodic sync loop */
export function startSyncLoop(intervalMs: number = DEFAULT_SYNC_INTERVAL): void {
  stopSyncLoop()
  runSyncOnce().catch((e) => console.warn('[syncService] initial run error', e))

  if (typeof window !== 'undefined' && window.addEventListener) {
    window.addEventListener('online', () => {
      console.info('[syncService] network online -> runSyncOnce()')
      runSyncOnce().catch((e) => console.warn('[syncService] online handler error', e))
    })
  }

  syncTimer = window.setInterval(() => {
    runSyncOnce().catch((e) => console.warn('[syncService] interval run error', e))
  }, intervalMs)
  console.info('[syncService] started (intervalMs=', intervalMs, ')')
}

export function stopSyncLoop(): void {
  if (syncTimer !== null) {
    clearInterval(syncTimer)
    syncTimer = null
  }
  console.info('[syncService] stopped')
}

/** Helper to queue a sale immediately (wraps enqueue) */
export async function queueSale(salePayload: any) {
  // Wrap required fields / sanity checks here if you want.
  return enqueue('sale', salePayload)
}
