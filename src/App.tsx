import { lazy, Suspense, useLayoutEffect } from 'react';
import { BrowserRouter, Route, Routes, useLocation } from 'react-router-dom';
import { ErrorBoundary } from './components/ErrorBoundary';
import { LoadingState } from './components/LoadingState';
import { ToastHost } from './components/Toast';
import { CartProvider } from './features/customer/cart';
import { CartPage } from './features/customer/CartPage';
import { CheckoutPage } from './features/customer/CheckoutPage';
import { GuestExperienceLayout } from './features/customer/GuestExperienceLayout';
import { HeroPage } from './features/customer/HeroPage';
import { MenuPage } from './features/customer/MenuPage';
import { OrderPage } from './features/customer/OrderPage';
import { TableQrPage } from './features/customer/TableQrPage';
import { LoginPage } from './features/pos/LoginPage';
import { resetScrollLock } from './lib/scrollLock';

const PosShell = lazy(() => import('./features/pos/PosShell'));

function clearDocumentScrollLock() {
  resetScrollLock();
  const root = document.getElementById('root');
  for (const el of [document.documentElement, document.body, root]) {
    if (!el) continue;
    el.style.removeProperty('overflow');
    el.style.removeProperty('height');
    el.style.removeProperty('max-height');
  }
}

function ScrollUnlock() {
  const { pathname } = useLocation();
  useLayoutEffect(() => {
    clearDocumentScrollLock();
  }, [pathname]);
  return null;
}

export function App() {
  return (
    <ErrorBoundary>
      <BrowserRouter>
        <ScrollUnlock />
        <ToastHost />
        <CartProvider>
          <Routes>
            <Route path="/qr/:code" element={<TableQrPage />} />
            <Route element={<GuestExperienceLayout />}>
              <Route path="/" element={<HeroPage />} />
              <Route path="/menu" element={<MenuPage />} />
              <Route path="/cart" element={<CartPage />} />
              <Route path="/checkout" element={<CheckoutPage />} />
            </Route>
            <Route path="/order/:id" element={<OrderPage />} />
            <Route path="/pos/login" element={<LoginPage />} />
            <Route path="/pos/*" element={<Suspense fallback={<div className="o-screen-state"><LoadingState label="Loading" /></div>}><PosShell /></Suspense>} />
            <Route path="*" element={<main className="cust narrow"><h1>Page not found</h1></main>} />
          </Routes>
        </CartProvider>
      </BrowserRouter>
    </ErrorBoundary>
  );
}
