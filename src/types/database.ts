export type Database = {
  public: {
    Tables: {
      auth_users: {
        Row: {
          id: string
          email: string
          store_id: string
          role: 'admin' | 'manager' | 'cashier' | 'inventory'
          first_name: string | null
          last_name: string | null
          is_active: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          email: string
          store_id: string
          role?: string
          first_name?: string | null
          last_name?: string | null
          is_active?: boolean
        }
        Update: {
          email?: string
          role?: string
          first_name?: string | null
          last_name?: string | null
          is_active?: boolean
        }
      }
      
      products: {
        Row: {
          id: number
          sku: string
          name: string
          description: string | null
          category: string | null
          mrp: number
          cost: number
          stock: number
          reorder_level: number
          unit: string | null
          barcode: string | null
          image_url: string | null
          is_active: boolean
          store_id: string
          created_at: string
          updated_at: string
          synced: boolean
          last_synced_at: string | null
        }
        Insert: {
          sku: string
          name: string
          description?: string | null
          category?: string | null
          mrp: number
          cost: number
          stock?: number
          reorder_level?: number
          unit?: string | null
          barcode?: string | null
          image_url?: string | null
          is_active?: boolean
          store_id: string
          synced?: boolean
        }
        Update: {
          sku?: string
          name?: string
          description?: string | null
          category?: string | null
          mrp?: number
          cost?: number
          stock?: number
          reorder_level?: number
          unit?: string | null
          barcode?: string | null
          image_url?: string | null
          is_active?: boolean
          synced?: boolean
        }
      }

      store_config: {
        Row: {
          id: number
          store_id: string
          store_name: string
          address: string | null
          city: string | null
          state: string | null
          pincode: string | null
          gstin: string | null
          phone: string | null
          email: string | null
          tax_rate: number
          sync_interval: number
          is_active: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          store_id: string
          store_name: string
          address?: string | null
          city?: string | null
          state?: string | null
          pincode?: string | null
          gstin?: string | null
          phone?: string | null
          email?: string | null
          tax_rate?: number
          sync_interval?: number
          is_active?: boolean
        }
        Update: {
          store_name?: string
          address?: string | null
          city?: string | null
          state?: string | null
          pincode?: string | null
          gstin?: string | null
          phone?: string | null
          email?: string | null
          tax_rate?: number
          sync_interval?: number
          is_active?: boolean
        }
      }

      sales: {
        Row: {
          id: string
          sale_number: string
          store_id: string
          counter_id: string | null
          cashier_name: string | null
          cashier_id: string | null
          items: any[]
          subtotal: number | null
          discount: number
          tax: number | null
          total: number
          payment_method: string | null
          payment_status: string
          notes: string | null
          sale_date: string | null
          created_at: string
          updated_at: string
          synced: boolean
          last_synced_at: string | null
        }
        Insert: {
          id?: string
          sale_number: string
          store_id: string
          counter_id?: string | null
          cashier_name?: string | null
          cashier_id?: string | null
          items: any[]
          subtotal?: number | null
          discount?: number
          tax?: number | null
          total: number
          payment_method?: string | null
          payment_status?: string
          notes?: string | null
          sale_date?: string | null
          synced?: boolean
        }
        Update: {
          payment_status?: string
          synced?: boolean
        }
      }

      inventory: {
        Row: {
          id: number
          store_id: string
          product_id: number
          sku: string
          current_stock: number
          reorder_level: number
          reorder_qty: number
          last_restock_date: string | null
          last_sale_date: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          store_id: string
          product_id: number
          sku: string
          current_stock?: number
          reorder_level?: number
          reorder_qty?: number
          last_restock_date?: string | null
          last_sale_date?: string | null
        }
        Update: {
          current_stock?: number
          reorder_level?: number
          reorder_qty?: number
          last_restock_date?: string | null
          last_sale_date?: string | null
        }
      }

      grns: {
        Row: {
          id: string
          grn_number: string
          store_id: string
          supplier_id: number | null
          received_by_id: string | null
          items: any[]
          total_amount: number
          status: string
          received_by: string | null
          received_date: string | null
          notes: string | null
          created_at: string
          updated_at: string
          synced: boolean
          last_synced_at: string | null
        }
        Insert: {
          id?: string
          grn_number: string
          store_id: string
          supplier_id?: number | null
          received_by_id?: string | null
          items: any[]
          total_amount: number
          status?: string
          received_by?: string | null
          received_date?: string | null
          notes?: string | null
          synced?: boolean
        }
        Update: {
          status?: string
          received_by?: string | null
          received_date?: string | null
          notes?: string | null
          synced?: boolean
        }
      }

      suppliers: {
        Row: {
          id: number
          store_id: string
          name: string
          email: string | null
          phone: string | null
          address: string | null
          city: string | null
          state: string | null
          pincode: string | null
          gstin: string | null
          payment_terms: string | null
          is_active: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          store_id: string
          name: string
          email?: string | null
          phone?: string | null
          address?: string | null
          city?: string | null
          state?: string | null
          pincode?: string | null
          gstin?: string | null
          payment_terms?: string | null
          is_active?: boolean
        }
        Update: {
          name?: string
          email?: string | null
          phone?: string | null
          address?: string | null
          city?: string | null
          state?: string | null
          pincode?: string | null
          gstin?: string | null
          payment_terms?: string | null
          is_active?: boolean
        }
      }

      sync_logs: {
        Row: {
          id: number
          store_id: string
          desktop_id: string
          user_id: string | null
          sync_type: string | null
          status: string | null
          records_count: number | null
          error_message: string | null
          timestamp: string | null
          created_at: string
        }
        Insert: {
          store_id: string
          desktop_id: string
          user_id?: string | null
          sync_type?: string | null
          status?: string | null
          records_count?: number | null
          error_message?: string | null
          timestamp?: string | null
        }
        Update: {
          sync_type?: string | null
          status?: string | null
          records_count?: number | null
          error_message?: string | null
        }
      }

      stock_adjustments: {
        Row: {
          id: number
          store_id: string
          product_id: number
          sku: string | null
          adjustment_type: string | null
          quantity: number
          reason: string | null
          adjusted_by_id: string | null
          adjusted_by: string | null
          created_at: string
        }
        Insert: {
          store_id: string
          product_id: number
          sku?: string | null
          adjustment_type?: string | null
          quantity: number
          reason?: string | null
          adjusted_by_id?: string | null
          adjusted_by?: string | null
        }
        Update: {
          adjustment_type?: string | null
          quantity?: number
          reason?: string | null
        }
      }

      product_expiry: {
        Row: {
          id: number
          store_id: string
          product_id: number
          sku: string | null
          batch_number: string | null
          expiry_date: string
          quantity: number | null
          grn_id: string | null
          created_at: string
        }
        Insert: {
          store_id: string
          product_id: number
          sku?: string | null
          batch_number?: string | null
          expiry_date: string
          quantity?: number | null
          grn_id?: string | null
        }
        Update: {
          sku?: string | null
          batch_number?: string | null
          expiry_date?: string
          quantity?: number | null
          grn_id?: string | null
        }
      }

      daily_reports: {
        Row: {
          id: number
          store_id: string
          report_date: string
          total_sales: number | null
          total_items_sold: number | null
          cash_sales: number | null
          card_sales: number | null
          upi_sales: number | null
          wallet_sales: number | null
          total_discount: number | null
          total_tax: number | null
          grn_received: number | null
          grn_amount: number | null
          created_at: string
        }
        Insert: {
          store_id: string
          report_date: string
          total_sales?: number | null
          total_items_sold?: number | null
          cash_sales?: number | null
          card_sales?: number | null
          upi_sales?: number | null
          wallet_sales?: number | null
          total_discount?: number | null
          total_tax?: number | null
          grn_received?: number | null
          grn_amount?: number | null
        }
        Update: {
          total_sales?: number | null
          total_items_sold?: number | null
          cash_sales?: number | null
          card_sales?: number | null
          upi_sales?: number | null
          wallet_sales?: number | null
          total_discount?: number | null
          total_tax?: number | null
          grn_received?: number | null
          grn_amount?: number | null
        }
      }
    }
    Views: Record<string, never>
    Functions: Record<string, never>
    Enums: Record<string, never>
  }
}
