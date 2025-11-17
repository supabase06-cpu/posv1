import { useState, useCallback } from 'react'
import type { Product } from '@/types'

export interface CartItem extends Product {
  quantity: number
  discount?: number
}

export interface CartState {
  items: CartItem[]
  subtotal: number
  discount: number
  tax: number
  total: number
}

export const useCart = (taxRate: number = 18) => {
  const [cart, setCart] = useState<CartState>({
    items: [],
    subtotal: 0,
    discount: 0,
    tax: 0,
    total: 0,
  })

  const calculateTotals = (items: CartItem[], discount: number) => {
    const subtotal = items.reduce((sum, item: any) => sum + (item.mrp || 0) * item.quantity, 0)
    const taxAmount = (subtotal * taxRate) / 100
    const total = subtotal + taxAmount - discount

    return {
      items,
      subtotal,
      discount,
      tax: taxAmount,
      total: Math.max(0, total),
    }
  }

  const addItem = useCallback(
    (product: Product, quantity: number = 1) => {
      setCart((prevCart) => {
        const productId = (product as any).id
        const existingItem = prevCart.items.find((item) => (item as any).id === productId)

        let newItems: CartItem[]
        if (existingItem) {
          newItems = prevCart.items.map((item) =>
            (item as any).id === productId
              ? { ...item, quantity: item.quantity + quantity }
              : item
          )
        } else {
          newItems = [...prevCart.items, { ...product, quantity }]
        }

        return calculateTotals(newItems, prevCart.discount)
      })
    },
    [taxRate]
  )

  const removeItem = useCallback(
    (productId: number) => {
      setCart((prevCart) => {
        const newItems = prevCart.items.filter((item) => (item as any).id !== productId)
        return calculateTotals(newItems, prevCart.discount)
      })
    },
    [taxRate]
  )

  const updateQuantity = useCallback(
    (productId: number, quantity: number) => {
      setCart((prevCart) => {
        const newItems = prevCart.items
          .map((item) =>
            (item as any).id === productId
              ? { ...item, quantity: Math.max(0, quantity) }
              : item
          )
          .filter((item) => item.quantity > 0)

        return calculateTotals(newItems, prevCart.discount)
      })
    },
    [taxRate]
  )

  const setDiscount = useCallback((discount: number) => {
    setCart((prevCart) => calculateTotals(prevCart.items, discount))
  }, [taxRate])

  const clearCart = useCallback(() => {
    setCart({
      items: [],
      subtotal: 0,
      discount: 0,
      tax: 0,
      total: 0,
    })
  }, [])

  return {
    cart,
    addItem,
    removeItem,
    updateQuantity,
    setDiscount,
    clearCart,
  }
}
