// src/components/SyncQueue/SyncQueueViewer.tsx
import React, { useState, useEffect } from 'react'
import { getQueue, removeQueueItem, type QueueItem } from '@/services/localQueue'
import { runSyncOnce } from '@/services/syncService'
import './SyncQueueViewer.css'

interface SyncQueueViewerProps {
  onClose: () => void
}

export const SyncQueueViewer: React.FC<SyncQueueViewerProps> = ({ onClose }) => {
  const [queueItems, setQueueItems] = useState<QueueItem[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedItem, setSelectedItem] = useState<QueueItem | null>(null)
  const [syncing, setSyncing] = useState(false)

  const loadQueue = async () => {
    try {
      setLoading(true)
      const items = await getQueue(true) // Only unsynced items
      const salesOnly = items.filter((item) => item.type === 'sale')
      setQueueItems(salesOnly)
    } catch (err) {
      console.error('Error loading queue:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadQueue()
  }, [])

  const handleSyncNow = async () => {
    setSyncing(true)
    try {
      await runSyncOnce()
      await loadQueue() // Refresh after sync
      alert('Sync completed! Check the queue for remaining items.')
    } catch (err) {
      console.error('Sync error:', err)
      alert('Sync failed. Check console for details.')
    } finally {
      setSyncing(false)
    }
  }

  const handleDeleteItem = async (itemId: string) => {
    if (!confirm('Are you sure you want to delete this pending sale?')) return
    
    try {
      await removeQueueItem(itemId)
      await loadQueue()
      setSelectedItem(null)
      alert('Sale removed from queue')
    } catch (err) {
      console.error('Error deleting item:', err)
      alert('Failed to delete item')
    }
  }

  const formatDate = (isoString: string) => {
    const date = new Date(isoString)
    return date.toLocaleString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    })
  }

  const formatCurrency = (amount: number) => {
    return `₹${amount.toFixed(2)}`
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="sync-queue-modal" onClick={(e) => e.stopPropagation()}>
        <div className="sync-queue-header">
          <h2>Pending Sales Queue</h2>
          <button className="close-btn" onClick={onClose}>
            ✕
          </button>
        </div>

        <div className="sync-queue-actions">
          <button
            className="btn btn-primary"
            onClick={handleSyncNow}
            disabled={syncing || queueItems.length === 0}
          >
            {syncing ? 'Syncing...' : `Sync Now (${queueItems.length} items)`}
          </button>
          <button className="btn btn-secondary" onClick={loadQueue}>
            Refresh
          </button>
        </div>

        {loading ? (
          <div className="loading-state">Loading queue...</div>
        ) : queueItems.length === 0 ? (
          <div className="empty-state">
            <p>✅ No pending sales in queue</p>
            <p className="empty-subtitle">All sales have been synced successfully</p>
          </div>
        ) : (
          <div className="sync-queue-content">
            <div className="queue-list">
              <h3>Pending Sales ({queueItems.length})</h3>
              {queueItems.map((item) => (
                <div
                  key={item.id}
                  className={`queue-item ${selectedItem?.id === item.id ? 'active' : ''}`}
                  onClick={() => setSelectedItem(item)}
                >
                  <div className="queue-item-header">
                    <span className="sale-number">
                      {item.payload.sale_number || 'N/A'}
                    </span>
                    <span className="sale-amount">
                      {formatCurrency(item.payload.total || 0)}
                    </span>
                  </div>
                  <div className="queue-item-meta">
                    <span className="sale-date">
                      {formatDate(item.created_at)}
                    </span>
                    <span className="attempts-badge">
                      Attempts: {item.attempts}
                    </span>
                  </div>
                  {item.last_error && (
                    <div className="error-badge">
                      Error: {item.last_error}
                    </div>
                  )}
                </div>
              ))}
            </div>

            <div className="queue-details">
              {selectedItem ? (
                <>
                  <h3>Sale Details</h3>
                  <div className="detail-section">
                    <div className="detail-row">
                      <span className="label">Sale Number:</span>
                      <span className="value">
                        {selectedItem.payload.sale_number}
                      </span>
                    </div>
                    <div className="detail-row">
                      <span className="label">Sale Date:</span>
                      <span className="value">
                        {selectedItem.payload.sale_date}
                      </span>
                    </div>
                    <div className="detail-row">
                      <span className="label">Created At:</span>
                      <span className="value">
                        {formatDate(selectedItem.created_at)}
                      </span>
                    </div>
                    <div className="detail-row">
                      <span className="label">Cashier:</span>
                      <span className="value">
                        {selectedItem.payload.cashier_name}
                      </span>
                    </div>
                    <div className="detail-row">
                      <span className="label">Payment Method:</span>
                      <span className="value">
                        {selectedItem.payload.payment_method?.toUpperCase()}
                      </span>
                    </div>
                    <div className="detail-row">
                      <span className="label">Sync Attempts:</span>
                      <span className="value">{selectedItem.attempts}</span>
                    </div>
                  </div>

                  <h4>Items ({selectedItem.payload.items?.length || 0})</h4>
                  <table className="items-table">
                    <thead>
                      <tr>
                        <th>Product</th>
                        <th>SKU</th>
                        <th>Qty</th>
                        <th>Price</th>
                        <th>Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {selectedItem.payload.items?.map((item: any, idx: number) => (
                        <tr key={idx}>
                          <td>{item.name}</td>
                          <td>{item.sku}</td>
                          <td>{item.quantity}</td>
                          <td>{formatCurrency(item.mrp)}</td>
                          <td>{formatCurrency(item.total)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>

                  <div className="detail-section totals">
                    <div className="detail-row">
                      <span className="label">Subtotal:</span>
                      <span className="value">
                        {formatCurrency(selectedItem.payload.subtotal)}
                      </span>
                    </div>
                    <div className="detail-row">
                      <span className="label">Discount:</span>
                      <span className="value">
                        -{formatCurrency(selectedItem.payload.discount || 0)}
                      </span>
                    </div>
                    <div className="detail-row">
                      <span className="label">Tax:</span>
                      <span className="value">
                        {formatCurrency(selectedItem.payload.tax)}
                      </span>
                    </div>
                    <div className="detail-row total-row">
                      <span className="label">Total:</span>
                      <span className="value">
                        {formatCurrency(selectedItem.payload.total)}
                      </span>
                    </div>
                  </div>

                  {selectedItem.last_error && (
                    <div className="error-section">
                      <h4>Last Error</h4>
                      <p className="error-message">{selectedItem.last_error}</p>
                    </div>
                  )}

                  <div className="detail-actions">
                    <button
                      className="btn btn-danger"
                      onClick={() => handleDeleteItem(selectedItem.id)}
                    >
                      Delete from Queue
                    </button>
                  </div>
                </>
              ) : (
                <div className="no-selection">
                  <p>Select a sale to view details</p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
