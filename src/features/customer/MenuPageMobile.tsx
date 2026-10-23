import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { api, ApiError } from '../../lib/api';
import { useTitle } from '../../lib/useTitle';
import { Button } from '../../components/Button';
import { EmptyState } from '../../components/EmptyState';
import { LoadingState } from '../../components/LoadingState';
import { Modal } from '../../components/Modal';
import { useCart, type Bootstrap, type CartLine } from './cart';
import { ItemSheet } from './ItemSheet';
import { EXPLORE_HEAD, RECOMMENDED } from './menuFacts';
import { TableScanner } from './TableScanner';
import { AdBottomNav } from './ad/AdBottomNav';
import { AdMobileShell } from './ad/AdMobileShell';
import { AdProductCard } from './ad/AdProductCard';
import { brewCardStickerForIndex } from './ad/brewCardStickers';
import { useGuestMenuItemDeepLink } from './guestOpenItemLink';

type MenuPageMobileProps = {
  /** Menu block on the single-page mobile landing (hero + menu scroll). */
  landingSection?: boolean;
  menuSectionId?: string;
};

export function MenuPageMobile({ landingSection = false, menuSectionId = 'order-menu' }: MenuPageMobileProps) {
  useTitle(landingSection ? 'After Dunes' : 'Menu');
  const cart = useCart();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [scanning, setScanning] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sheet, setSheet] = useState<{ itemId: string; line?: CartLine } | null>(null);
  const [landingNavVisible, setLandingNavVisible] = useState(!landingSection);

  useEffect(() => {
    if (!landingSection) return;
    const section = document.getElementById(menuSectionId);
    const hero = document.querySelector('.ad-hero-panel');
    if (!section) return;

    const update = () => {
      const heroBottom = hero?.getBoundingClientRect().bottom ?? window.innerHeight;
      const pastHero = heroBottom <= 72;
      const menuTop = section.getBoundingClientRect().top;
      const menuInView = menuTop < window.innerHeight * 0.92;
      setLandingNavVisible(pastHero && menuInView);
    };

    update();
    window.addEventListener('scroll', update, { passive: true });
    window.addEventListener('resize', update);
    const observer = new IntersectionObserver(update, {
      threshold: [0, 0.05, 0.12, 0.2],
      rootMargin: '0px 0px -20% 0px',
    });
    observer.observe(section);
    return () => {
      window.removeEventListener('scroll', update);
      window.removeEventListener('resize', update);
      observer.disconnect();
    };
  }, [landingSection, menuSectionId]);

  async function load() {
    setLoading(true);
    setError(null);
    const requested = params.get('table');
    try {
      const data = await api<Bootstrap>(`/api/bootstrap${requested ? `?table=${encodeURIComponent(requested)}` : ''}`);
      cart.setCatalog(data);
      if (data.table) cart.setTableCode(data.table.name);
      else if (requested) cart.setTableCode(requested);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Menu unavailable.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
    const source = new EventSource('/api/menu/events');
    source.onmessage = (event) => {
      const data = JSON.parse(event.data) as { type?: string; item?: Bootstrap['items'][number]; addon?: { id: string; name: string; price: number; isAvailable: boolean } };
      if (data.type === 'ping') return;
      cart.setCatalog((current) => {
        if (!current) return current;
        if (data.type === 'menu.updated' && data.item) {
          return { ...current, items: current.items.map((item) => (item.id === data.item?.id ? { ...item, ...data.item } : item)) };
        }
        if (data.type === 'addon.updated' && data.addon) {
          return {
            ...current,
            addonGroups: current.addonGroups.map((group) => ({
              ...group,
              addons: group.addons.map((addon) => (addon.id === data.addon?.id ? { ...addon, ...data.addon } : addon)),
            })),
          };
        }
        return current;
      });
    };
    return () => source.close();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params]);

  const onTable = useCallback((code: string) => {
    setScanning(false);
    if (landingSection) {
      navigate(`/?table=${encodeURIComponent(code)}#${menuSectionId}`, { replace: true });
      window.requestAnimationFrame(() => {
        document.getElementById(menuSectionId)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      });
      return;
    }
    navigate(`/menu?table=${encodeURIComponent(code)}`);
  }, [landingSection, menuSectionId, navigate]);

  const catalog = cart.catalog;
  useGuestMenuItemDeepLink(catalog, setSheet);
  const sheetItem = catalog?.items.find((item) => item.id === sheet?.itemId) ?? null;
  const available = catalog?.items.filter((item) => item.isAvailable) ?? [];

  const { dailyBrew, exploreMenu } = useMemo(() => {
    const dailyBrew = RECOMMENDED.map((id) => available.find((item) => item.id === id)).filter(
      (item): item is (typeof available)[number] => Boolean(item),
    );
    const rest = available.filter((item) => !RECOMMENDED.includes(item.id));
    const head = EXPLORE_HEAD.map((id) => rest.find((item) => item.id === id)).filter(
      (item): item is (typeof rest)[number] => Boolean(item),
    );
    const tail = rest.filter((item) => !EXPLORE_HEAD.includes(item.id));
    const explore = [...head, ...tail];
    return {
      dailyBrew,
      exploreMenu: explore.length ? explore : dailyBrew.length ? [] : available,
    };
  }, [available]);

  function openItem(item: Bootstrap['items'][number]) {
    setSheet({ itemId: item.id });
  }

  const shell = (
      <AdMobileShell className="ad-viewport--menu">
        <main id="menu" className="ad-menu-scroll ad-menu-scroll--brew">
          {loading && !catalog ? <LoadingState label="Loading menu" /> : null}
          {error ? <EmptyState title="Menu unavailable" body={error} /> : null}
          {error ? <Button onClick={() => void load()}>Retry</Button> : null}
          {!cart.tableCode && catalog ? (
            <div className="ad-scan-banner">
              <span>Scan the table QR to link your order.</span>
              <button type="button" className="btn" onClick={() => setScanning(true)}>Scan table</button>
            </div>
          ) : null}
          {catalog ? (
            <>
              {dailyBrew.length ? (
                <section className="ad-brew-section" aria-labelledby="ad-brew-daily">
                  <h2 id="ad-brew-daily" className="ad-brew-heading">Desert brews</h2>
                  <div className="ad-brew-grid">
                    {dailyBrew.map((item, index) => (
                      <AdProductCard
                        key={item.id}
                        item={item}
                        onOpen={openItem}
                        onAddToCart={openItem}
                        cornerSticker={brewCardStickerForIndex(index)}
                      />
                    ))}
                  </div>
                </section>
              ) : null}
              <section className="ad-brew-section" aria-labelledby="ad-brew-explore">
                <h2 id="ad-brew-explore" className="ad-brew-heading">The souk</h2>
                {exploreMenu.length ? (
                  <div className="ad-brew-grid">
                    {exploreMenu.map((item, index) => (
                      <AdProductCard
                        key={item.id}
                        item={item}
                        onOpen={openItem}
                        onAddToCart={openItem}
                        cornerSticker={brewCardStickerForIndex(index + dailyBrew.length)}
                      />
                    ))}
                  </div>
                ) : (
                  <p className="ad-menu-empty">Nothing here yet.</p>
                )}
              </section>
            </>
          ) : null}
        </main>
        <AdBottomNav
          active="menu"
          cartTotal={cart.totals?.total ?? null}
          cartCount={cart.count}
          menuAnchor={landingSection ? `#${menuSectionId}` : undefined}
          visible={!sheetItem && (!landingSection || landingNavVisible)}
        />
      </AdMobileShell>
  );

  return (
    <>
      {landingSection ? (
        <section id={menuSectionId} className="ad-menu-landing-section ad-menu-page ad-menu-panel" aria-label="Menu">
          {shell}
        </section>
      ) : (
        <div className="ad-app ad-menu-page ad-menu-panel">
          <a className="skip" href="#menu">Skip to menu</a>
          {shell}
        </div>
      )}
      {sheetItem && catalog ? (
        <ItemSheet
          mobileAd
          item={sheetItem}
          catalog={catalog}
          initial={sheet?.line ? { quantity: sheet.line.quantity, addonIds: sheet.line.addonIds, notes: sheet.line.notes } : undefined}
          onClose={() => setSheet(null)}
          onSave={(value) => {
            cart.addLine({ menuItemId: sheetItem.id, ...value, lineId: sheet?.line?.lineId });
            setSheet(null);
          }}
        />
      ) : null}
      <Modal open={scanning} title="Scan table" onClose={() => setScanning(false)}>
        {scanning ? <TableScanner onTable={onTable} /> : null}
      </Modal>
    </>
  );
}
