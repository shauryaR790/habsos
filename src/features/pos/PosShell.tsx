import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { PosProvider } from './PosContext';
import { OdooBackendLayout } from './odoo/OdooBackendLayout';
import { OdooFoHLayout } from './odoo/OdooFoHLayout';
import { DashboardPage } from './odoo/DashboardPage';
import { TablesFloorPage } from './odoo/TablesFloorPage';
import { RegisterPage } from './odoo/RegisterPage';
import { PaymentPage } from './odoo/PaymentPage';
import { OrdersSplitPage } from './odoo/OrdersSplitPage';
import { ProductsKanbanPage } from './odoo/ProductsKanbanPage';
import { ReportingPage } from './odoo/ReportingPage';
import { ConfigPage } from './odoo/ConfigPage';
import { BackendOrdersPage } from './odoo/BackendOrdersPage';
import { BackendSessionsPage } from './odoo/BackendSessionsPage';
import { BackendPlaceholderPage } from './odoo/BackendPlaceholderPage';
import { PreparationDisplayPage } from './odoo/PreparationDisplayPage';
import { PrepScreenPage, OrderStatusScreenPage } from './odoo/PrepScreenPage';
import { CustomerDisplayPage } from './odoo/CustomerDisplayPage';
import { CustomersPage } from './CustomersPage';
import { SettingsPage } from './SettingsPage';
import { InventoryPage } from './InventoryPage';
import { MenuAdminPage } from './MenuAdminPage';

function RedirectRegister() {
  const { search } = useLocation();
  return <Navigate to={`/pos/app/register${search}`} replace />;
}

export default function PosShell() {
  return (
    <PosProvider>
      <Routes>
        <Route element={<OdooBackendLayout />}>
          <Route index element={<DashboardPage />} />
          <Route path="backend/orders" element={<BackendOrdersPage />} />
          <Route path="backend/sessions" element={<BackendSessionsPage />} />
          <Route path="backend/payments" element={<BackendPlaceholderPage title="Payments" />} />
          <Route path="backend/preparation" element={<PreparationDisplayPage />} />
          <Route path="backend/customers" element={<CustomersPage />} />
          <Route path="backend/products" element={<ProductsKanbanPage />} />
          <Route path="backend/reporting" element={<ReportingPage />} />
          <Route path="backend/config" element={<ConfigPage />} />
          <Route path="customers" element={<Navigate to="/pos/backend/customers" replace />} />
          <Route path="inventory" element={<InventoryPage />} />
          <Route path="menu" element={<MenuAdminPage />} />
          <Route path="settings" element={<SettingsPage />} />
          <Route path="reports" element={<Navigate to="/pos/backend/reporting" replace />} />
          <Route path="payments" element={<Navigate to="/pos/backend/payments" replace />} />
        </Route>

        <Route path="prep" element={<PrepScreenPage />} />
        <Route path="prep/status" element={<OrderStatusScreenPage />} />

        <Route path="app" element={<OdooFoHLayout />}>
          <Route index element={<Navigate to="tables" replace />} />
          <Route path="tables" element={<TablesFloorPage />} />
          <Route path="register" element={<RegisterPage />} />
          <Route path="payment" element={<PaymentPage />} />
          <Route path="orders" element={<OrdersSplitPage />} />
          <Route path="customer-display" element={<CustomerDisplayPage />} />
        </Route>

        {/* Legacy paths → Odoo FoH */}
        <Route path="app/floors/edit" element={<Navigate to="/pos/app/tables" replace />} />

        <Route path="tables" element={<Navigate to="/pos/app/tables" replace />} />
        <Route path="orders/new" element={<RedirectRegister />} />
        <Route path="orders" element={<Navigate to="/pos/app/orders" replace />} />
        <Route path="orders/:id" element={<Navigate to="/pos/app/orders" replace />} />
      </Routes>
    </PosProvider>
  );
}
