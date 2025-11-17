import React, { useState } from 'react'
import { useAuth } from '@/hooks/useAuth'
import './LoginScreen.css'

interface LoginScreenProps {
  onLoginSuccess?: () => void
}

export const LoginScreen: React.FC<LoginScreenProps> = ({ onLoginSuccess }) => {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)

  const { isLoading, error, login } = useAuth()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    // Validation
    if (!email.trim()) {
      setFormError('Email is required')
      return
    }

    if (!password.trim()) {
      setFormError('Password is required')
      return
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setFormError('Please enter a valid email')
      return
    }

    setFormError(null)

    // Login
    const result = await login(email, password)

    if (result.success) {
      // Clear form
      setEmail('')
      setPassword('')
      setFormError(null)

      // Call success callback
      if (onLoginSuccess) {
        onLoginSuccess()
      }
    } else {
      setFormError(result.error || 'Login failed')
    }
  }

  return (
    <div className="login-container">
      <div className="login-box">
        {/* Header */}
        <div className="login-header">
          <h1>POS System</h1>
          <p>Supermarket Management</p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="login-form">
          {/* Email Input */}
          <div className="form-group">
            <label htmlFor="email">Email Address</label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Enter your email"
              className="form-input"
              disabled={isLoading}
              autoFocus
            />
          </div>

          {/* Password Input */}
          <div className="form-group">
            <label htmlFor="password">Password</label>
            <div className="password-input-wrapper">
              <input
                id="password"
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter your password"
                className="form-input"
                disabled={isLoading}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="password-toggle"
                disabled={isLoading}
              >
                {showPassword ? '👁️' : '👁️‍🗨️'}
              </button>
            </div>
          </div>

          {/* Error Messages */}
          {(formError || error) && (
            <div className="error-alert">
              <p>{formError || error}</p>
            </div>
          )}

          {/* Submit Button */}
          <button type="submit" className="btn-login" disabled={isLoading}>
            {isLoading ? 'Logging in...' : 'Login'}
          </button>
        </form>

        {/* Footer */}
        <div className="login-footer">
          <p>
            © 2025 Sattva Tech Solutions | Supermarket POS System v1.0
          </p>
        </div>
      </div>
    </div>
  )
}
