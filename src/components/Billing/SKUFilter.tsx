// src/components/Billing/SKUFilter.tsx
import React, { useState } from 'react'
import * as productCache from '@/services/productCache'
import { supabase } from '@/services/supabase'
import type { Product } from '@/types'
import './SKUFilter.css'

interface SKUFilterProps {
  storeId: string
  onSelectProduct: (product: Product) => void
  isOnline: boolean
}

export const SKUFilter: React.FC<SKUFilterProps> = ({
  storeId,
  onSelectProduct,
  isOnline,
}) => {
  const [skuQuery, setSkuQuery] = useState('')
  const [searching, setSearching] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!skuQuery.trim()) return

    setSearching(true)
    setError(null)

    try {
      // Try cache first
      const cachedProduct = await productCache.getBySKU(skuQuery.trim(), storeId)
      
      if (cachedProduct) {
        onSelectProduct(cachedProduct as Product)
        setSkuQuery('')
        setSearching(false)
        return
      }

      // Try online if no cache result
      if (isOnline) {
        const { data, error: dbError } = await supabase
          .from('products')
          .select('*')
          .eq('store_id', storeId)
          .eq('sku', skuQuery.trim())
          .eq('is_active', true)
          .maybeSingle()

        if (dbError) {
          setError('Error searching by SKU')
        } else if (data) {
          await productCache.upsertProducts([data], storeId)
          onSelectProduct(data as Product)
          setSkuQuery('')
        } else {
          setError('No product found with this SKU')
        }
      } else {
        setError('📴 Product not in offline cache')
      }
    } catch (err) {
      console.error('SKU search error:', err)
      setError('Search failed')
    } finally {
      setSearching(false)
    }
  }

  return (
    <div className="sku-filter">
      <form onSubmit={handleSearch} className="sku-filter-form">
        <label htmlFor="sku-input">Filter by SKU:</label>
        <div className="sku-input-group">
          <input
            id="sku-input"
            type="text"
            value={skuQuery}
            onChange={(e) => setSkuQuery(e.target.value)}
            placeholder="Enter SKU..."
            className="sku-input"
          />
          <button type="submit" className="sku-search-btn" disabled={searching}>
            {searching ? '⏳' : '🔍'}
          </button>
        </div>
        {error && <span className="sku-error">{error}</span>}
      </form>
    </div>
  )
}
