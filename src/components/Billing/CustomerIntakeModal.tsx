// src/components/Billing/CustomerIntakeModal.tsx
import React, { useState } from 'react'
import { CustomerSearch } from './CustomerSearch'
import type { Database } from '@/types/database'
import './CustomerIntakeModal.css'

type Customer = Database['public']['Tables']['customers']['Row']

export interface CustomerData {
  name: string
  phone: string
  email: string
  skipped: boolean
}

interface CustomerIntakeModalProps {
  onSubmit: (customerData: CustomerData) => void
  onSkip: () => void
  onCancel: () => void
  storeId: string
}

export const CustomerIntakeModal: React.FC<CustomerIntakeModalProps> = ({
  onSubmit,
  onSkip,
  onCancel,
  storeId,
}) => {
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSelectCustomer = (customer: Customer) => {
    setName(customer.customer_name)
    setPhone(customer.phone || '')
    setEmail(customer.email || '')
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    if (!name.trim()) {
      alert('Please enter customer name')
      setLoading(false)
      return
    }

    onSubmit({
      name: name.trim(),
      phone: phone.trim() || '',
      email: email.trim() || '',
      skipped: false,
    })
  }

  const handleSkip = () => {
    onSkip()
  }

  return (
    <div className="modal-overlay" onClick={onCancel}>
      <div className="customer-intake-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Customer Information</h2>
          <button className="close-btn" onClick={onCancel}>
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit} className="customer-form">
          <div className="form-section">
            <label className="section-label">Search Existing Customer</label>
            <CustomerSearch storeId={storeId} onSelectCustomer={handleSelectCustomer} />
          </div>

          <div className="form-divider">
            <span>OR ENTER NEW CUSTOMER</span>
          </div>

          <div className="form-group">
            <label htmlFor="phone">
              Phone Number <span className="optional">(Optional)</span>
            </label>
            <input
              type="tel"
              id="phone"
              value={phone}
              onChange={(e) => setPhone(e.target.value.replace(/[^0-9]/g, ''))}
              placeholder="Enter 10-digit mobile number"
              maxLength={10}
              className="form-input"
            />
          </div>

          <div className="form-group">
            <label htmlFor="name">
              Customer Name <span className="required">*</span>
            </label>
            <input
              type="text"
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Enter customer name"
              className="form-input"
              required
            />
          </div>

          <div className="form-group">
            <label htmlFor="email">
              Email <span className="optional">(Optional)</span>
            </label>
            <input
              type="email"
              id="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Enter email address"
              className="form-input"
            />
          </div>

          <div className="form-actions">
            <button
              type="button"
              onClick={handleSkip}
              className="btn btn-secondary btn-skip"
            >
              Skip
            </button>
            <button
              type="submit"
              disabled={loading || !name.trim()}
              className="btn btn-primary btn-submit"
            >
              {loading ? 'Saving...' : 'Continue'}
            </button>
          </div>
        </form>

        <p className="info-text">
          💡 Customer information is optional. You can skip this step.
        </p>
      </div>
    </div>
  )
}
