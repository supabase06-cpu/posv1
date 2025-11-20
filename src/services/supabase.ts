import { createClient } from '@supabase/supabase-js'
import type { Database } from '../types/database'

export const STORE_CONFIG = {
  STORE_ID: import.meta.env.VITE_STORE_ID || 'store-001',
  STORE_NAME: import.meta.env.VITE_STORE_NAME || 'My Supermarket',
  STORE_ADDRESS: import.meta.env.VITE_STORE_ADDRESS || 'Bangalore, India',
  STORE_PHONE: import.meta.env.VITE_STORE_PHONE || '+91-XXXXXXXXXX',
  STORE_EMAIL: import.meta.env.VITE_STORE_EMAIL || 'info@store.com',
  TAX_RATE: import.meta.env.VITE_TAX_RATE || '18',
}

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY

export const supabase = createClient<Database>(SUPABASE_URL, SUPABASE_ANON_KEY)

/**
 * Get products for a store
 */
export const getProducts = async (storeId: string = STORE_CONFIG.STORE_ID) => {
  const { data, error } = await supabase
    .from('products')
    .select('*')
    .eq('store_id', storeId)
    .eq('is_active', true)

  if (error) {
    console.error('Error fetching products:', error)
    return []
  }
  return (data as Database['public']['Tables']['products']['Row'][] | null) || []
}

/**
 * Find a single product by barcode (tries exact match then fallback)
 */
export const getProductByBarcode = async (
  barcode: string,
  storeId: string = STORE_CONFIG.STORE_ID
) => {
  console.group('🔍 [GETPRODUCTBYBARCODE]')
  console.log('Input barcode:', barcode)
  console.log('Barcode length:', barcode.length)
  console.log('Barcode (trimmed):', barcode.trim())
  console.log('Store ID:', storeId)

  const trimmedBarcode = barcode.trim()

  console.log('📡 Executing Supabase query with .eq() (exact match)...')
  console.log('  Query: .eq("barcode", "' + trimmedBarcode + '")')
  console.log('  Filter: .eq("store_id", "' + storeId + '")')

  const { data, error } = await supabase
    .from('products')
    .select('*')
    .eq('barcode', trimmedBarcode)
    .eq('store_id', storeId)
    .maybeSingle()

  console.log('✅ Response received')
  console.log('  Data:', data)
  console.log('  Error:', error)

  if (error) {
    console.error('❌ Supabase Error:', error)
    console.groupEnd()
    return null
  }

  const product = data as Database['public']['Tables']['products']['Row'] | null

  if (product) {
    console.log('✅ SUCCESS - Product found:')
    console.log('  ID:', product.id)
    console.log('  Name:', product.name)
    console.log('  SKU:', product.sku)
    console.log('  Barcode:', product.barcode)
    console.log('  Stock:', product.stock)
    console.log('  Store ID:', product.store_id)
    console.groupEnd()
    return product
  }

  console.warn('⚠️  NO DATA - Product not found with exact match')
  console.warn('  Trying alternate search methods...')

  const { data: allProductsRaw, error: allError } = await supabase
    .from('products')
    .select('*')
    .eq('store_id', storeId)

  if (allError) {
    console.error('❌ Error fetching all products:', allError)
    console.groupEnd()
    return null
  }

  const allProducts = allProductsRaw as Database['public']['Tables']['products']['Row'][] | null

  if (allProducts) {
    console.log('📦 Total products in store:', allProducts.length)
    console.log('📦 All products:', allProducts.map((p) => ({ id: p.id, barcode: p.barcode, name: p.name })))

    const found = allProducts.find((p) => p.barcode === trimmedBarcode)
    if (found) {
      console.log('✅ Found via alternate method:', found.name)
      console.groupEnd()
      return found
    }

    console.warn('⚠️  Not found in alternate search either')
  }

  console.groupEnd()
  return null
}

/**
 * Get store configuration — with debug and auth checks
 */
