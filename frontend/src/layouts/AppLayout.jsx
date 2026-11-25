import React, { useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const NAV_ITEMS = {
  admin: [
    { to: '/dashboard', label: 'Dashboard' },
    { to: '/master-data', label: 'Master Data' },
    { to: '/bom', label: 'Bill of Materials (BOM)' },
    { to: '/admin-orders', label: 'Sales Orders & Dispatch' },
    { to: '/invoices', label: 'GST Invoices' },
    { to: '/payments', label: 'Payments & Outstanding' },
    { to: '/inventory', label: 'Inventory & Stock Ledger' },
    { to: '/reports', label: 'Reports & Exports' },
  ],
  salesman: [
    { to: '/dashboard', label: 'Dashboard' },
    { to: '/salesman-orders', label: 'Place Order & My Orders' },
    { to: '/products-catalog', label: 'Products & Prices' },
  ],
  production: [
    { to: '/dashboard', label: 'Dashboard' },
    { to: '/purchases', label: 'Raw Material Purchases' },
    { to: '/bom', label: 'View Product BOM' },
    { to: '/production', label: 'Production & Costing' },
    { to: '/inventory', label: 'Inventory & Stock Ledger' },
  ],
  auditor: [
    { to: '/dashboard', label: 'Dashboard' },
    { to: '/reports', label: 'Audit Reports & Exports' },
  ],
};

export default function AppLayout({ title, children }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);

  const items = NAV_ITEMS[user?.role] || [];

  function handleLogout() {
    logout();
    navigate('/login');
  }

  return (
    <div className="app-shell">
      <aside className={`sidebar ${menuOpen ? 'open' : ''}`}>
        <div className="sidebar-brand">
          <h2>Kaveri Snacks</h2>
          <span>Order-to-Audit System</span>
        </div>
        <nav className="sidebar-nav">
          {items.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}
              onClick={() => setMenuOpen(false)}
            >
              {item.label}
            </NavLink>
          ))}
        </nav>
      </aside>

      <div className="main-area">
        <header className="topbar">
          <div className="topbar-left">
            <button
              type="button"
              className="menu-toggle"
              onClick={() => setMenuOpen((o) => !o)}
            >
              Menu
            </button>
            <strong>{title}</strong>
          </div>
          <div className="topbar-user">
            <span className="role-pill">{user?.role}</span>
            <span>{user?.name}</span>
            <button type="button" className="btn btn-secondary btn-sm" onClick={handleLogout}>
              Logout
            </button>
          </div>
        </header>
        <main className="content">{children}</main>
      </div>
    </div>
  );
}
