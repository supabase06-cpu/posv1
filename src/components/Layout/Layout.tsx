// src/components/Layout/Layout.tsx
import React from 'react'
import { Header } from './Header'
import { Sidebar } from './Sidebar'
import './Layout.css'

interface LayoutProps {
  children: React.ReactNode
  onLogout: () => void
}

export const Layout: React.FC<LayoutProps> = ({ children, onLogout }) => {
  return (
    <div className="pos-layout">
      <Header onLogout={onLogout} />
      <div className="layout-body">
        <Sidebar />
        <main className="layout-main">
          {children}
        </main>
      </div>
    </div>
  )
}
