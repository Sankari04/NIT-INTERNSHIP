import React from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';
import LoginPage from './pages/LoginPage';
import DashboardPage from './pages/DashboardPage';
import MasterDataPage from './pages/MasterDataPage';
import BomPage from './pages/BomPage';
import SalesmanOrdersPage from './pages/SalesmanOrdersPage';
import ProductsCatalogPage from './pages/ProductsCatalogPage';
import AdminOrdersPage from './pages/AdminOrdersPage';
import PurchasesPage from './pages/PurchasesPage';
import ProductionPage from './pages/ProductionPage';
import InventoryPage from './pages/InventoryPage';
import InvoicesPage from './pages/InvoicesPage';
import PaymentsPage from './pages/PaymentsPage';
import ReportsPage from './pages/ReportsPage';

export default function App() {
  const { user } = useAuth();

  return (
    <Routes>
      <Route path="/login" element={user ? <Navigate to="/dashboard" replace /> : <LoginPage />} />

      <Route
        path="/dashboard"
        element={
          <ProtectedRoute allowedRoles={['admin', 'salesman', 'production', 'auditor']}>
            <DashboardPage />
          </ProtectedRoute>
        }
      />

      <Route
        path="/master-data"
        element={
          <ProtectedRoute allowedRoles={['admin']}>
            <MasterDataPage />
          </ProtectedRoute>
        }
      />

      <Route
        path="/bom"
        element={
          <ProtectedRoute allowedRoles={['admin', 'production']}>
            <BomPage />
          </ProtectedRoute>
        }
      />

      <Route
        path="/salesman-orders"
        element={
          <ProtectedRoute allowedRoles={['salesman']}>
            <SalesmanOrdersPage />
          </ProtectedRoute>
        }
      />

      <Route
        path="/products-catalog"
        element={
          <ProtectedRoute allowedRoles={['salesman']}>
            <ProductsCatalogPage />
          </ProtectedRoute>
        }
      />

      <Route
        path="/admin-orders"
        element={
          <ProtectedRoute allowedRoles={['admin']}>
            <AdminOrdersPage />
          </ProtectedRoute>
        }
      />

      <Route
        path="/purchases"
        element={
          <ProtectedRoute allowedRoles={['production', 'admin']}>
            <PurchasesPage />
          </ProtectedRoute>
        }
      />

      <Route
        path="/production"
        element={
          <ProtectedRoute allowedRoles={['production', 'admin']}>
            <ProductionPage />
          </ProtectedRoute>
        }
      />

      <Route
        path="/inventory"
        element={
          <ProtectedRoute allowedRoles={['admin', 'production']}>
            <InventoryPage />
          </ProtectedRoute>
        }
      />

      <Route
        path="/invoices"
        element={
          <ProtectedRoute allowedRoles={['admin']}>
            <InvoicesPage />
          </ProtectedRoute>
        }
      />

      <Route
        path="/payments"
        element={
          <ProtectedRoute allowedRoles={['admin']}>
            <PaymentsPage />
          </ProtectedRoute>
        }
      />

      <Route
        path="/reports"
        element={
          <ProtectedRoute allowedRoles={['admin', 'auditor']}>
            <ReportsPage />
          </ProtectedRoute>
        }
      />

      <Route path="*" element={<Navigate to={user ? '/dashboard' : '/login'} replace />} />
    </Routes>
  );
}
