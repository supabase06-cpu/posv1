// src/components/Billing/PaymentHandler.ts
import { createSale, updateInventory } from '@/services/supabase'
import { queueSale } from '@/services/syncService'
import { getOrCreateCustomer, createSalesIntake } from '@/services/customer'
import * as productCache from '@/services/productCache'
import * as customerCache from '@/services/customerCache'
import type { CustomerData } from './CustomerIntakeModal'

interface PaymentHandlerParams {
  user: any
  cart: any
  paymentMethod: string
  additionalDiscount: number
  counterId: string
  customerData: CustomerData
  isOnline: () => boolean
  onSuccess: (saleNumber: string) => void
  onError: (error: string) => void
}

export const processPaymentHandler = async ({
  user,
  cart,
  paymentMethod,
  additionalDiscount,
  counterId,
  customerData,
  isOnline,
  onSuccess,
  onError,
}: PaymentHandlerParams) => {
  try {
    const saleId = `SALE-${Date.now()}`
    const saleNumber = `SN-${Date.now().toString().slice(-8)}`
    const online = isOnline() // Check once at the start

    const saleData = {
      id: saleId,
      sale_number: saleNumber,
      store_id: user.store_id,
      counter_id: counterId,
      cashier_id: user.id,
      cashier_name: `${user.first_name || ''} ${user.last_name || ''}`.trim() || user.email,
      items: cart.items.map((item: any) => ({
        id: item.id,
        sku: item.sku,
        name: item.name,
        mrp: item.mrp,
        selling_price: item.selling_price,
        wholesale_price: item.wholesale_price,
        price_type: item.priceType, // Track which price was used
        effective_price: item.effectivePrice, // Actual price charged
        quantity: item.quantity,
        gst_rate: item.gst_rate || 18, // Track GST rate used
        gst_amount: item.itemTax, // Track GST amount
        hsn_code: item.hsn_code, // HSN code for compliance
        total: item.effectivePrice + item.itemTax, // Total including GST
      })),
      subtotal: cart.subtotal,
      discount: additionalDiscount,
      tax: cart.tax,
      total: cart.total,
      payment_method: paymentMethod,
      payment_status: 'completed' as const,
      sale_date: new Date().toISOString().split('T')[0],
      notes: null,
      // ✅ FIXED: Mark as synced if created online, unsynced if queued offline
      synced: online ? true : false,
      last_synced_at: online ? new Date().toISOString() : null,
    }

    // Handle customer data
    let customerId: number | null = null
    if (!customerData.skipped && customerData.name) {
      try {
        const customer = await getOrCreateCustomer(
          customerData.name,
          customerData.phone || null,
          customerData.email || null,
          user.store_id
        )
        customerId = customer?.id || null
        
        // Update customer cache with new/updated customer
        if (customer) {
          await customerCache.upsertCustomers([customer], user.store_id)
          console.log('✅ Customer cache updated:', customer.customer_name)
        }
      } catch (err) {
        console.warn('Failed to create/update customer:', err)
      }
    }

    // Offline handling
    if (!online) {
      console.log('📴 [PaymentHandler] Offline mode - queueing sale')
      await queueSale(saleData)
      await createSalesIntakeRecord(saleId, saleNumber, customerId, customerData, user, counterId, paymentMethod, cart.total)
      await updateLocalInventory(cart.items, user.store_id)
      onSuccess(saleNumber)
      return
    }

    // Online handling
    console.log('🌐 [PaymentHandler] Online mode - creating sale directly')
    const sale = await createSale(saleData)

    if (sale) {
      console.log('✅ [PaymentHandler] Sale created successfully:', sale.sale_number)
      await createSalesIntakeRecord(saleId, saleNumber, customerId, customerData, user, counterId, paymentMethod, cart.total)
      await updateRemoteAndLocalInventory(cart.items, user.store_id)
      onSuccess(saleNumber)
    } else {
      console.warn('⚠️ [PaymentHandler] Sale creation failed - queueing for retry')
      // If online creation fails, queue it with synced: false
      saleData.synced = false
      saleData.last_synced_at = null
      await queueSale(saleData)
      onSuccess(saleNumber)
    }
  } catch (err: any) {
    console.error('❌ [PaymentHandler] Payment processing error:', err)
    onError('Payment processing error — sale queued')
  }
}

async function createSalesIntakeRecord(
  saleId: string,
  saleNumber: string,
  customerId: number | null,
  customerData: CustomerData,
  user: any,
  counterId: string,
  paymentMethod: string,
  total: number
) {
  try {
    await createSalesIntake({
      sale_id: saleId,
      sale_number: saleNumber,
      customer_id: customerId,
      customer_name: customerData.name || null,
      customer_phone: customerData.phone || null,
      customer_email: customerData.email || null,
      customer_skipped: customerData.skipped,
      store_id: user.store_id,
      counter_id: counterId,
      cashier_id: user.id,
      cashier_name: `${user.first_name || ''} ${user.last_name || ''}`.trim() || user.email,
      sale_amount: total,
      payment_method: paymentMethod,
      sale_date: new Date().toISOString().split('T')[0],
    })
  } catch (err) {
    console.warn('⚠️ Failed to create sales intake:', err)
  }
}

async function updateLocalInventory(items: any[], storeId: string) {
  for (const item of items) {
    try {
      const cached = await productCache.getById(item.id, storeId)
      if (cached) {
        cached.stock = Math.max(0, (cached.stock || 0) - item.quantity)
        await productCache.upsertProducts([cached], storeId)
      }
    } catch (e) {
      // ignore
    }
  }
}

async function updateRemoteAndLocalInventory(items: any[], storeId: string) {
  for (const item of items) {
    const newStock = (item as any).stock - item.quantity
    await updateInventory((item as any).id, newStock, storeId).catch(() => {})
    
    try {
      const cached = await productCache.getById(item.id, storeId)
      if (cached) {
        cached.stock = newStock
        await productCache.upsertProducts([cached], storeId)
      }
    } catch (e) {
      // ignore
    }
  }
}
