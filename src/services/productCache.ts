// src/services/productCache.ts

import type { Database } from '@/types/database'

const CACHE_PREFIX = 'pos_product_cache_v1_' // bump to invalidate old caches

type ProductRow = Database['public']['Tables']['products']['Row']

/** Try to dynamically load Tauri FS & path APIs. Returns null if not available. */
async function tryTauriApis(): Promise<{ fs?: any; path?: any } | null> {
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
    console.warn('tryTauriApis error', err)
  }
  return null
}

/** Compose a cache filename for a given store */
function cacheFileNameFor(storeId: string) {
  return `${CACHE_PREFIX}${storeId}.json`
}

/** Load cached products (tries FS first, falls back to localStorage). Returns array or [] */
export async function loadCachedProducts(storeId: string): Promise<ProductRow[]> {
  const fileName = cacheFileNameFor(storeId)

  // Try Tauri runtime FS/path
  try {
    const apis = await tryTauriApis()
    if (apis) {
      const { fs, path } = apis
      // Prefer appDataDir; fallback to appDir if not present
      const baseDir =
        typeof path.appDataDir === 'function'
          ? await path.appDataDir()
          : typeof path.appDir === 'function'
          ? await path.appDir()
          : null

      if (baseDir) {
        const fullPath = `${baseDir}${fileName}`

        try {
          // prefer readTextFile (common API)
          if (typeof fs.readTextFile === 'function') {
            const content = await fs.readTextFile(fullPath).catch(() => '')
            if (!content) return []
            return JSON.parse(content) as ProductRow[]
          }

          // fallback: file with { path } signature
          if (typeof fs.readFile === 'function') {
            const content = await fs.readFile(fullPath).catch(() => '')
            if (!content) return []
            return JSON.parse(content) as ProductRow[]
          }
        } catch (e) {
          // eslint-disable-next-line no-console
          console.warn('productCache: fs read failed, falling back to localStorage', e)
        }
      }
    }
  } catch (e) {
    // eslint-disable-next-line no-console
    console.warn('productCache: tryTauriApis error', e)
  }

  // Fallback to localStorage (dev)
  try {
    const raw = window.localStorage.getItem(fileName)
    if (!raw) return []
    return JSON.parse(raw) as ProductRow[]
  } catch (e) {
    // eslint-disable-next-line no-console
    console.warn('productCache: localStorage read failed', e)
    return []
  }
}

/** Save cached products (tries FS first, otherwise localStorage) */
export async function saveCachedProducts(storeId: string, products: ProductRow[]): Promise<void> {
  const fileName = cacheFileNameFor(storeId)
  const json = JSON.stringify(products || [], null, 2)

  // Try Tauri runtime FS/path
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
              // eslint-disable-next-line no-console
              console.warn('productCache: writeTextFile failed', err)
            })
            return
          }

          if (typeof fs.writeFile === 'function') {
            await fs.writeFile({ path: fullPath, contents: json }).catch((err: any) => {
              // eslint-disable-next-line no-console
              console.warn('productCache: writeFile failed', err)
            })
            return
          }
        } catch (e) {
          // eslint-disable-next-line no-console
          console.warn('productCache: fs write failed, falling back to localStorage', e)
        }
      }
    }
  } catch (e) {
    // eslint-disable-next-line no-console
    console.warn('productCache: tryTauriApis error on save', e)
  }

  // Fallback: localStorage
  try {
    window.localStorage.setItem(fileName, json)
  } catch (e) {
    // eslint-disable-next-line no-console
    console.warn('productCache: localStorage write failed', e)
  }
}

/** Clear cache for a store (fs + localStorage) */
export async function clearProductCache(storeId: string): Promise<void> {
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

// ===== FUNCTIONS FOR OFFLINE BILLING =====

/** Get a product by ID from cache (with store context) */
export async function getById(productId: string | number, storeId = 'default'): Promise<ProductRow | null> {
  const id = String(productId)
  try {
    const products = await loadCachedProducts(storeId)
    const found = products.find((p: any) => p.id === id)
    return found || null
  } catch (e) {
    console.warn('productCache: getById error', e)
    return null
  }
}

/** Get a product by barcode from cache (searches all stores) */
export async function getByBarcode(barcode: string, storeId = 'default'): Promise<ProductRow | null> {
  try {
    // Try specific store first
    const products = await loadCachedProducts(storeId)
    let found = products.find((p: any) => p.barcode === barcode || p.sku === barcode)
    if (found) return found

    // If not found, try all localStorage keys as fallback
    const allKeys = Object.keys(window.localStorage)
    for (const key of allKeys) {
      if (key.startsWith(CACHE_PREFIX)) {
        try {
          const raw = window.localStorage.getItem(key)
          if (raw) {
            const allProducts = JSON.parse(raw) as ProductRow[]
            found = allProducts.find((p: any) => p.barcode === barcode || p.sku === barcode)
            if (found) return found
          }
        } catch {
          // ignore individual parse errors
        }
      }
    }
    return null
  } catch (e) {
    console.warn('productCache: getByBarcode error', e)
    return null
  }
}

/** Get a product by SKU from cache */
export async function getBySKU(sku: string, storeId = 'default'): Promise<ProductRow | null> {
  try {
    const products = await loadCachedProducts(storeId)
    const found = products.find((p: any) => p.sku === sku)
    return found || null
  } catch (e) {
    console.warn('productCache: getBySKU error', e)
    return null
  }
}

/** 
 * Search products by name or barcode (partial match)
 * NEW: For autocomplete search
 */
export async function searchProductsByNameOrBarcode(
  query: string,
  storeId = 'default',
  limit: number = 10
): Promise<ProductRow[]> {
  try {
    const products = await loadCachedProducts(storeId)
    const lowerQuery = query.toLowerCase()

    const filtered = products.filter((p: any) => {
      return (
        p.is_active &&
        (p.name.toLowerCase().includes(lowerQuery) ||
         (p.barcode && p.barcode.toLowerCase().includes(lowerQuery)))
      )
    })

    // Sort by relevance (exact name match first, then starts with, then contains)
    filtered.sort((a: any, b: any) => {
      const aName = a.name.toLowerCase()
      const bName = b.name.toLowerCase()
      
      if (aName === lowerQuery) return -1
      if (bName === lowerQuery) return 1
      
      if (aName.startsWith(lowerQuery) && !bName.startsWith(lowerQuery)) return -1
      if (bName.startsWith(lowerQuery) && !aName.startsWith(lowerQuery)) return 1
      
      return aName.localeCompare(bName)
    })

    return filtered.slice(0, limit)
  } catch (e) {
    console.warn('productCache: searchProductsByNameOrBarcode error', e)
    return []
  }
}

/** Upsert products into cache (insert or update) with store context */
export async function upsertProducts(products: ProductRow[], storeId = 'default'): Promise<void> {
  if (!products || products.length === 0) return

  try {
    // Load existing
    const existing = await loadCachedProducts(storeId)
    
    // Merge: update existing by ID, add new ones
    const merged = [...existing]
    
    for (const product of products) {
      const idx = merged.findIndex((p: any) => p.id === product.id)
      if (idx >= 0) {
        merged[idx] = { ...merged[idx], ...product }
      } else {
        merged.push(product)
      }
    }
    
    // Save back
    await saveCachedProducts(storeId, merged)
    console.log(`✅ [productCache] Cached ${merged.length} products for store ${storeId}`)
  } catch (e) {
    console.warn('productCache: upsertProducts error', e)
  }
}
