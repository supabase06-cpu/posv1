// src/components/Billing/CustomerSearch.tsx
import React, { useState, useEffect } from 'react'
import { supabase } from '@/services/supabase'
import * as customerCache from '@/services/customerCache'
import type { Database } from '@/types/database'
import './CustomerSearch.css'

type Customer = Database['public']['Tables']['customers']['Row']

interface CustomerSearchProps {
  storeId: string
  onSelectCustomer: (customer: Customer) => void
}

export const CustomerSearch: React.FC<CustomerSearchProps> = ({
  storeId,
  onSelectCustomer,
}) => {
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<Customer[]>([])
  const [searching, setSearching] = useState(false)
  const [showResults, setShowResults] = useState(false)
  const [isOffline, setIsOffline] = useState(false)

  // Check online status
  const checkOnlineStatus = () => {
    return typeof navigator !== 'undefined' ? navigator.onLine : true
  }

  useEffect(() => {
    const searchCustomers = async () => {
      if (searchQuery.length < 2) {
        setSearchResults([])
        setShowResults(false)
        return
      }

      setSearching(true)
      const online = checkOnlineStatus()
      setIsOffline(!online)

      try {
        let results: Customer[] = []

        if (online) {
          // Try online search first
          try {
            const { data, error } = await (supabase
              .from('customers') as any)
              .select('*')
              .eq('store_id', storeId)
              .eq('is_active', true)
              .or(`customer_name.ilike.%${searchQuery}%,phone.ilike.%${searchQuery}%`)
              .limit(10)

            if (error) {
              console.error('Online search error:', error)
              // Fall back to cache on error
              results = await customerCache.searchCustomers(searchQuery, storeId, 10)
            } else {
              results = (data || []) as Customer[]
            }
          } catch (err) {
            console.error('Online search exception:', err)
            // Fall back to cache
            results = await customerCache.searchCustomers(searchQuery, storeId, 10)
          }
        } else {
          // Offline: search from cache
          console.log('📴 Searching customers from cache (offline)')
          results = await customerCache.searchCustomers(searchQuery, storeId, 10)
        }

        setSearchResults(results)
        setShowResults(true)
      } catch (err) {
        console.error('Search exception:', err)
        setSearchResults([])
      } finally {
        setSearching(false)
      }
    }

    const debounce = setTimeout(searchCustomers, 300)
    return () => clearTimeout(debounce)
  }, [searchQuery, storeId])

  const handleSelectCustomer = (customer: Customer) => {
    onSelectCustomer(customer)
    setSearchQuery('')
    setShowResults(false)
    setSearchResults([])
  }

  return (
    <div className="customer-search">
      <input
        type="text"
        value={searchQuery}
        onChange={(e) => setSearchQuery(e.target.value)}
        onFocus={() => searchQuery.length >= 2 && setShowResults(true)}
        onBlur={() => setTimeout(() => setShowResults(false), 200)}
        placeholder="Search by name or phone..."
        className="search-input"
      />
      {searching && (
        <span className="search-loading">
          {isOffline ? 'Searching offline cache...' : 'Searching...'}
        </span>
      )}
      
      {showResults && searchResults.length > 0 && (
        <div className="search-results">
          {isOffline && (
            <div className="offline-indicator">
              📴 Searching from offline cache
            </div>
          )}
          {searchResults.map((customer) => (
            <div
              key={customer.id}
              className="search-result-item"
              onClick={() => handleSelectCustomer(customer)}
            >
              <div className="customer-info">
                <span className="customer-name">{customer.customer_name}</span>
                {customer.phone && (
                  <span className="customer-phone">{customer.phone}</span>
                )}
              </div>
              <div className="customer-stats">
                <span className="purchase-count">
                  {customer.total_purchases} purchases
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
      
      {showResults && searchQuery.length >= 2 && searchResults.length === 0 && !searching && (
        <div className="search-results">
          <div className="no-results">
            {isOffline 
              ? 'No customers found in offline cache' 
              : 'No customers found'}
          </div>
        </div>
      )}
    </div>
  )
}
