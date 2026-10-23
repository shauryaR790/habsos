import { Outlet, useLocation } from 'react-router-dom';

const FLOW_PREFIXES = ['/cart', '/checkout', '/order/'];

/** Mobile full-screen cart / checkout / order enter motion. */
export function GuestFlowOutlet() {
  const { pathname } = useLocation();
  const animate = FLOW_PREFIXES.some((prefix) => pathname.startsWith(prefix));

  return (
    <div className={animate ? 'ad-guest-flow-route ad-guest-flow-route--in' : 'ad-guest-flow-route'}>
      <Outlet />
    </div>
  );
}
