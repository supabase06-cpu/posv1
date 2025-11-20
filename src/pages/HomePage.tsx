// src/pages/HomePage.tsx
import React, { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/hooks/useAuth'
import { getSalesByDateRange, getTotalProductsCount, getPendingSyncCount } from '@/services/supabase'
import { getQueue } from '@/services/localQueue'
import * as productCache from '@/services/productCache'
import './HomePage.css'

type DateRangePreset = 'today' | 'yesterday' | 'last7' | 'last30' | 'custom'

export const HomePage: React.FC = () => {
  const navigate = useNavigate()
  const { user } = useAuth()
  
  const [salesTotal, setSalesTotal] = useState<number>(0)
  const [offlineQueueSalesTotal, setOfflineQueueSalesTotal] = useState<number>(0)
  const [totalProducts, setTotalProducts] = useState<number>(0)
  const [pendingSync, setPendingSync] = useState<number>(0)
  const [loading, setLoading] = useState(true)
  const [isOnline, setIsOnline] = useState<boolean>(
    typeof navigator !== 'undefined' ? navigator.onLine : true
  )
  
  // Date range filter states
  const [dateRangePreset, setDateRangePreset] = useState<DateRangePreset>('today')
  const [fromDate, setFromDate] = useState<string>(new Date().toISOString().split('T')[0])
  const [toDate, setToDate] = useState<string>(new Date().toISOString().split('T')[0])
  const [showCustomModal, setShowCustomModal] = useState(false)
  const [tempFromDate, setTempFromDate] = useState<string>('')
  const [tempToDate, setTempToDate] = useState<string>('')
  const [dateError, setDateError] = useState<string>('')

  // Get today's date for max date validation
  const today = new Date().toISOString().split('T')[0]
  
  // Calculate min date (35 days ago)
  const minDate = new Date()
  minDate.setDate(minDate.getDate() - 35)
  const minDateStr = minDate.toISOString().split('T')[0]

  // Listen to online/offline changes
  useEffect(() => {
    const handleOnline = () => setIsOnline(true)
    const handleOffline = () => setIsOnline(false)

    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)

    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [])

  useEffect(() => {
    const fetchStats = async () => {
      if (!user?.store_id) return

      setLoading(true)
      try {
        // Always load local queue (for offline sales + pending sync)
        const localQueue = await getQueue(true)
        const localPending = localQueue?.length || 0

        // Calculate offline queue sales total (sum of payload.total)
        const offlineTotal = localQueue.reduce((sum, item) => {
          const saleTotal = Number(item.payload?.total || 0)
          return sum + (isNaN(saleTotal) ? 0 : saleTotal)
        }, 0)
        setOfflineQueueSalesTotal(offlineTotal)

        if (isOnline) {
          // ONLINE MODE: use Supabase
          const [sales, products, dbPending] = await Promise.all([
            getSalesByDateRange(user.store_id, fromDate, toDate),
            getTotalProductsCount(user.store_id),
            getPendingSyncCount(user.store_id),
          ])

          setSalesTotal(sales)
          setTotalProducts(products)
          setPendingSync(dbPending + localPending)
        } else {
          // OFFLINE MODE: use cache/local only
          // 1. Products count from productCache
          const cachedProducts = await productCache.loadCachedProducts(user.store_id)
          const activeProducts = cachedProducts.filter((p: any) => p.is_active !== false)
          setTotalProducts(activeProducts.length)

          // 2. Sales total from local queue only (for today-range-like feel, use all queued)
          setSalesTotal(offlineTotal)

          // 3. Pending sync = local queue length (no DB check)
          setPendingSync(localPending)
        }
      } catch (err) {
        console.error('❌ [HomePage] Error fetching stats:', err)
      } finally {
        setLoading(false)
      }
    }

    fetchStats()

    // Refresh stats every 30 seconds (still useful for queue / online toggles)
    const interval = setInterval(fetchStats, 30000)
    return () => clearInterval(interval)
  }, [user?.store_id, fromDate, toDate, isOnline])

  const handlePresetChange = (preset: DateRangePreset) => {
    setDateRangePreset(preset)
    const todayDate = new Date()
    
    switch (preset) {
      case 'today': {
        const todayStr = todayDate.toISOString().split('T')[0]
        setFromDate(todayStr)
        setToDate(todayStr)
        break
      }
      case 'yesterday': {
        const yesterday = new Date(todayDate)
        yesterday.setDate(yesterday.getDate() - 1)
        const yesterdayStr = yesterday.toISOString().split('T')[0]
        setFromDate(yesterdayStr)
        setToDate(yesterdayStr)
        break
      }
      case 'last7': {
        const last7 = new Date(todayDate)
        last7.setDate(last7.getDate() - 6)
        setFromDate(last7.toISOString().split('T')[0])
        setToDate(todayDate.toISOString().split('T')[0])
        break
      }
      case 'last30': {
        const last30 = new Date(todayDate)
        last30.setDate(last30.getDate() - 29)
        setFromDate(last30.toISOString().split('T')[0])
        setToDate(todayDate.toISOString().split('T')[0])
        break
      }
      case 'custom': {
        setTempFromDate(fromDate)
        setTempToDate(toDate)
        setShowCustomModal(true)
        break
      }
    }
  }

  const handleCustomRangeApply = () => {
    setDateError('')
    
    // Validation
    if (!tempFromDate || !tempToDate) {
      setDateError('Both dates are required')
      return
    }
    
    if (tempFromDate > tempToDate) {
      setDateError('From date must be before To date')
      return
    }
    
    if (tempToDate > today) {
      setDateError('Cannot select future dates')
      return
    }
    
    // Check 35 day limit
    const from = new Date(tempFromDate)
    const to = new Date(tempToDate)
    const diffDays = Math.floor((to.getTime() - from.getTime()) / (1000 * 60 * 60 * 24))
    
    if (diffDays > 35) {
      setDateError('Date range cannot exceed 35 days')
      return
    }
    
    // Apply custom range
    setFromDate(tempFromDate)
    setToDate(tempToDate)
    setShowCustomModal(false)
  }

  const getDateRangeLabel = () => {
    if (fromDate === toDate) {
      return new Date(fromDate).toLocaleDateString('en-IN', { 
        day: 'numeric', 
        month: 'short', 
        year: 'numeric' 
      })
    }
    return `${new Date(fromDate).toLocaleDateString('en-IN', { 
      day: 'numeric', 
      month: 'short' 
    })} - ${new Date(toDate).toLocaleDateString('en-IN', { 
      day: 'numeric', 
      month: 'short', 
      year: 'numeric' 
    })}`
  }

  const salesLabel = isOnline
    ? `Sales (${getDateRangeLabel()})`
    : offlineQueueSalesTotal > 0
      ? 'Offline Sales (queued)'
      : 'Offline Sales'

  const salesValue = loading
    ? '...'
    : isOnline
      ? `₹${salesTotal.toFixed(2)}`
      : offlineQueueSalesTotal > 0
        ? `₹${offlineQueueSalesTotal.toFixed(2)}`
        : 'Connect to internet to load sales'

  const quickStats = [
    {
      id: 'today-sales',
      icon: isOnline ? '💰' : '📴',
      label: salesLabel,
      value: salesValue,
      bgColor: isOnline ? '#ecfdf5' : '#fef3c7',
      iconColor: isOnline ? '#059669' : '#b45309',
    },
    {
      id: 'total-items',
      icon: '📦',
      label: isOnline ? 'Total Products' : 'Total Products (from cache)',
      value: loading ? '...' : totalProducts.toString(),
      bgColor: '#eff6ff',
      iconColor: '#2563eb',
    },
    {
      id: 'pending-sync',
      icon: '🔄',
      label: 'Pending Sync',
      value: loading ? '...' : pendingSync.toString(),
      bgColor: pendingSync > 0 ? '#fef3c7' : '#ecfdf5',
      iconColor: pendingSync > 0 ? '#d97706' : '#059669',
    },
  ]

  return (
    <div className="home-page">
      <div className="home-header">
        <div>
          <h1 className="home-title">
            Welcome back, {user?.first_name}! 👋
          </h1>
          <p className="home-subtitle">
            {isOnline
              ? "Here's what's happening with your store."
              : 'Offline mode — using cached data. Connect to sync latest sales.'}
          </p>
        </div>
      </div>

      {/* Date Range Filter (still visible offline for UI consistency, but only affects online queries) */}
      <div className="date-range-filter">
        <div className="filter-label">📅 Date Range:</div>
        <div className="filter-buttons">
          <button
            onClick={() => handlePresetChange('today')}
            className={`filter-btn ${dateRangePreset === 'today' ? 'active' : ''}`}
          >
            Today
          </button>
          <button
            onClick={() => handlePresetChange('yesterday')}
            className={`filter-btn ${dateRangePreset === 'yesterday' ? 'active' : ''}`}
            disabled={!isOnline}
            title={!isOnline ? 'Change range requires online data' : ''}
          >
            Yesterday
          </button>
          <button
            onClick={() => handlePresetChange('last7')}
            className={`filter-btn ${dateRangePreset === 'last7' ? 'active' : ''}`}
            disabled={!isOnline}
            title={!isOnline ? 'Change range requires online data' : ''}
          >
            Last 7 Days
          </button>
          <button
            onClick={() => handlePresetChange('last30')}
            className={`filter-btn ${dateRangePreset === 'last30' ? 'active' : ''}`}
            disabled={!isOnline}
            title={!isOnline ? 'Change range requires online data' : ''}
          >
            Last 30 Days
          </button>
          <button
            onClick={() => handlePresetChange('custom')}
            className={`filter-btn custom ${dateRangePreset === 'custom' ? 'active' : ''}`}
            disabled={!isOnline}
            title={!isOnline ? 'Custom range requires online data' : ''}
          >
            Custom Range
          </button>
        </div>
      </div>

      <div className="quick-stats">
        {quickStats.map((stat) => (
          <div
            key={stat.id}
            className="stat-card"
            style={{ background: stat.bgColor }}
          >
            <div
              className="stat-icon"
              style={{ color: stat.iconColor }}
            >
              {stat.icon}
            </div>
            <div className="stat-content">
              <div className="stat-label">{stat.label}</div>
              <div className="stat-value">{stat.value}</div>
            </div>
          </div>
        ))}
      </div>

      <div className="quick-actions">
        <h2 className="section-title">Quick Actions</h2>
        <div className="action-cards">
          <button
            onClick={() => navigate('/billing')}
            className="action-card primary"
          >
            <span className="action-icon">🧾</span>
            <div className="action-content">
              <div className="action-title">Start Billing</div>
              <div className="action-description">
                Create new sale and process payment
              </div>
            </div>
            <span className="action-arrow">→</span>
          </button>

          <button className="action-card disabled" disabled>
            <span className="action-icon">📊</span>
            <div className="action-content">
              <div className="action-title">View Reports</div>
              <div className="action-description">
                Coming soon...
              </div>
            </div>
          </button>

          <button className="action-card disabled" disabled>
            <span className="action-icon">📦</span>
            <div className="action-content">
              <div className="action-title">Manage Products</div>
              <div className="action-description">
                Coming soon...
              </div>
            </div>
          </button>
        </div>
      </div>

      {/* Custom Date Range Modal */}
      {showCustomModal && (
        <div className="modal-overlay" onClick={() => setShowCustomModal(false)}>
          <div className="date-modal" onClick={(e) => e.stopPropagation()}>
            <h3 className="modal-title">Select Custom Date Range</h3>
            
            <div className="date-inputs">
              <div className="date-input-group">
                <label>From Date:</label>
                <input
                  type="date"
                  value={tempFromDate}
                  onChange={(e) => setTempFromDate(e.target.value)}
                  min={minDateStr}
                  max={today}
                  className="date-input"
                />
              </div>

              <div className="date-input-group">
                <label>To Date:</label>
                <input
                  type="date"
                  value={tempToDate}
                  onChange={(e) => setTempToDate(e.target.value)}
                  min={minDateStr}
                  max={today}
                  className="date-input"
                />
              </div>
            </div>

            {dateError && (
              <div className="date-error">⚠️ {dateError}</div>
            )}

            <div className="date-info">
              ℹ️ Maximum 35 days range • No future dates
            </div>

            <div className="modal-actions">
              <button
                onClick={() => {
                  setShowCustomModal(false)
                  setDateError('')
                }}
                className="btn-secondary"
              >
                Cancel
              </button>
              <button
                onClick={handleCustomRangeApply}
                className="btn-primary"
              >
                Apply Range
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