export const getStoreConfig = async (storeId: string = STORE_CONFIG.STORE_ID) => {
  console.group('📍 [GETSTORE CONFIG DEBUG]')
  console.log('🔍 Fetching store config for:', storeId)

  const { data: getUserData, error: authError } = await supabase.auth.getUser()
  const user = getUserData?.user ?? null
  console.log('🔐 Current auth user:', user?.id, user?.email)
  console.log('🔐 Auth error:', authError)

  if (!user) {
    console.error('❌ No authenticated user found!')
    console.groupEnd()
    return null
  }

  const { data: authUserRaw, error: userError } = await supabase
    .from('auth_users')
    .select('*')
    .eq('id', user.id)
    .maybeSingle()

  const authUser = authUserRaw as Database['public']['Tables']['auth_users']['Row'] | null

  console.log('👤 Auth user from table:', authUser)
  console.log('👤 User lookup error:', userError)

  if (!authUser) {
    console.error('❌ User not found in auth_users table!')
    console.groupEnd()
    return null
  }

  console.log('✅ User found - Store ID:', authUser.store_id, 'Role:', authUser.role)

  const { data: storeConfigRaw, error } = await supabase
    .from('store_config')
    .select('*')
    .eq('store_id', storeId)
    .maybeSingle()

  const storeConfig = storeConfigRaw as Database['public']['Tables']['store_config']['Row'] | null

  console.log('📡 Direct query result:')
  console.log('  Data:', storeConfig)
  console.log('  Error:', error)

  if (error) {
    console.error('❌ Store config query error:', error)
    try {
      const { count } = await supabase
        .from('store_config')
        .select('*', { count: 'exact', head: true })
        .eq('store_id', storeId)
      console.log('📊 Store config count for', storeId, ':', count)
    } catch (err) {
      console.warn('⚠️ Could not get count for store_config (debug):', err)
    }
    console.groupEnd()
    return null
  }

  if (storeConfig) {
    console.log('✅ Store config found:', storeConfig.store_name)
    console.log('✅ Config store_id matches user store_id:', storeConfig.store_id === authUser.store_id)
    console.groupEnd()
    return storeConfig
  }

  console.warn('⚠️  No store config data returned (RLS may be blocking)')
  console.log('🔍 Manual RLS check:')
  console.log('  Query store_id:', storeId)
  console.log('  User store_id:', authUser.store_id)
  console.log('  IDs match:', storeId === authUser.store_id)

  if (storeId !== authUser.store_id) {
    console.error('❌ Store ID mismatch! Using user store_id instead...')
    const { data: retryDataRaw, error: retryError } = await supabase
      .from('store_config')
      .select('*')
      .eq('store_id', authUser.store_id)
      .maybeSingle()

    const retryData = retryDataRaw as Database['public']['Tables']['store_config']['Row'] | null
    console.log('🔄 Retry with user store_id result:', retryData, retryError)

    if (retryData) {
      console.log('✅ Found config with user store_id!')
      console.groupEnd()
      return retryData
    }
  }

  console.groupEnd()
  return null
}

/**
 * Create a sale
 */
export const createSale = async (sale: Database['public']['Tables']['sales']['Insert']) => {
  const saleData: Database['public']['Tables']['sales']['Insert'] = {
    ...sale,
    store_id: sale.store_id || STORE_CONFIG.STORE_ID,
  }

  const { data, error } = await (supabase.from('sales') as any)
    .insert(saleData)
    .select()

  if (error) {
    console.error('Error creating sale:', error)
    return null
  }

  return (data as Database['public']['Tables']['sales']['Row'][] | null)?.[0] || null
}


/**
 * Update inventory (by product_id)
 */
export const updateInventory = async (
  productId: number,
  newStock: number,
  storeId: string = STORE_CONFIG.STORE_ID
) => {
  const { data, error } = await (supabase.from('inventory') as any)
    .update({ current_stock: newStock })
    .eq('product_id', productId)
    .eq('store_id', storeId)
    .select()

  if (error) {
    console.error('Error updating inventory:', error)
    return null
  }

  return (data as Database['public']['Tables']['inventory']['Row'][] | null)?.[0] || null
}

/**
 * Get sales by date
 */
export const getSalesByDate = async (
  date: string,
  storeId: string = STORE_CONFIG.STORE_ID
) => {
  const { data, error } = await supabase
    .from('sales')
    .select('*')
    .eq('store_id', storeId)
    .eq('sale_date', date)
    .order('created_at', { ascending: false })

  if (error) {
    console.error('Error fetching sales:', error)
    return []
  }

  return (data as Database['public']['Tables']['sales']['Row'][] | null) || []
}

/**
 * Get inventory for a store
 */
export const getInventory = async (storeId: string = STORE_CONFIG.STORE_ID) => {
  const { data, error } = await supabase
    .from('inventory')
    .select('*')
    .eq('store_id', storeId)

  if (error) {
    console.error('Error fetching inventory:', error)
    return []
  }

  return (data as Database['public']['Tables']['inventory']['Row'][] | null) || []
}

/**
 * Load all products for a store and cache them locally for offline billing
 * Call this after user login to enable offline mode
 */
export const loadAllProductsForCache = async (storeId: string = STORE_CONFIG.STORE_ID): Promise<void> => {
  try {
    console.log('📥 [supabase] Loading products for cache... Store ID:', storeId)
    
    const { data, error } = await supabase
      .from('products')
      .select('*')
      .eq('store_id', storeId)
      .eq('is_active', true)

    if (error) {
      console.error('❌ [supabase] Error loading products:', error)
      throw error
    }

    if (data && data.length > 0) {
      const productCache = await import('./productCache')
      await productCache.upsertProducts(data, storeId)
      console.log(`✅ [supabase] Successfully cached ${data.length} products for offline use`)
    } else {
      console.warn('⚠️ [supabase] No active products found for store:', storeId)
    }
  } catch (err) {
    console.error('❌ [supabase] Error in loadAllProductsForCache:', err)
    throw err
  }
}

