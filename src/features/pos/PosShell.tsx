import { Route, Routes } from 'react-router-dom';
import { PosProvider } from './PosContext';
import { PosLayout } from './PosLayout';
import { BoardPage } from './BoardPage';
import { OrdersPage } from './OrdersPage';
import { NewOrderPage } from './NewOrderPage';
import { OrderDetailPage } from './OrderDetailPage';
import { MenuAdminPage } from './MenuAdminPage';
import { TablesPage } from './TablesPage';
import { PaymentsPage } from './PaymentsPage';
import { CustomersPage } from './CustomersPage';
import { ReportsPage } from './ReportsPage';
import { SettingsPage } from './SettingsPage';

export default function PosShell() {
  return (
    <PosProvider>
      <Routes>
        <Route element={<PosLayout />}>
          <Route index element={<BoardPage />} />
          <Route path="orders" element={<OrdersPage />} />
          <Route path="orders/new" element={<NewOrderPage />} />
          <Route path="orders/:id" element={<OrderDetailPage />} />
          <Route path="menu" element={<MenuAdminPage />} />
          <Route path="tables" element={<TablesPage />} />
          <Route path="payments" element={<PaymentsPage />} />
          <Route path="customers" element={<CustomersPage />} />
          <Route path="reports" element={<ReportsPage />} />
          <Route path="settings" element={<SettingsPage />} />
        </Route>
      </Routes>
    </PosProvider>
  );
}
