// src/services/customerCache.ts
import type { Database } from '@/types/database'

const CACHE_PREFIX = 'pos_customer_cache_v1_'
const CACHE_VERSION = 1

type CustomerRow = Database['public']['Tables']['customers']['Row']

interface CacheMetadata {
  version: number
  lastUpdated: string
  storeId: string
}

/** Try to dynamically load Tauri FS & path APIs */
async function tryTauriApis(): Promise<{ fs?: any; path?: any } | null> {
  try {
    if (typeof window !== 'undefined' && (window as any).__TAURI__) {
      const apiBase = '@tauri-apps/api'
      const fsPath = `${apiBase}/fs`
      const pathPath = `${apiBase}/path`
      
      const fsModule = await import(/* @vite-ignore */ fsPath)
      const pathModule = await import(/* @vite-ignore */ pathPath)
      return { fs: fsModule, path: pathModule }
    }
  } catch (err) {
    console.warn('customerCache: Tauri APIs not available', err)
  }
  return null
}

/** Get cache filename for store */
function cacheFileNameFor(storeId: string) {
  return `${CACHE_PREFIX}${storeId}.json`
}

/** Load cached customers with metadata validation */
export async function loadCachedCustomers(storeId: string): Promise<CustomerRow[]> {
  const fileName = cacheFileNameFor(storeId)

  // Try Tauri FS first
  try {
    const apis = await tryTauriApis()
    if (apis) {
      const { fs, path } = apis
      const baseDir =
        typeof path.appDataDir === 'function'
          ? await path.appDataDir()
          : typeof path.appDir === 'function'
          ? await path.appDir()
          : null

      if (baseDir) {
        const fullPath = `${baseDir}${fileName}`

        try {
          if (typeof fs.readTextFile === 'function') {
            const content = await fs.readTextFile(fullPath).catch(() => '')
            if (!content) return []
            const parsed = JSON.parse(content)
            return validateAndExtractCustomers(parsed, storeId)
          }

          if (typeof fs.readFile === 'function') {
            const content = await fs.readFile(fullPath).catch(() => '')
            if (!content) return []
            const parsed = JSON.parse(content)
            return validateAndExtractCustomers(parsed, storeId)
          }
        } catch (e) {
          console.warn('customerCache: FS read failed, trying localStorage', e)
        }
      }
    }
  } catch (e) {
    console.warn('customerCache: Tauri error', e)
  }

  // Fallback to localStorage
  try {
    const raw = window.localStorage.getItem(fileName)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    return validateAndExtractCustomers(parsed, storeId)
  } catch (e) {
    console.warn('customerCache: localStorage read failed', e)
    return []
  }
}

/** Validate cache structure and extract customers */
function validateAndExtractCustomers(data: any, storeId: string): CustomerRow[] {
  if (!data || typeof data !== 'object') return []
  
  // Check if it's the new format with metadata
  if (data.metadata && data.customers && Array.isArray(data.customers)) {
    const meta = data.metadata as CacheMetadata
    if (meta.version === CACHE_VERSION && meta.storeId === storeId) {
      return data.customers as CustomerRow[]
    }
  }
  
  // Old format or invalid - return empty
  console.warn('customerCache: Invalid cache format, clearing cache')
  return []
}

/** Save customers with metadata */
export async function saveCachedCustomers(storeId: string, customers: CustomerRow[]): Promise<void> {
  const fileName = cacheFileNameFor(storeId)
  
  const cacheData = {
    metadata: {
      version: CACHE_VERSION,
      lastUpdated: new Date().toISOString(),
      storeId: storeId,
    } as CacheMetadata,
    customers: customers || [],
  }
  
  const json = JSON.stringify(cacheData, null, 2)

  // Try Tauri FS
  try {
    const apis = await tryTauriApis()
    if (apis) {
      const { fs, path } = apis
      const baseDir =
        typeof path.appDataDir === 'function'
          ? await path.appDataDir()
          : typeof path.appDir === 'function'
          ? await path.appDir()
          : null

      if (baseDir) {
        const fullPath = `${baseDir}${fileName}`

        try {
          if (typeof fs.writeTextFile === 'function') {
            await fs.writeTextFile(fullPath, json).catch((err: any) => {
              console.warn('customerCache: writeTextFile failed', err)
            })
            return
          }

          if (typeof fs.writeFile === 'function') {
            await fs.writeFile({ path: fullPath, contents: json }).catch((err: any) => {
              console.warn('customerCache: writeFile failed', err)
            })
            return
          }
        } catch (e) {
          console.warn('customerCache: FS write failed, using localStorage', e)
        }
      }
    }
  } catch (e) {
    console.warn('customerCache: Tauri error on save', e)
  }

  // Fallback: localStorage
  try {
    window.localStorage.setItem(fileName, json)
  } catch (e) {
    console.warn('customerCache: localStorage write failed', e)
  }
}

/** Clear customer cache */
export async function clearCustomerCache(storeId: string): Promise<void> {
  const fileName = cacheFileNameFor(storeId)

  try {
    const apis = await tryTauriApis()
    if (apis) {
      const { fs, path } = apis
      const baseDir =
        typeof path.appDataDir === 'function'
          ? await path.appDataDir()
          : typeof path.appDir === 'function'
          ? await path.appDir()
          : null

      if (baseDir) {
        const fullPath = `${baseDir}${fileName}`
        try {
          if (typeof fs.removeFile === 'function') {
            await fs.removeFile(fullPath).catch(() => {})
          } else if (typeof fs.remove === 'function') {
            await fs.remove(fullPath).catch(() => {})
          }
        } catch (e) {
          // ignore
        }
      }
    }
  } catch (e) {
    // ignore
  }

  try {
    window.localStorage.removeItem(fileName)
  } catch (e) {
    // ignore
  }
}

/** Search customers by name or phone (case-insensitive) */
export async function searchCustomers(
  query: string,
  storeId: string,
  limit: number = 10
): Promise<CustomerRow[]> {
  try {
    const customers = await loadCachedCustomers(storeId)
    const lowerQuery = query.toLowerCase()

    const filtered = customers.filter(
      (c) =>
        c.is_active &&
        (c.customer_name.toLowerCase().includes(lowerQuery) ||
          (c.phone && c.phone.includes(query)))
    )

    return filtered.slice(0, limit)
  } catch (e) {
    console.warn('customerCache: search error', e)
    return []
  }
}

/** Get customer by phone */
export async function getByPhone(phone: string, storeId: string): Promise<CustomerRow | null> {
  try {
    const customers = await loadCachedCustomers(storeId)
    const found = customers.find((c) => c.phone === phone && c.is_active)
    return found || null
  } catch (e) {
    console.warn('customerCache: getByPhone error', e)
    return null
  }
}

/** Upsert customers into cache */
export async function upsertCustomers(customers: CustomerRow[], storeId: string): Promise<void> {
  if (!customers || customers.length === 0) return

  try {
    const existing = await loadCachedCustomers(storeId)
    const merged = [...existing]

    for (const customer of customers) {
      const idx = merged.findIndex((c) => c.id === customer.id)
      if (idx >= 0) {
        merged[idx] = { ...merged[idx], ...customer }
      } else {
        merged.push(customer)
      }
    }

    await saveCachedCustomers(storeId, merged)
    console.log(`✅ [customerCache] Cached ${merged.length} customers for store ${storeId}`)
  } catch (e) {
    console.warn('customerCache: upsertCustomers error', e)
  }
}
