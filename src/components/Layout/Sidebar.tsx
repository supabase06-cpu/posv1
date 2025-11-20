// src/components/Layout/Sidebar.tsx
import React from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import './Sidebar.css'

interface SidebarProps {
  onNavigate?: (path: string) => void
}

export const Sidebar: React.FC<SidebarProps> = ({ onNavigate }) => {
  const navigate = useNavigate()
  const location = useLocation()

  const menuItems = [
    {
      id: 'home',
      path: '/',
      icon: '🏠',
      label: 'Home',
      active: location.pathname === '/',
    },
    {
      id: 'billing',
      path: '/billing',
      icon: '🧾',
      label: 'Billing',
      active: location.pathname === '/billing',
    },
  ]

  const handleNavigation = (path: string) => {
    navigate(path)
    if (onNavigate) {
      onNavigate(path)
    }
  }

  return (
    <aside className="pos-sidebar">
      <nav className="sidebar-nav">
        {menuItems.map((item) => (
          <button
            key={item.id}
            onClick={() => handleNavigation(item.path)}
            className={`sidebar-item ${item.active ? 'active' : ''}`}
          >
            <span className="sidebar-icon">{item.icon}</span>
            <span className="sidebar-label">{item.label}</span>
          </button>
        ))}
      </nav>
    </aside>
  )
}
