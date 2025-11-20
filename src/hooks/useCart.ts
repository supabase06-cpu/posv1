import { useState, useCallback, useEffect } from 'react'
import type { Product } from '@/types'

export type PriceType = 'retail' | 'wholesale'

export interface CartItem extends Product {
  quantity: number
  priceType: PriceType
  effectivePrice: number
  itemDiscount?: number
  itemTax: number
  itemSavings: number
}

export interface CartState {
  items: CartItem[]
  subtotal: number
  discount: number
  tax: number
  total: number
  totalSavings: number
}

const CART_STORAGE_KEY = 'pos_cart_state'

// Load cart from localStorage
const loadCartFromStorage = (): CartState | null => {
  try {
    const stored = localStorage.getItem(CART_STORAGE_KEY)
    if (stored) {
      const parsed = JSON.parse(stored)
      console.log('📦 [useCart] Loaded cart from storage:', parsed.items.length, 'items')
      return parsed
    }
  } catch (err) {
    console.error('❌ [useCart] Failed to load cart from storage:', err)
  }
  return null
}

// Save cart to localStorage
const saveCartToStorage = (cart: CartState) => {
  try {
    localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(cart))
    console.log('💾 [useCart] Saved cart to storage:', cart.items.length, 'items')
  } catch (err) {
    console.error('❌ [useCart] Failed to save cart to storage:', err)
  }
}

// Clear cart from localStorage
const clearCartStorage = () => {
  try {
    localStorage.removeItem(CART_STORAGE_KEY)
    console.log('🗑️ [useCart] Cleared cart from storage')
  } catch (err) {
    console.error('❌ [useCart] Failed to clear cart storage:', err)
  }
}