/**
 * Load all customers for a store and cache them locally for offline search
 * Call this after user login to enable offline mode
 */
export const loadAllCustomersForCache = async (storeId: string = STORE_CONFIG.STORE_ID): Promise<void> => {
  try {
    console.log('📥 [supabase] Loading customers for cache... Store ID:', storeId)
    
    const { data, error } = await supabase
      .from('customers')
      .select('*')
      .eq('store_id', storeId)
      .eq('is_active', true)

    if (error) {
      console.error('❌ [supabase] Error loading customers:', error)
      throw error
    }

    if (data && data.length > 0) {
      const customerCache = await import('./customerCache')
      await customerCache.upsertCustomers(data, storeId)
      console.log(`✅ [supabase] Successfully cached ${data.length} customers for offline use`)
    } else {
      console.warn('⚠️ [supabase] No active customers found for store:', storeId)
    }
  } catch (err) {
    console.error('❌ [supabase] Error in loadAllCustomersForCache:', err)
    throw err
  }
}

/**
 * Get today's sales total for a store
 */
export const getTodaysSales = async (storeId: string = STORE_CONFIG.STORE_ID): Promise<number> => {
  try {
    const today = new Date().toISOString().split('T')[0] // YYYY-MM-DD
    
    const { data, error } = await (supabase
      .from('sales')
      .select('total')
      .eq('store_id', storeId)
      .eq('sale_date', today) as any)

    if (error) {
      console.error('❌ [getTodaysSales] Error:', error)
      return 0
    }

    const total = (data as Array<{ total: number | string | null }>)?.reduce(
      (sum, sale) => sum + Number(sale.total || 0), 
      0
    ) || 0
    
    return total
  } catch (err) {
    console.error('❌ [getTodaysSales] Exception:', err)
    return 0
  }
}

/**
 * Get sales total for a date range (used for homepage date filter)
 */
export const getSalesByDateRange = async (
  storeId: string = STORE_CONFIG.STORE_ID,
  fromDate: string,
  toDate: string
): Promise<number> => {
  try {
    console.log(`📊 [getSalesByDateRange] Fetching sales from ${fromDate} to ${toDate}`)
    
    const { data, error } = await (supabase
      .from('sales')
      .select('total')
      .eq('store_id', storeId)
      .gte('sale_date', fromDate)
      .lte('sale_date', toDate) as any)

    if (error) {
      console.error('❌ [getSalesByDateRange] Error:', error)
      return 0
    }

    const total = (data as Array<{ total: number | string | null }>)?.reduce(
      (sum, sale) => sum + Number(sale.total || 0), 
      0
    ) || 0
    
    console.log(`✅ [getSalesByDateRange] Total: ₹${total.toFixed(2)}`)
    return total
  } catch (err) {
    console.error('❌ [getSalesByDateRange] Exception:', err)
    return 0
  }
}

/**
 * Get total active products count for a store
 */
export const getTotalProductsCount = async (storeId: string = STORE_CONFIG.STORE_ID): Promise<number> => {
  try {
    const { count, error } = await supabase
      .from('products')
      .select('*', { count: 'exact', head: true })
      .eq('store_id', storeId)
      .eq('is_active', true)

    if (error) {
      console.error('❌ [getTotalProductsCount] Error:', error)
      return 0
    }

    return count || 0
  } catch (err) {
    console.error('❌ [getTotalProductsCount] Exception:', err)
    return 0
  }
}



/**
 * Get pending sync count (unsynced sales)
 */
export const getPendingSyncCount = async (storeId: string = STORE_CONFIG.STORE_ID): Promise<number> => {
  try {
    const { count, error } = await supabase
      .from('sales')
      .select('*', { count: 'exact', head: true })
      .eq('store_id', storeId)
      .eq('synced', false)

    if (error) {
      console.error('❌ [getPendingSyncCount] Error:', error)
      return 0
    }

    return count || 0
  } catch (err) {
    console.error('❌ [getPendingSyncCount] Exception:', err)
    return 0
  }
}

/**
 * Mark a sale as synced in the database
 */
export const markSaleSynced = async (saleId: string): Promise<boolean> => {
  try {
    const updateData = {
      synced: true,
      last_synced_at: new Date().toISOString(),
    }

    // Cast 'from' to 'any' to bypass strict typing preventing .update argument
    const { error } = await (supabase.from('sales') as any)
      .update(updateData)
      .eq('id', saleId)

    if (error) {
      console.error('❌ [markSaleSynced] Error:', error)
      return false
    }


    return true
  } catch (err) {
    console.error('❌ [markSaleSynced] Exception:', err)
    return false
  }
}
