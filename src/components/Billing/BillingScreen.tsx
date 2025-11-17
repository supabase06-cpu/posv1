import React, { useEffect, useRef, useState } from 'react'
import type { Product } from '@/types'
import { useCart } from '@/hooks/useCart'
import { useAuth } from '@/hooks/useAuth'
import {
  getProductByBarcode,
  createSale,
  updateInventory,
  getStoreConfig,
} from '@/services/supabase'
import './BillingScreen.css'

interface BillingScreenProps {
  storeId: string
  cashierId: string
  cashierName: string
}

export const BillingScreen: React.FC<BillingScreenProps> = ({
  storeId,
  cashierId,
  cashierName,
}) => {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [barcodeInput, setBarcodeInput] = useState('')
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'card' | 'upi' | 'wallet'>('cash')
  const [additionalDiscount, setAdditionalDiscount] = useState(0)
  const [storeConfig, setStoreConfig] = useState<any>(null)
  const [processingPayment, setProcessingPayment] = useState(false)
  const [showPaymentModal, setShowPaymentModal] = useState(false)

  // 🔥 ADD: Use authentication hook
  const { user, isAuthenticated, loading: authLoading } = useAuth()

  const { cart, addItem, removeItem, updateQuantity, setDiscount, clearCart } = useCart(
    storeConfig?.tax_rate || 18
  )

  const barcodeInputRef = useRef<HTMLInputElement>(null)

  // 🔥 FIXED: useEffect with authentication check
  useEffect(() => {
    const fetchData = async () => {
      // Wait for auth to complete loading
      if (authLoading) {
        console.log('🔐 [BILLING] Waiting for auth to load...')
        return
      }

      // Check if user is authenticated
      if (!isAuthenticated || !user) {
        console.log('❌ [BILLING] User not authenticated')
        setError('Please sign in to access billing system')
        return
      }

      console.log('✅ [BILLING] User authenticated:', user.email, 'Role:', user.role)
      console.log('📍 [BILLING] Using store ID from user:', user.store_id)

      setLoading(true)
      try {
        // Use user's store_id for RLS compliance
        const config = await getStoreConfig(user.store_id)
        console.log('📦 Store Config loaded:', config)
        setStoreConfig(config)
        setError(null) // Clear any previous errors
      } catch (err) {
        setError('Failed to load store configuration')
        console.error('❌ [BILLING] Config load error:', err)
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [authLoading, isAuthenticated, user]) // 🔥 FIXED: Dependencies

  const handleBarcodeSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    // 🔥 ADD: Auth check in barcode submit
    if (!isAuthenticated || !user) {
      setError('Please sign in first')
      return
    }

    console.log('🛍️ [SUBMIT] Barcode:', barcodeInput, 'User Store ID:', user.store_id)

    if (!barcodeInput.trim()) {
      console.warn('⚠️ Empty barcode')
      return
    }

    try {
      console.log('🔍 Searching for product...')
      // 🔥 FIXED: Use user.store_id instead of storeId prop
      const product = await getProductByBarcode(barcodeInput, user.store_id)
      console.log('📦 Product result:', product)

      if (product && (product as any).stock > 0) {
        console.log('✅ Adding to cart:', product.name)
        addItem(product as Product, 1)
        setBarcodeInput('')
        barcodeInputRef.current?.focus()
        setError(null)
      } else if (product) {
        console.warn('⚠️ Out of stock')
        setError('Product out of stock')
      } else {
        console.error('❌ Product not found')
        setError('Product not found')
      }
    } catch (err) {
      console.error('❌ Exception:', err)
      setError('Error scanning product')
    }
  }

  const handlePayment = async () => {
    // 🔥 ADD: Auth check in payment
    if (!isAuthenticated || !user) {
      setError('Please sign in first')
      return
    }

    if (cart.items.length === 0) {
      setError('Cart is empty')
      return
    }

    setProcessingPayment(true)
    try {
      setDiscount(additionalDiscount)

      const saleData = {
        id: `SALE-${Date.now()}`,
        sale_number: `SN-${Date.now().toString().slice(-8)}`,
        store_id: user.store_id, // 🔥 FIXED: Use user.store_id
        cashier_id: user.id, // 🔥 FIXED: Use user.id
        cashier_name: `${user.first_name || ''} ${user.last_name || ''}`.trim() || user.email, // 🔥 FIXED: Use user data
        items: cart.items.map((item: any) => ({
          id: item.id,
          sku: item.sku,
          name: item.name,
          mrp: item.mrp,
          quantity: item.quantity,
          total: item.mrp * item.quantity,
        })),
        subtotal: cart.subtotal,
        discount: additionalDiscount,
        tax: cart.tax,
        total: cart.total,
        payment_method: paymentMethod,
        payment_status: 'completed' as const,
        sale_date: new Date().toISOString().split('T')[0],
        notes: null,
        synced: false,
      }

      const sale = await createSale(saleData)

      if (sale) {
        // Update inventory for each item
        for (const item of cart.items) {
          const newStock = (item as any).stock - item.quantity
          await updateInventory((item as any).id, newStock, user.store_id) // 🔥 FIXED: Use user.store_id
        }

        alert(`Sale completed! Receipt #${(sale as any).sale_number}`)
        clearCart()
        setAdditionalDiscount(0)
        setPaymentMethod('cash')
        setShowPaymentModal(false)
      } else {
        setError('Failed to process payment')
      }
    } catch (err) {
      setError('Payment processing error')
      console.error(err)
    } finally {
      setProcessingPayment(false)
    }
  }

  // 🔥 ADD: Loading state for auth
  if (authLoading) {
    return <div className="billing-loading">Loading authentication...</div>
  }

  // 🔥 ADD: Not authenticated state
  if (!isAuthenticated || !user) {
    return (
      <div className="billing-screen">
        <div className="billing-header">
          <h1>Authentication Required</h1>
          <p>Please sign in to access the billing system.</p>
          {error && <div className="error-message">{error}</div>}
        </div>
      </div>
    )
  }

  if (loading) {
    return <div className="billing-loading">Loading store configuration...</div>
  }

  return (
    <div className="billing-screen">
      <div className="billing-header">
        <h1>Billing Screen</h1>
        <div className="billing-header-info">
          {/* 🔥 FIXED: Use authenticated user data */}
          <span>{user.first_name} {user.last_name} ({user.role})</span>
          <span>{new Date().toLocaleDateString()}</span>
          <span>Store: {storeConfig?.store_name || user.store_id}</span>
        </div>
      </div>

      <div className="billing-content">
        <div className="billing-left">
          <form onSubmit={handleBarcodeSubmit} className="barcode-form">
            <label>Scan Barcode / Enter SKU</label>
            <input
              ref={barcodeInputRef}
              type="text"
              value={barcodeInput}
              onChange={(e) => setBarcodeInput(e.target.value)}
              placeholder="Scan or type product code..."
              className="barcode-input"
              autoFocus
            />
            <button type="submit" className="btn btn-primary">
              Add Item
            </button>
          </form>

          {error && <div className="error-message">{error}</div>}

          <div className="cart-items">
            <h3>Cart Items ({cart.items.length})</h3>
            {cart.items.length === 0 ? (
              <p className="empty-cart">No items in cart</p>
            ) : (
              <table className="cart-table">
                <thead>
                  <tr>
                    <th>Product</th>
                    <th>Price</th>
                    <th>Qty</th>
                    <th>Total</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {cart.items.map((item: any) => (
                    <tr key={item.id}>
                      <td>{item.name}</td>
                      <td>₹{item.mrp.toFixed(2)}</td>
                      <td>
                        <input
                          type="number"
                          min="1"
                          value={item.quantity}
                          onChange={(e) => updateQuantity(item.id, parseInt(e.target.value))}
                          className="qty-input"
                        />
                      </td>
                      <td>₹{(item.mrp * item.quantity).toFixed(2)}</td>
                      <td>
                        <button
                          onClick={() => removeItem(item.id)}
                          className="btn btn-sm btn-danger"
                        >
                          Remove
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>

        <div className="billing-right">
          <div className="cart-summary">
            <h3>Order Summary</h3>
            <div className="summary-row">
              <span>Subtotal:</span>
              <span>₹{cart.subtotal.toFixed(2)}</span>
            </div>
            <div className="summary-row">
              <span>Tax ({storeConfig?.tax_rate || 18}%):</span>
              <span>₹{cart.tax.toFixed(2)}</span>
            </div>
            <div className="summary-row">
              <label>
                Discount (₹):
                <input
                  type="number"
                  min="0"
                  value={additionalDiscount}
                  onChange={(e) => setAdditionalDiscount(parseFloat(e.target.value) || 0)}
                  className="discount-input"
                />
              </label>
            </div>
            <div className="summary-divider"></div>
            <div className="summary-row total">
              <span>Total Amount:</span>
              <span className="amount">₹{cart.total.toFixed(2)}</span>
            </div>

            <div className="payment-methods">
              <h4>Payment Method</h4>
              <div className="method-buttons">
                {(['cash', 'card', 'upi', 'wallet'] as const).map((method) => (
                  <button
                    key={method}
                    onClick={() => setPaymentMethod(method)}
                    className={`btn btn-method ${paymentMethod === method ? 'active' : ''}`}
                  >
                    {method.toUpperCase()}
                  </button>
                ))}
              </div>
            </div>

            <div className="action-buttons">
              <button
                onClick={() => clearCart()}
                className="btn btn-secondary btn-block"
                disabled={cart.items.length === 0}
              >
                Clear Cart
              </button>
              <button
                onClick={() => setShowPaymentModal(true)}
                className="btn btn-success btn-block"
                disabled={cart.items.length === 0 || processingPayment}
              >
                {processingPayment ? 'Processing...' : 'Complete Sale'}
              </button>
            </div>
          </div>
        </div>
      </div>

      {showPaymentModal && (
        <div className="modal-overlay">
          <div className="modal">
            <h2>Confirm Payment</h2>
            <div className="modal-body">
              <p>
                Total Amount: <strong>₹{cart.total.toFixed(2)}</strong>
              </p>
              <p>
                Payment Method: <strong>{paymentMethod.toUpperCase()}</strong>
              </p>
            </div>
            <div className="modal-actions">
              <button onClick={() => setShowPaymentModal(false)} className="btn btn-secondary">
                Cancel
              </button>
              <button
                onClick={handlePayment}
                className="btn btn-success"
                disabled={processingPayment}
              >
                {processingPayment ? 'Processing...' : 'Confirm Payment'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