export const useCart = (defaultTaxRate: number = 18) => {
  // Initialize from localStorage or empty cart
  const [cart, setCart] = useState<CartState>(() => {
    const stored = loadCartFromStorage()
    return stored || {
      items: [],
      subtotal: 0,
      discount: 0,
      tax: 0,
      total: 0,
      totalSavings: 0,
    }
  })

  // Save to localStorage whenever cart changes
  useEffect(() => {
    saveCartToStorage(cart)
  }, [cart])

  const calculateItemPrice = (product: Product, quantity: number, priceType: PriceType): number => {
    const prod = product as any
    
    let basePrice = prod.selling_price || prod.mrp
    if (priceType === 'wholesale' && prod.wholesale_price) {
      basePrice = prod.wholesale_price
    }

    if (prod.weight_unit === 'kg' && prod.weight) {
      const pricePerKg = basePrice / prod.weight
      return pricePerKg * quantity
    }

    return basePrice * quantity
  }

  const calculateItemTax = (product: Product, itemTotal: number): number => {
    const prod = product as any
    const gstRate = prod.gst_rate ?? defaultTaxRate
    return (itemTotal * gstRate) / 100
  }

  const calculateItemSavings = (product: Product, quantity: number, priceType: PriceType): number => {
    const prod = product as any
    
    let mrpTotal = prod.mrp * quantity
    if (prod.weight_unit === 'kg' && prod.weight) {
      const mrpPerKg = prod.mrp / prod.weight
      mrpTotal = mrpPerKg * quantity
    }

    const effectivePrice = calculateItemPrice(product, quantity, priceType)
    return Math.max(0, mrpTotal - effectivePrice)
  }

  const calculateTotals = (items: CartItem[], discount: number) => {
    let subtotal = 0
    let totalTax = 0
    let totalSavings = 0

    items.forEach(item => {
      subtotal += item.effectivePrice
      totalTax += item.itemTax
      totalSavings += item.itemSavings
    })

    const total = subtotal + totalTax - discount

    return {
      items,
      subtotal,
      discount,
      tax: totalTax,
      total: Math.max(0, total),
      totalSavings,
    }
  }

  const addItem = useCallback(
    (product: Product, quantity: number = 1) => {
      setCart((prevCart) => {
        const prod = product as any
        const productId = prod.id

        const shouldUseWholesale = 
          prod.wholesale_price && 
          prod.min_wholesale_qty && 
          quantity >= prod.min_wholesale_qty

        const initialPriceType: PriceType = shouldUseWholesale ? 'wholesale' : 'retail'
        
        const existingItem = prevCart.items.find((item) => (item as any).id === productId)

        let newItems: CartItem[]
        if (existingItem) {
          newItems = prevCart.items.map((item) => {
            if ((item as any).id === productId) {
              const newQty = item.quantity + quantity
              const effectivePrice = calculateItemPrice(product, newQty, item.priceType)
              const itemTax = calculateItemTax(product, effectivePrice)
              const itemSavings = calculateItemSavings(product, newQty, item.priceType)
              
              return { 
                ...item, 
                quantity: newQty,
                effectivePrice,
                itemTax,
                itemSavings,
              }
            }
            return item
          })
        } else {
          const effectivePrice = calculateItemPrice(product, quantity, initialPriceType)
          const itemTax = calculateItemTax(product, effectivePrice)
          const itemSavings = calculateItemSavings(product, quantity, initialPriceType)
          
          newItems = [...prevCart.items, { 
            ...product, 
            quantity,
            priceType: initialPriceType,
            effectivePrice,
            itemTax,
            itemSavings,
          }]
        }

        return calculateTotals(newItems, prevCart.discount)
      })
    },
    [defaultTaxRate]
  )

  const removeItem = useCallback(
    (productId: number) => {
      setCart((prevCart) => {
        const newItems = prevCart.items.filter((item) => (item as any).id !== productId)
        return calculateTotals(newItems, prevCart.discount)
      })
    },
    []
  )

  const updateQuantity = useCallback(
    (productId: number, quantity: number) => {
      setCart((prevCart) => {
        const newItems = prevCart.items
          .map((item) => {
            if ((item as any).id === productId) {
              if (quantity <= 0) return null
              
              const prod = item as any
              const effectivePrice = calculateItemPrice(item, quantity, item.priceType)
              const itemTax = calculateItemTax(item, effectivePrice)
              const itemSavings = calculateItemSavings(item, quantity, item.priceType)
              
              let newPriceType = item.priceType
              if (prod.wholesale_price && prod.min_wholesale_qty) {
                if (quantity >= prod.min_wholesale_qty && item.priceType === 'retail') {
                  newPriceType = 'wholesale'
                  const newEffectivePrice = calculateItemPrice(item, quantity, 'wholesale')
                  const newItemTax = calculateItemTax(item, newEffectivePrice)
                  const newItemSavings = calculateItemSavings(item, quantity, 'wholesale')
                  return {
                    ...item,
                    quantity,
                    priceType: newPriceType,
                    effectivePrice: newEffectivePrice,
                    itemTax: newItemTax,
                    itemSavings: newItemSavings,
                  }
                }
              }
              
              return { 
                ...item, 
                quantity,
                effectivePrice,
                itemTax,
                itemSavings,
              }
            }
            return item
          })
          .filter((item): item is CartItem => item !== null)

        return calculateTotals(newItems, prevCart.discount)
      })
    },
    [defaultTaxRate]
  )

  const updateItemPriceType = useCallback(
    (productId: number, priceType: PriceType) => {
      setCart((prevCart) => {
        const newItems = prevCart.items.map((item) => {
          if ((item as any).id === productId) {
            const effectivePrice = calculateItemPrice(item, item.quantity, priceType)
            const itemTax = calculateItemTax(item, effectivePrice)
            const itemSavings = calculateItemSavings(item, item.quantity, priceType)
            
            return {
              ...item,
              priceType,
              effectivePrice,
              itemTax,
              itemSavings,
            }
          }
          return item
        })

        return calculateTotals(newItems, prevCart.discount)
      })
    },
    [defaultTaxRate]
  )

  const setDiscount = useCallback((discount: number) => {
    setCart((prevCart) => calculateTotals(prevCart.items, discount))
  }, [])

  const clearCart = useCallback(() => {
    const emptyCart = {
      items: [],
      subtotal: 0,
      discount: 0,
      tax: 0,
      total: 0,
      totalSavings: 0,
    }
    setCart(emptyCart)
    clearCartStorage() // Clear from localStorage
  }, [])

  return {
    cart,
    addItem,
    removeItem,
    updateQuantity,
    updateItemPriceType,
    setDiscount,
    clearCart,
  }
}
