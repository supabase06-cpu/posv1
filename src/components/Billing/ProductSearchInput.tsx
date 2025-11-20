// src/components/Billing/ProductSearchInput.tsx
import React, { useState, useEffect, useRef } from 'react'
import * as productCache from '@/services/productCache'
import { supabase } from '@/services/supabase'
import type { Product } from '@/types'
import './ProductSearchInput.css'

interface ProductSearchInputProps {
  storeId: string
  onSelectProduct: (product: Product) => void
  isOnline: boolean
}

export const ProductSearchInput: React.FC<ProductSearchInputProps> = ({
  storeId,
  onSelectProduct,
  isOnline,
}) => {
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<Product[]>([])
  const [showResults, setShowResults] = useState(false)
  const [selectedIndex, setSelectedIndex] = useState(-1)
  const [searching, setSearching] = useState(false)

  const inputRef = useRef<HTMLInputElement>(null)
  const resultsRef = useRef<HTMLDivElement>(null)

  // Search products (name + barcode only)
  useEffect(() => {
    const searchProducts = async () => {
      if (searchQuery.length < 2) {
        setSearchResults([])
        setShowResults(false)
        return
      }

      setSearching(true)
      try {
        // Try cache first (offline-first)
        const cacheResults = await productCache.searchProductsByNameOrBarcode(
          searchQuery,
          storeId,
          10
        )

        if (cacheResults.length > 0) {
          setSearchResults(cacheResults as Product[])
          setShowResults(true)
          setSearching(false)
          return
        }

        // If online and no cache results, try database
        if (isOnline) {
          const { data, error } = await supabase
            .from('products')
            .select('*')
            .eq('store_id', storeId)
            .eq('is_active', true)
            .or(`name.ilike.%${searchQuery}%,barcode.ilike.%${searchQuery}%`)
            .limit(10)

          if (!error && data) {
            setSearchResults(data as Product[])
            setShowResults(true)
            // Cache the results
            await productCache.upsertProducts(data, storeId)
          }
        }
      } catch (err) {
        console.error('Search error:', err)
      } finally {
        setSearching(false)
      }
    }

    const debounce = setTimeout(searchProducts, 300)
    return () => clearTimeout(debounce)
  }, [searchQuery, storeId, isOnline])

  // Keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!showResults || searchResults.length === 0) return

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
        }
        break
      case 'Escape':
        setShowResults(false)
        setSelectedIndex(-1)
        break
    }
  }

  const handleSelectProduct = (product: Product) => {
    onSelectProduct(product)
    setSearchQuery('')
    setShowResults(false)
    setSelectedIndex(-1)
    inputRef.current?.focus()
  }

  return (
    <div className="product-search-input">
      <input
        ref={inputRef}
        type="text"
        value={searchQuery}
        onChange={(e) => setSearchQuery(e.target.value)}
        onKeyDown={handleKeyDown}
        onFocus={() => searchQuery.length >= 2 && setShowResults(true)}
        onBlur={() => setTimeout(() => setShowResults(false), 200)}
        placeholder="Search by product name or barcode..."
        className="search-input"
      />

      {searching && <span className="search-status">Searching...</span>}

      {showResults && searchResults.length > 0 && (
        <div ref={resultsRef} className="search-results-dropdown">
          {searchResults.map((product, index) => {
            const prod = product as any
            return (
              <div
                key={prod.id}
                className={`search-result-item ${
                  index === selectedIndex ? 'selected' : ''
                }`}
                onClick={() => handleSelectProduct(product)}
              >
                <div className="result-main">
                  <span className="result-name">{prod.name}</span>
                  <span className="result-price">₹{prod.selling_price || prod.mrp}</span>
                </div>
                <div className="result-meta">
                  <span className="result-sku">SKU: {prod.sku}</span>
                  {prod.barcode && (
                    <span className="result-barcode">Barcode: {prod.barcode}</span>
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

      {showResults && searchQuery.length >= 2 && searchResults.length === 0 && !searching && (
        <div className="search-results-dropdown">
          <div className="no-results">
            {isOnline ? 'No products found' : '📴 No products in offline cache'}
          </div>
        </div>
      )}
    </div>
  )
}
