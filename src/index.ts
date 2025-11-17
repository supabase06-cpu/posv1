import type { Database } from './types/database'

// ✅ EXPORT Database so other files can import it
export type { Database }

export type AuthUser = Database['public']['Tables']['auth_users']['Row']
export type Product = Database['public']['Tables']['products']['Row']
export type ProductInsert = Database['public']['Tables']['products']['Insert']
export type ProductUpdate = Database['public']['Tables']['products']['Update']

export type Sale = Database['public']['Tables']['sales']['Row']
export type SaleInsert = Database['public']['Tables']['sales']['Insert']
export type SaleUpdate = Database['public']['Tables']['sales']['Update']

export type GRN = Database['public']['Tables']['grns']['Row']
export type Supplier = Database['public']['Tables']['suppliers']['Row']
export type Inventory = Database['public']['Tables']['inventory']['Row']
export type SyncLog = Database['public']['Tables']['sync_logs']['Row']
export type StoreConfig = Database['public']['Tables']['store_config']['Row']
export type StockAdjustment = Database['public']['Tables']['stock_adjustments']['Row']
export type ProductExpiry = Database['public']['Tables']['product_expiry']['Row']
export type DailyReport = Database['public']['Tables']['daily_reports']['Row']
