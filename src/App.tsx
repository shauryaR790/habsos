import { lazy, Suspense } from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { ErrorBoundary } from './components/ErrorBoundary';
import { LoadingState } from './components/LoadingState';
import { ToastHost } from './components/Toast';
import { CartProvider } from './features/customer/cart';
import { CartPage } from './features/customer/CartPage';
import { CheckoutPage } from './features/customer/CheckoutPage';
import { MenuPage } from './features/customer/MenuPage';
import { OrderPage } from './features/customer/OrderPage';
import { LoginPage } from './features/pos/LoginPage';

const PosShell = lazy(() => import('./features/pos/PosShell'));

export function App() {
  return (
    <ErrorBoundary>
      <BrowserRouter>
        <ToastHost />
        <CartProvider>
          <Routes>
            <Route path="/" element={<Navigate to="/menu" replace />} />
            <Route path="/menu" element={<MenuPage />} />
            <Route path="/cart" element={<CartPage />} />
            <Route path="/checkout" element={<CheckoutPage />} />
            <Route path="/order/:id" element={<OrderPage />} />
            <Route path="/pos/login" element={<LoginPage />} />
            <Route path="/pos/*" element={<Suspense fallback={<div className="login"><LoadingState label="Loading POS" /></div>}><PosShell /></Suspense>} />
            <Route path="*" element={<main className="cust narrow"><h1>Page not found</h1></main>} />
          </Routes>
        </CartProvider>
      </BrowserRouter>
    </ErrorBoundary>
  );
}
