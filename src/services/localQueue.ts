// Robust local queue that prefers Tauri JS API when available,
// and falls back to browser localStorage for dev & non-Tauri environments.

export type QueueItem = {
  id: string
  type: string
  payload: any
  created_at: string
  attempts: number
  synced: boolean
  last_error?: string | null
}

const FILE_NAME = 'local_queue.json'

/**
 * Try to load Tauri JS API modules at runtime.
 * Checks if we're in Tauri environment first to avoid build-time import errors.
 */
async function loadTauriApis(): Promise<{ fs: any | null; path: any | null }> {
  try {
    // Check if we're in Tauri environment
    if (typeof window !== 'undefined' && (window as any).__TAURI__) {
      // Use variable to hide import path from Vite static analysis
      const apiBase = '@tauri-apps/api'
      const fsPath = `${apiBase}/fs`
      const pathPath = `${apiBase}/path`
      
      const fsModule = await import(/* @vite-ignore */ fsPath)
      const pathModule = await import(/* @vite-ignore */ pathPath)
      return { fs: fsModule, path: pathModule }
    }
  } catch (err) {
    console.warn('Tauri APIs not available:', err)
  }
  return { fs: null, path: null }
}

/** Get a storage directory path from Tauri path API (best-effort) */
async function getStorageDir(): Promise<string | null> {
  try {
    const { path } = await loadTauriApis()
    if (!path) return null

    // try common path helpers (different versions expose different helpers)
    const candidates = ['appDir', 'appDataDir', 'appConfigDir', 'appLocalDataDir', 'appCacheDir']

    for (const name of candidates) {
      // @ts-ignore
      const fn = path?.[name]
      if (typeof fn === 'function') {
        try {
          // many of these return Promise<string>
          const dir = await fn()
          if (dir && typeof dir === 'string') return dir
        } catch {
          // ignore and continue trying other helpers
        }
      }
    }
    return null
  } catch (err) {
    return null
  }
}

/** Read text file using Tauri fs (if available). Throws if not available. */
async function readTextFileTauri(fullPath: string): Promise<string> {
  const { fs } = await loadTauriApis()
  if (!fs) throw new Error('tauri-fs-unavailable')

  // plugin API may provide readTextFile or readFile
  if (typeof fs.readTextFile === 'function') {
    // @ts-ignore
    return await fs.readTextFile(fullPath)
  }

  if (typeof fs.readFile === 'function') {
    // @ts-ignore
    const res = await fs.readFile(fullPath)
    if (typeof res === 'string') return res
    if (res instanceof Uint8Array) return new TextDecoder().decode(res)
    try {
      return JSON.stringify(res)
    } catch {
      return String(res)
    }
  }

  throw new Error('tauri-fs-read-not-supported')
}

/** Write text file using Tauri fs (if available). Throws if not available. */
async function writeTextFileTauri(fullPath: string, contents: string): Promise<void> {
  const { fs } = await loadTauriApis()
  if (!fs) throw new Error('tauri-fs-unavailable')

  if (typeof fs.writeFile === 'function') {
    // try object signature first: writeFile({ path, contents })
    try {
      // @ts-ignore
      await fs.writeFile({ path: fullPath, contents })
      return
    } catch {
      // ignore and try alternative signatures
    }

    try {
      // @ts-ignore
      await fs.writeFile(fullPath, contents)
      return
    } catch (err) {
      throw err
    }
  }

  throw new Error('tauri-fs-write-not-supported')
}

/** Ensure directory exists (best-effort with Tauri) */
async function ensureDirTauri(dir: string): Promise<void> {
  const { fs } = await loadTauriApis()
  if (!fs) return
  if (typeof fs.createDir === 'function') {
    try {
      // some versions accept (path, { recursive: true })
      // @ts-ignore
      await fs.createDir(dir, { recursive: true }).catch(() => {})
    } catch {
      // ignore
    }
  }
}

/** Check if a file exists via Tauri fs (best-effort) */
async function existsTauri(fullPath: string): Promise<boolean> {
  const { fs } = await loadTauriApis()
  if (!fs) return false
  if (typeof fs.exists === 'function') {
    try {
      // @ts-ignore
      return await fs.exists(fullPath)
    } catch {
      return false
    }
  }
  // fallback: try reading it
  try {
    await readTextFileTauri(fullPath)
    return true
  } catch {
    return false
  }
}

/** Load the queue from persistent storage (Tauri FS preferred, localStorage fallback) */
export async function loadQueue(): Promise<QueueItem[]> {
  // Try Tauri FS first
  try {
    const dir = await getStorageDir()
    if (dir) {
      await ensureDirTauri(dir)
      const safeDir = dir.replace(/[/\\]$/, '')
      const fullPath = `${safeDir}/${FILE_NAME}`
      const present = await existsTauri(fullPath).catch(() => false)
      if (!present) return []
      const text = await readTextFileTauri(fullPath).catch(() => '')
      if (!text) return []
      try {
        return JSON.parse(text) as QueueItem[]
      } catch (err) {
        console.warn('localQueue: JSON parse error from Tauri file', err)
        return []
      }
    }
  } catch {
    // fall through to localStorage
  }

  // Fallback to window.localStorage (dev / browser)
  try {
    const raw = window.localStorage.getItem(FILE_NAME)
    if (!raw) return []
    return JSON.parse(raw) as QueueItem[]
  } catch (err) {
    console.warn('localQueue.loadQueue fallback error', err)
    return []
  }
}

/** Save the queue (Tauri FS preferred, localStorage fallback) */
export async function saveQueue(items: QueueItem[]): Promise<void> {
  const body = JSON.stringify(items, null, 2)

  // Try Tauri FS
  try {
    const dir = await getStorageDir()
    if (dir) {
      await ensureDirTauri(dir)
      const safeDir = dir.replace(/[/\\]$/, '')
      const fullPath = `${safeDir}/${FILE_NAME}`
      await writeTextFileTauri(fullPath, body).catch((err) => {
        console.warn('localQueue.saveQueue writeFile failed', err)
      })
      return
    }
  } catch {
    // fallthrough
  }

  // Fallback localStorage
  try {
    window.localStorage.setItem(FILE_NAME, body)
  } catch (err) {
    console.warn('localQueue.saveQueue fallback (localStorage) failed', err)
  }
}

/** Simple UUID v4 generator */
function uuidv4(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
    const r = (Math.random() * 16) | 0
    const v = c === 'x' ? r : (r & 0x3) | 0x8
    return v.toString(16)
  })
}

/** Add a new item to the queue */
export async function enqueue(type: string, payload: any): Promise<QueueItem> {
  const items = await loadQueue()
  const item: QueueItem = {
    id: uuidv4(),
    type,
    payload,
    created_at: new Date().toISOString(),
    attempts: 0,
    synced: false,
    last_error: null,
  }
  items.push(item)
  await saveQueue(items)
  return item
}

/** Get queued items */
export async function getQueue(onlyUnsynced = true): Promise<QueueItem[]> {
  const items = await loadQueue()
  return onlyUnsynced ? items.filter((i) => !i.synced) : items
}

/** Update a queue item (partial update) */
export async function updateQueueItem(id: string, updates: Partial<QueueItem>): Promise<void> {
  const items = await loadQueue()
  const idx = items.findIndex((i) => i.id === id)
  if (idx === -1) return
  items[idx] = { ...items[idx], ...updates }
  await saveQueue(items)
}

/** Remove an item by id */
export async function removeQueueItem(id: string): Promise<void> {
  let items = await loadQueue()
  items = items.filter((i) => i.id !== id)
  await saveQueue(items)
}
