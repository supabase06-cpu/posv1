// src/components/Billing/BillingScreen.tsx
import React, { useEffect, useRef, useState } from 'react'
import type { Product } from '@/types'
import { useCart, type PriceType } from '@/hooks/useCart'
import { useAuth } from '@/hooks/useAuth'
import { getProductByBarcode, getStoreConfig } from '@/services/supabase'
import { CustomerIntakeModal, type CustomerData } from './CustomerIntakeModal'
import { processPaymentHandler } from './PaymentHandler'
import * as productCache from '@/services/productCache'
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
  const [saleCompleted, setSaleCompleted] = useState(false)
  const [saleReceiptNumber, setSaleReceiptNumber] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [searchInput, setSearchInput] = useState('')
  const [searchResults, setSearchResults] = useState<Product[]>([])
  const [showResults, setShowResults] = useState(false)
  const [selectedIndex, setSelectedIndex] = useState(-1)
  const [skuOnlyMode, setSkuOnlyMode] = useState(false)
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'card' | 'upi' | 'wallet'>('cash')
  const [additionalDiscount, setAdditionalDiscount] = useState(0)
  const [storeConfig, setStoreConfig] = useState<any>(null)
  const [processingPayment, setProcessingPayment] = useState(false)
  const [showPaymentModal, setShowPaymentModal] = useState(false)
  const [showCustomerModal, setShowCustomerModal] = useState(false)

  const { user, isAuthenticated, loading: authLoading } = useAuth()
  const { cart, addItem, removeItem, updateQuantity, updateItemPriceType, setDiscount, clearCart } = useCart(
    storeConfig?.tax_rate || 18
  )

  const searchInputRef = useRef<HTMLInputElement>(null)
  const counterId = import.meta.env.VITE_COUNTER_ID || 'COUNTER-01'

  // NEW: Warn user before leaving page if cart has items
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (cart.items.length > 0 && !processingPayment && !saleCompleted) {
        e.preventDefault()
        e.returnValue = 'You have items in your cart. Are you sure you want to leave?'
      }
    }

    window.addEventListener('beforeunload', handleBeforeUnload)

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload)
    }
  }, [cart.items.length, processingPayment, saleCompleted])

  // Load store config
  useEffect(() => {
    const fetchData = async () => {
      if (authLoading) return
      if (!isAuthenticated || !user) {
        setError('Please sign in to access billing system')
        return
      }
      setLoading(true)
      try {
        const config = await getStoreConfig(user.store_id)
        setStoreConfig(config)
        setError(null)
      } catch (err) {
        setError('Failed to load store configuration')
        console.error('❌ [BILLING] Config load error:', err)
      } finally {
        setLoading(false)
      }
    }
    fetchData()
  }, [authLoading, isAuthenticated, user])

  const isOnline = () => {
    return typeof navigator !== 'undefined' ? navigator.onLine : true
  }

  // Smart search
  useEffect(() => {
    const performSearch = async () => {
      if (!user) return
      
      const query = searchInput.trim()
      
      if (query.length < 2) {
        setSearchResults([])
        setShowResults(false)
        return
      }

      try {
        let results: Product[] = []

        if (skuOnlyMode) {
          const skuResult = await productCache.getBySKU(query, user.store_id)
          if (skuResult) {
            results = [skuResult as Product]
          }
        } else {
          results = await productCache.searchProductsByNameOrBarcode(
            query,
            user.store_id,
            10
          ) as Product[]
        }

        setSearchResults(results)
        setShowResults(results.length > 0)
      } catch (err) {
        console.error('Search error:', err)
      }
    }

    const debounce = setTimeout(performSearch, 300)
    return () => clearTimeout(debounce)
  }, [searchInput, skuOnlyMode, user])

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!showResults || searchResults.length === 0) {
      if (e.key === 'Enter') {
        e.preventDefault()
        handleDirectAdd()
      }
      return
    }

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault()
        setSelectedIndex((prev) =>
          prev < searchResults.length - 1 ? prev + 1 : prev
        )
        break
      case 'ArrowUp':
        e.preventDefault()
        setSelectedIndex((prev) => (prev > 0 ? prev - 1 : -1))
        break
      case 'Enter':
        e.preventDefault()
        if (selectedIndex >= 0 && searchResults[selectedIndex]) {
          handleSelectProduct(searchResults[selectedIndex])
        } else if (searchResults.length > 0) {
          handleSelectProduct(searchResults[0])
        } else {
          handleDirectAdd()
        }
        break
      case 'Escape':
        setShowResults(false)
        setSelectedIndex(-1)
        break
    }
  }

  const handleDirectAdd = async () => {
    if (!user) return
    
    const code = searchInput.trim()
    if (!code) return

    setError(null)
    try {
      const cached = await productCache.getByBarcode(code, user.store_id)
      if (cached) {
        handleSelectProduct(cached as Product)
        return
      }

      if (isOnline()) {
        const product = await getProductByBarcode(code, user.store_id)
        if (product) {
          await productCache.upsertProducts([product], user.store_id)
          handleSelectProduct(product as Product)
        } else {
          setError('Product not found')
        }
      } else {
        setError('📴 Offline: Product not in cache')
      }
    } catch (err) {
      console.error('Error finding product:', err)
      setError('Error finding product')
    }
  }

  const handleSelectProduct = (product: Product) => {
    const prod = product as any
    if (prod.stock > 0) {
      addItem(product, 1)
      setSearchInput('')
      setShowResults(false)
      setSelectedIndex(-1)
      setError(null)
      searchInputRef.current?.focus()
    } else {
      setError('Product out of stock')
    }
  }

  const handleDiscountChange = (value: number) => {
    const discountValue = value || 0
    setAdditionalDiscount(discountValue)
    setDiscount(discountValue)
  }

  const handleCompleteSaleClick = () => {
    if (cart.items.length === 0) {
      setError('Cart is empty')
      return
    }
    setShowCustomerModal(true)
  }

  const handleCustomerSubmit = async (customerData: CustomerData) => {
    setShowCustomerModal(false)
    setShowPaymentModal(true)
    await processPayment(customerData)
  }

  const handleCustomerSkip = async () => {
    setShowCustomerModal(false)
    setShowPaymentModal(true)
    await processPayment({ name: '', phone: '', email: '', skipped: true })
  }

  const processPayment = async (customerData: CustomerData) => {
    if (!isAuthenticated || !user) {
      setError('Please sign in first')
      return
    }

    setProcessingPayment(true)

    await processPaymentHandler({
      user,
      cart,
      paymentMethod,
      additionalDiscount,
      counterId,
      customerData,
      isOnline,
      onSuccess: (saleNumber) => {
        setSaleCompleted(true)
        setSaleReceiptNumber(saleNumber)
        setTimeout(() => {
          setSaleCompleted(false)
          setSaleReceiptNumber('')
          setShowPaymentModal(false)
          clearCart()
          setAdditionalDiscount(0)
          setPaymentMethod('cash')
          setError(null)
          setProcessingPayment(false)
        }, 3000)
      },
      onError: (errorMsg) => {
        setError(errorMsg)
        setTimeout(() => {
          setShowPaymentModal(false)
          clearCart()
          setAdditionalDiscount(0)
          setPaymentMethod('cash')
          setProcessingPayment(false)
        }, 2000)
      },
    })
  }

  const getQuantityStep = (item: any) => {
    return item.weight_unit === 'kg' ? 0.1 : 1
  }

  if (authLoading) {
    return <div className="billing-loading">Loading authentication...</div>
  }

  if (!isAuthenticated || !user) {
    return (
      <div className="billing-screen">
        <div className="billing-error">
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
      <div className="billing-content">
        <div className="billing-left">
          <div className="smart-search-container">
            <div className="search-header">
              <label>
                {skuOnlyMode 
                  ? 'Search by SKU Code' 
                  : 'Scan Barcode / Search Product'}
              </label>
              <label className="sku-toggle">
                <input
                  type="checkbox"
                  checked={skuOnlyMode}
                  onChange={(e) => {
                    setSkuOnlyMode(e.target.checked)
                    setSearchInput('')
                    setShowResults(false)
                  }}
                />
                <span>SKU Only</span>
              </label>
            </div>

            <div className="search-input-wrapper">
              <input
                ref={searchInputRef}
                type="text"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                onKeyDown={handleKeyDown}
                onFocus={() => searchInput.length >= 2 && setShowResults(true)}
                onBlur={() => setTimeout(() => setShowResults(false), 200)}
                placeholder={
                  skuOnlyMode
                    ? 'Enter SKU code...'
                    : 'Scan barcode or search by name...'
                }
                className="smart-search-input"
                autoFocus
              />
              
              {skuOnlyMode && (
                <span className="sku-mode-badge">SKU</span>
              )}
            </div>

            {showResults && searchResults.length > 0 && (
              <div className="smart-search-results">
                {searchResults.map((product, index) => {
                  const prod = product as any
                  return (
                    <div
                      key={prod.id}
                      className={`result-item ${index === selectedIndex ? 'selected' : ''}`}
                      onClick={() => handleSelectProduct(product)}
                    >
                      <div className="result-main">
                        <span className="result-name">{prod.name}</span>
                        <span className="result-price">
                          ₹{prod.selling_price || prod.mrp}
                        </span>
                      </div>
                      <div className="result-meta">
                        <span className="result-sku">SKU: {prod.sku}</span>
                        {prod.barcode && (
                          <span className="result-barcode">{prod.barcode}</span>
                        )}
                        <span className="result-stock">
                          Stock: {prod.stock} {prod.weight_unit || 'units'}
                        </span>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}

            {showResults && searchInput.length >= 2 && searchResults.length === 0 && (
              <div className="smart-search-results">
                <div className="no-results">
                  {skuOnlyMode ? 'No product found with this SKU' : 'No products found'}
                </div>
              </div>
            )}
          </div>

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
                    <th>Price Type</th>
                    <th>Price</th>
                    <th>Qty</th>
                    <th>GST</th>
                    <th>Savings</th>
                    <th>Total</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {cart.items.map((item: any) => {
                    const hasWholesale = item.wholesale_price && item.wholesale_price > 0
                    const showWholesaleBadge = 
                      hasWholesale && 
                      item.min_wholesale_qty && 
                      item.quantity >= item.min_wholesale_qty &&
                      item.priceType === 'retail'

                    return (
                      <tr key={item.id}>
                        <td>
                          <div className="product-name">{item.name}</div>
                          <div className="product-meta">
                            <span className="product-sku">SKU: {item.sku}</span>
                            {item.weight_unit === 'kg' && (
                              <span className="product-badge">Decimal Qty</span>
                            )}
                          </div>
                          <div className="product-mrp">MRP: ₹{item.mrp}</div>
                        </td>
                        <td>
                          {hasWholesale ? (
                            <select
                              value={item.priceType}
                              onChange={(e) => updateItemPriceType(item.id, e.target.value as PriceType)}
                              className="price-type-select"
                            >
                              <option value="retail">
                                Retail (₹{item.selling_price || item.mrp})
                              </option>
                              <option value="wholesale">
                                Wholesale (₹{item.wholesale_price})
                              </option>
                            </select>
                          ) : (
                            <span className="price-type-label">Retail</span>
                          )}
                          {showWholesaleBadge && (
                            <div className="wholesale-badge">💡 Wholesale Available!</div>
                          )}
                        </td>
                        <td>₹{((item.effectivePrice / item.quantity) || 0).toFixed(2)}</td>
                        <td>
                          <input
                            type="number"
                            min={getQuantityStep(item)}
                            step={getQuantityStep(item)}
                            value={item.quantity}
                            onChange={(e) => updateQuantity(item.id, parseFloat(e.target.value))}
                            className="qty-input"
                          />
                        </td>
                        <td>
                          <span className="gst-rate">{item.gst_rate || 18}%</span>
                          <br />
                          <span className="gst-amount">₹{item.itemTax.toFixed(2)}</span>
                        </td>
                        <td className="item-savings">
                          {item.itemSavings > 0 ? (
                            <span className="savings-amount">
                              ₹{item.itemSavings.toFixed(2)}
                            </span>
                          ) : (
                            <span className="no-savings">-</span>
                          )}
                        </td>
                        <td className="item-total">
                          ₹{(item.effectivePrice + item.itemTax).toFixed(2)}
                        </td>
                        <td>
                          <button
                            onClick={() => removeItem(item.id)}
                            className="btn btn-sm btn-danger"
                          >
                            Remove
                          </button>
                        </td>
                      </tr>
                    )
                  })}
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
            
            {cart.totalSavings > 0 && (
              <div className="summary-row savings-row">
                <span>You Saved:</span>
                <span className="savings-highlight">₹{cart.totalSavings.toFixed(2)}</span>
              </div>
            )}

            <div className="summary-row">
              <span>Tax (GST):</span>
              <span>₹{cart.tax.toFixed(2)}</span>
            </div>
            <div className="summary-row discount-row">
              <label>
                Discount (₹):
                <input
                  type="number"
                  min="0"
                  value={additionalDiscount}
                  onChange={(e) => handleDiscountChange(parseFloat(e.target.value))}
                  className="discount-input"
                />
              </label>
              {additionalDiscount > 0 && (
                <span className="discount-value">-₹{additionalDiscount.toFixed(2)}</span>
              )}
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
                onClick={() => {
                  clearCart()
                  setAdditionalDiscount(0)
                }}
                className="btn btn-secondary btn-block"
                disabled={cart.items.length === 0}
              >
                Clear Cart
              </button>
              <button
                onClick={handleCompleteSaleClick}
                className="btn btn-success btn-block"
                disabled={cart.items.length === 0 || processingPayment}
              >
                {processingPayment ? 'Processing...' : 'Complete Sale'}
              </button>
            </div>
          </div>
        </div>
      </div>

      {showCustomerModal && (
        <CustomerIntakeModal
          onSubmit={handleCustomerSubmit}
          onSkip={handleCustomerSkip}
          onCancel={() => setShowCustomerModal(false)}
          storeId={user.store_id}
        />
      )}

      {showPaymentModal && (
        <div className="modal-overlay">
          <div className="modal">
            {saleCompleted ? (
              <>
                <div className="success-icon">✅</div>
                <h2>Sale Completed!</h2>
                <div className="modal-body">
                  <p className="success-message">Receipt #{saleReceiptNumber}</p>
                  <p className="success-amount">₹{cart.total.toFixed(2)}</p>
                  {cart.totalSavings > 0 && (
                    <p className="success-savings">
                      You saved ₹{cart.totalSavings.toFixed(2)}!
                    </p>
                  )}
                  <p className="success-note">Closing automatically...</p>
                </div>
              </>
            ) : processingPayment ? (
              <>
                <h2>Processing Payment...</h2>
                <div className="modal-body">
                  <div className="processing-spinner"></div>
                  <p>Please wait while we process your payment...</p>
                  <p className="processing-amount">Amount: ₹{cart.total.toFixed(2)}</p>
                </div>
              </>
            ) : null}
          </div>
        </div>
      )}
    </div>
  )
}
