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
import { StocImportPage } from './pages/StocImportPage';
import QRLocationsPage from './pages/QRLocationsPage';
import ReceptieMarfaPage from './pages/ReceptieMarfaPage';
import ComenziFurnizorPage from './pages/ComenziFurnizorPage';
import ReceptieNIRPage from './pages/ReceptieNIRPage';
import PutawayTasksPage from './pages/PutawayTasksPage';
import PalletsPage from './pages/PalletsPage';
import PickNotesPage from './pages/PickNotesPage';
import LivrarePage from './pages/LivrarePage';
import BatchLabelsPage from './pages/BatchLabelsPage';
import InventoryMovementsPage from './pages/InventoryMovementsPage';
import StockReportsPage from './pages/StockReportsPage';
import PerformancePage from './pages/PerformancePage';
import PredictionsPage from './pages/PredictionsPage';
import RulesValidationPage from './pages/RulesValidationPage';
import ConfigValidatorPage from './pages/ConfigValidatorPage';
import LocationCapacitiesPage from './pages/LocationCapacitiesPage';
import LocationTypesPage from './pages/LocationTypesPage';
import PackagingTypesPage from './pages/PackagingTypesPage';
import PutawayRulesPage from './pages/PutawayRulesPage';
import WarehouseSetupWizardPage from './pages/WarehouseSetupWizardPage';
import WarehouseTemplatesPage from './pages/WarehouseTemplatesPage';
import SimulatorPage from './pages/SimulatorPage';
import DynamicRulesPage from './pages/DynamicRulesPage';
import ActivityLogPage from './pages/ActivityLogPage';
import StockAlertsPage from './pages/StockAlertsPage';
import ERPIntegrationPage from './pages/ERPIntegrationPage';
import { TutorialProvider } from './contexts/TutorialContext';
import TutorialOverlay from './components/TutorialOverlay';
import theme from './theme';

function App() {
  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <AuthProvider>
        <BrowserRouter>
          <TutorialProvider>
            <TutorialOverlay />
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
            <Route
              path="/import-stoc"
              element={
                <ProtectedRoute roles={['admin','manager']}>
                  <Layout>
                    <StocImportPage />
                  </Layout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/qr-locatii"
              element={
                <ProtectedRoute roles={['admin','manager']}>
                  <Layout>
                    <QRLocationsPage />
                  </Layout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/receptie"
              element={
                <ProtectedRoute roles={['admin','manager','operator']}>
                  <Layout>
                    <ReceptieMarfaPage />
                  </Layout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/comenzi-furnizor"
              element={
                <ProtectedRoute roles={['admin','manager']}>
                  <Layout>
                    <ComenziFurnizorPage />
                  </Layout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/receptie-nir"
              element={
                <ProtectedRoute roles={['admin','manager','operator']}>
                  <Layout>
                    <ReceptieNIRPage />
                  </Layout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/putaway-tasks"
              element={
                <ProtectedRoute roles={['admin','manager','operator']}>
                  <Layout>
                    <PutawayTasksPage />
                  </Layout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/pallets"
              element={
                <ProtectedRoute roles={['admin','manager','operator']}>
                  <Layout>
                    <PalletsPage />
                  </Layout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/note-culegere"
              element={
                <ProtectedRoute roles={['admin','manager','operator']}>
                  <Layout>
                    <PickNotesPage />
                  </Layout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/livrare"
              element={
                <ProtectedRoute roles={['admin','manager','operator']}>
                  <Layout>
                    <LivrarePage />
                  </Layout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/etichete-loturi"
              element={
                <ProtectedRoute roles={['admin','manager','operator']}>
                  <Layout>
                    <BatchLabelsPage />
                  </Layout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/rapoarte-miscari"
              element={
                <ProtectedRoute roles={['admin','manager']}>
                  <Layout>
                    <InventoryMovementsPage />
                  </Layout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/rapoarte-stoc"
              element={
                <ProtectedRoute roles={['admin','manager']}>
                  <Layout>
                    <StockReportsPage />
                  </Layout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/rapoarte-performanta"
              element={
                <ProtectedRoute roles={['admin','manager']}>
                  <Layout>
                    <PerformancePage />
                  </Layout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/rapoarte-predictii"
              element={
                <ProtectedRoute roles={['admin','manager']}>
                  <Layout>
                    <PredictionsPage />
                  </Layout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/validare-configuratie"
              element={
                <ProtectedRoute roles={['admin','manager']}>
                  <Layout>
                    <RulesValidationPage />
                  </Layout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/validator-configurare"
              element={
                <ProtectedRoute roles={['admin','manager']}>
                  <Layout>
                    <ConfigValidatorPage />
                  </Layout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/capacitati-locatii"
              element={
                <ProtectedRoute roles={['admin','manager']}>
                  <Layout>
                    <LocationCapacitiesPage />
                  </Layout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/tipuri-locatii"
              element={
                <ProtectedRoute roles={['admin','manager']}>
                  <Layout>
                    <LocationTypesPage />
                  </Layout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/tipuri-ambalaje"
              element={
                <ProtectedRoute roles={['admin','manager']}>
                  <Layout>
                    <PackagingTypesPage />
                  </Layout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/reguli-putaway"
              element={
                <ProtectedRoute roles={['admin','manager']}>
                  <Layout>
                    <PutawayRulesPage />
                  </Layout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/wizard-configurare"
              element={
                <ProtectedRoute roles={['admin','manager']}>
                  <Layout>
                    <WarehouseSetupWizardPage />
                  </Layout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/template-depozit"
              element={
                <ProtectedRoute roles={['admin','manager']}>
                  <Layout>
                    <WarehouseTemplatesPage />
                  </Layout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/simulator-wms"
              element={
                <ProtectedRoute roles={['admin','manager']}>
                  <Layout>
                    <SimulatorPage />
                  </Layout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/reguli-dinamice"
              element={
                <ProtectedRoute roles={['admin','manager']}>
                  <Layout>
                    <DynamicRulesPage />
                  </Layout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/audit-activitate"
              element={
                <ProtectedRoute roles={['admin','manager']}>
                  <Layout>
                    <ActivityLogPage />
                  </Layout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/alerte-live"
              element={
                <ProtectedRoute roles={['admin','manager','operator']}>
                  <Layout>
                    <StockAlertsPage />
                  </Layout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/erp-integrare"
              element={
                <ProtectedRoute roles={['admin','manager']}>
                  <Layout>
                    <ERPIntegrationPage />
                  </Layout>
                </ProtectedRoute>
              }
            />
            <Route path="/" element={<Navigate to="/dashboard" replace />} />
          </Routes>
          </TutorialProvider>
        </BrowserRouter>
      </AuthProvider>
    </ThemeProvider>
  );
}

export default App;
