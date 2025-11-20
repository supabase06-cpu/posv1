// src/services/customer.ts
import { supabase } from './supabase'
import * as customerCache from './customerCache'
import type { Database } from '@/types/database'

type Customer = Database['public']['Tables']['customers']['Row']
type CustomerInsert = Database['public']['Tables']['customers']['Insert']
type SalesIntakeInsert = Database['public']['Tables']['sales_intake']['Insert']

/** Check if online */
function isOnline(): boolean {
  return typeof navigator !== 'undefined' ? navigator.onLine : true
}

/**
 * Search for customer by phone number (offline-first)
 */
export const findCustomerByPhone = async (
  phone: string,
  storeId: string
): Promise<Customer | null> => {
  try {
    // Try cache first (works offline)
    const cachedCustomer = await customerCache.getByPhone(phone, storeId)
    if (cachedCustomer) {
      console.log('✅ Found customer from cache:', cachedCustomer.customer_name)
      return cachedCustomer
    }

    // If online, try Supabase
    if (isOnline()) {
      const { data, error } = await supabase
        .from('customers')
        .select('*')
        .eq('phone', phone)
        .eq('store_id', storeId)
        .eq('is_active', true)
        .maybeSingle()

      if (error) {
        console.error('Error finding customer online:', error)
        return null
      }

      // Update cache with online result
      if (data) {
        await customerCache.upsertCustomers([data as Customer], storeId)
      }

      return data as Customer | null
    }

    // Offline and not in cache
    console.log('📴 Offline: Customer not in cache')
    return null
  } catch (err) {
    console.error('Exception finding customer:', err)
    return null
  }
}

/**
 * Create new customer (offline-first with queueing)
 */
export const createCustomer = async (
  customerData: CustomerInsert
): Promise<Customer | null> => {
  try {
    // If offline, create temporary customer with negative ID
    if (!isOnline()) {
      const tempCustomer: Customer = {
        id: -Date.now(), // Temporary negative ID
        customer_name: customerData.customer_name,
        phone: customerData.phone || null,
        email: customerData.email || null,
        store_id: customerData.store_id,
        total_purchases: 0,
        total_spent: 0,
        last_purchase_date: null,
        is_active: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }

      // Save to cache for offline use
      await customerCache.upsertCustomers([tempCustomer], customerData.store_id)
      console.log('📴 Offline: Created temporary customer in cache:', tempCustomer.customer_name)
      return tempCustomer
    }

    // Online: create in Supabase
    const { data, error } = await (supabase
      .from('customers') as any)
      .insert([customerData])
      .select()

    if (error) {
      console.error('Error creating customer:', error)
      return null
    }

    const newCustomer = (data?.[0] as Customer) || null

    // Update cache
    if (newCustomer) {
      await customerCache.upsertCustomers([newCustomer], customerData.store_id)
    }

    return newCustomer
  } catch (err) {
    console.error('Exception creating customer:', err)
    return null
  }
}

/**
 * Update customer details (online only, skip if offline)
 */
export const updateCustomer = async (
  customerId: number,
  updates: Partial<CustomerInsert>
): Promise<Customer | null> => {
  try {
    if (!isOnline()) {
      console.log('📴 Offline: Skipping customer update (will sync later)')
      return null
    }

    const { data, error } = await (supabase
      .from('customers') as any)
      .update(updates)
      .eq('id', customerId)
      .select()

    if (error) {
      console.error('Error updating customer:', error)
      return null
    }

    const updatedCustomer = (data?.[0] as Customer) || null

    // Update cache
    if (updatedCustomer) {
      await customerCache.upsertCustomers([updatedCustomer], updatedCustomer.store_id)
    }

    return updatedCustomer
  } catch (err) {
    console.error('Exception updating customer:', err)
    return null
  }
}

/**
 * Create sales intake record (skip if offline, will be queued)
 */
export const createSalesIntake = async (
  intakeData: SalesIntakeInsert
): Promise<boolean> => {
  try {
    if (!isOnline()) {
      console.log('📴 Offline: Skipping sales_intake creation (will sync with sale queue)')
      return true // Return true to not break flow
    }

    const { error } = await (supabase
      .from('sales_intake') as any)
      .insert([intakeData])

    if (error) {
      console.error('Error creating sales intake:', error)
      return false
    }

    return true
  } catch (err) {
    console.error('Exception creating sales intake:', err)
    return false
  }
}

/**
 * Get or create customer by phone (offline-first)
 */
export const getOrCreateCustomer = async (
  name: string,
  phone: string | null,
  email: string | null,
  storeId: string
): Promise<Customer | null> => {
  try {
    // If phone provided, try to find existing
    if (phone) {
      const existing = await findCustomerByPhone(phone, storeId)
      if (existing) {
        // Update name/email if provided and different (only if online)
        if (isOnline() && (name !== existing.customer_name || (email && email !== existing.email))) {
          return await updateCustomer(existing.id, {
            customer_name: name,
            email: email || existing.email,
          })
        }
        return existing
      }
    }

    // Create new customer (works offline with temp ID)
    return await createCustomer({
      customer_name: name,
      phone,
      email,
      store_id: storeId,
    })
  } catch (err) {
    console.error('Error in getOrCreateCustomer:', err)
    return null
  }
}
