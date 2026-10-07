import { Route, Routes } from 'react-router-dom';
import { PosProvider } from './PosContext';
import { PosLayout } from './PosLayout';
import { TablesPage } from './TablesPage';
import { OrdersPage } from './OrdersPage';
import { NewOrderPage } from './NewOrderPage';
import { OrderDetailPage } from './OrderDetailPage';
import { MenuAdminPage } from './MenuAdminPage';
import { PaymentsPage } from './PaymentsPage';
import { CustomersPage } from './CustomersPage';
import { ReportsPage } from './ReportsPage';
import { SettingsPage } from './SettingsPage';
import { InventoryPage } from './InventoryPage';

export default function PosShell() {
  return (
    <PosProvider>
      <Routes>
        <Route element={<PosLayout />}>
          <Route index element={<TablesPage />} />
          <Route path="tables" element={<TablesPage />} />
          <Route path="orders" element={<OrdersPage />} />
          <Route path="orders/new" element={<NewOrderPage />} />
          <Route path="orders/:id" element={<OrderDetailPage />} />
          <Route path="menu" element={<MenuAdminPage />} />
          <Route path="payments" element={<PaymentsPage />} />
          <Route path="customers" element={<CustomersPage />} />
          <Route path="reports" element={<ReportsPage />} />
          <Route path="inventory" element={<InventoryPage />} />
          <Route path="settings" element={<SettingsPage />} />
        </Route>
      </Routes>
    </PosProvider>
  );
}
