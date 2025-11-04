import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { ThemeProvider } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import { AuthProvider } from './contexts/AuthContext.tsx';
import { ProtectedRoute } from './components/ProtectedRoute';
import { Layout } from './components/Layout';
import { LoginPage } from './pages/LoginPage';
import { DashboardPage } from './pages/DashboardPage';
import { ProductsPage } from './pages/ProductsPage';
import { OrdersPage } from './pages/OrdersPage';
import { UsersPage } from './pages/UsersPage';
import { CuttingOrdersPage } from './pages/CuttingOrdersPage';
import { SewingOrdersPage } from './pages/SewingOrdersPage';
import QCInspectionsPage from './pages/QCInspectionsPage';
import { BatchesPage } from './pages/BatchesPage';
import { TransformationsPage } from './pages/TransformationsPage';
import { ScanPage } from './pages/ScanPage';
import { InitialSetupPage } from './pages/InitialSetupPage';
import { ShipmentsPage } from './pages/ShipmentsPage';
import { ReportsPage } from './pages/ReportsPage';
import { WarehouseConfigPage } from './pages/WarehouseConfigPage';
import PickJobsPage from './pages/PickJobsPage';
import theme from './theme';

function App() {
  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <AuthProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route
              path="/dashboard"
              element={
                <ProtectedRoute>
                  <Layout>
                    <DashboardPage />
                  </Layout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/orders"
              element={
                <ProtectedRoute roles={['admin','manager','operator']}>
                  <Layout>
                    <OrdersPage />
                  </Layout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/products"
              element={
                <ProtectedRoute roles={['admin','manager','operator']}>
                  <Layout>
                    <ProductsPage />
                  </Layout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/utilizatori"
              element={
                <ProtectedRoute roles={['admin']}>
                  <Layout>
                    <UsersPage />
                  </Layout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/cutting"
              element={
                <ProtectedRoute roles={['admin','manager','operator']}>
                  <Layout>
                    <CuttingOrdersPage />
                  </Layout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/sewing"
              element={
                <ProtectedRoute roles={['admin','manager','operator']}>
                  <Layout>
                    <SewingOrdersPage />
                  </Layout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/qc"
              element={
                <ProtectedRoute roles={['admin','manager','operator']}>
                  <Layout>
                    <QCInspectionsPage />
                  </Layout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/batches"
              element={
                <ProtectedRoute roles={['admin','manager','operator']}>
                  <Layout>
                    <BatchesPage />
                  </Layout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/transformations"
              element={
                <ProtectedRoute roles={['admin','manager','operator']}>
                  <Layout>
                    <TransformationsPage />
                  </Layout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/scan"
              element={
                <ProtectedRoute roles={['admin','manager','operator']}>
                  <Layout>
                    <ScanPage />
                  </Layout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/initial-setup"
              element={
                <ProtectedRoute roles={['admin','manager']}>
                  <Layout>
                    <InitialSetupPage />
                  </Layout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/shipments"
              element={
                <ProtectedRoute roles={['admin','manager','operator']}>
                  <Layout>
                    <ShipmentsPage />
                  </Layout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/reports"
              element={
                <ProtectedRoute roles={['admin','manager']}>
                  <Layout>
                    <ReportsPage />
                  </Layout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/warehouse-config"
              element={
                <ProtectedRoute roles={['admin','manager']}>
                  <Layout>
                    <WarehouseConfigPage />
                  </Layout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/pick-jobs"
              element={
                <ProtectedRoute roles={['admin','manager','operator']}>
                  <Layout>
                    <PickJobsPage />
                  </Layout>
                </ProtectedRoute>
              }
            />
            <Route path="/" element={<Navigate to="/dashboard" replace />} />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </ThemeProvider>
  );
}

export default App;
