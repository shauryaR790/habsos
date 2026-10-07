# Petpooja reference → After Dunes coverage audit

**Audited:** 2026-10-06  
**Reference:** [README.md](./README.md) (46 video frames, ~35 min)  
**Product:** After Dunes POS (`habsos` — Vite/React + Express/SQLite)

## Status legend

| Status | Meaning |
|--------|---------|
| **Implemented** | Matches reference workflow; real persistence/API |
| **Partial** | Same intent, missing UI polish, labels, or Petpooja-specific fields |
| **Missing** | No equivalent user-facing flow |

## Priority legend (backlog)

| Priority | When to tackle |
|----------|----------------|
| **P0** | Core billing parity; staff use daily |
| **P1** | Visible in reference footer/table; common in dine-in |
| **P2** | Promo/CRM depth; nice for parity demos |
| **P3** | Out of scope or marketing-only in reference |

---

## Executive summary

| Metric | Count |
|--------|------:|
| Frames **Implemented** | 28 |
| Frames **Partial** | 14 |
| Frames **Missing** | 4 |
| Thematic areas with **P0** gaps | Discount/promo UI, cash change/settlement, register **Cancel**, delivery charges on bill |

**Strongest alignment:** table floor + legend, register layout (category rail, cart, dark footer), shortcuts/favorites/search, modifiers, KOT/print/save, running orders, split/part/due, customers + history, covers/captain/notes, reservations/contactless/move table/add table, payments grid, reports KPIs, same-table bill merge (QR/staff).

**Largest gaps vs frames 29–33 and 41–43:** BOGO/discount/promotion engine, customer tags, open item/charges, settlement/change calculator, “Check Items” column, footer charge lines (delivery/container), egg diet stripe, dedicated order-history screen.

---

## Frame-by-frame matrix

| # | Frame | Topic | After Dunes surface | API / domain | Status | Priority |
|---|-------|-------|----------------------|--------------|--------|----------|
| 01 | `01_table_areas` | Areas, legend, top actions | `TablesPage.tsx`, `pos.css`, `PosLayout.tsx` | `listTables`, `tableVisualState` | **Partial** — no **Items / Move KOT** toggle on grid (modal only) | P2 |
| 02 | `02_billing_home` | Billing home + navbar | `NewOrderPage.tsx`, `PosLayout.tsx` | — | **Partial** — “Now Order” vs “New Order”; chrome close | P3 |
| 03 | `03_favorite_items` | Favorites | `NewOrderPage` category `favorites` | menu favorites flags | **Implemented** | — |
| 04 | `04_category_menu` | Categories + grid | `NewOrderPage` `bill-cats` / `bill-grid` | catalog categories | **Implemented** | — |
| 05 | `05_shortcut_entry` | Alpha shortcut | `NewOrderPage` short code + `resolveMenuShortcut` | `shared/domain.ts` | **Implemented** | — |
| 06 | `06_numeric_shortcut` | Numeric shortcut | same | `shortcutNum` on items | **Implemented** | — |
| 07 | `07_search` | Search | `NewOrderPage` search filter | client filter | **Implemented** | — |
| 08 | `08_item_type_colors` | Veg / egg / non-veg bars | `bill-tile.veg` / `.nveg` only | `MenuItem.isVeg` only | **Partial** — no **egg** third stripe; no chicken-specific type | P2 |
| 09 | `09_new_order` | New order + table | modes + table select; `/pos/orders/new` | `createStaffOrder` | **Implemented** | — |
| 10 | `10_kot_print` | KOT + print | `settle('kot' \| 'kot-print')`, `printTicket` | `transitionOrder`, status | **Implemented** | — |
| 11 | `11_running_table_reorder` | Add to running table | load `order=` query; append lines | `replaceStaffOrderItems`, merge helpers | **Implemented** (+ same-table combine) | — |
| 12 | `12_table_status` | Running metadata | table tile: minutes, total, part due | `openOrder` on table | **Partial** — less metadata than Petpooja (covers, captain on tile) | P3 |
| 13 | `13_bill_review` | Edit before bill | cart qty/edit/remove/modifiers | `updateOrder` | **Implemented** | — |
| 14 | `14_bill_print` | Bill print | `settle('print')`, reprint on detail | `SERVED` transition | **Implemented** | — |
| 15 | `15_cash_settlement` | Cash | Cash radio + **It's Paid** + `pos.pay` | `markPaid` / payments | **Partial** — no **tender / change** (see 28) | P0 |
| 16 | `16_card_payment` | Card | Card radio | payments | **Implemented** | — |
| 17 | `17_online_payment` | Online / UPI | **Other** → label maps to `UPI` | `PaymentMethod.UPI` | **Partial** — no dedicated **Online** radio row | P2 |
| 18 | `18_variant_selector` | Variants | `ModifierDialog` single-select groups | addon groups `maxSelect: 1` | **Partial** — works as variants, not separate “variant” step UX | P3 |
| 19 | `19_modifier_modal` | Modifier modal | `ModifierDialog.tsx` | `priceCart` | **Implemented** | — |
| 20 | `20_modifier_validation` | Required modifiers | `PriceError` on `minSelect` | `shared/domain.ts` | **Implemented** | — |
| 21 | `21_addon_selection` | Add-ons in cart | cart line addons display | priced lines | **Implemented** | — |
| 22 | `22_order_building` | Multi-line cart | `bill-lines` | — | **Implemented** | — |
| 23 | `23_customer_due` | Customer + due | Customer dialog; **Due** radio; `DUE` note flag | `orderFlag('DUE')` | **Implemented** | — |
| 24 | `24_part_payment` | Part pay modal | `dialog === 'part'`, `settle('part')` | partial `markPaid` | **Implemented** | — |
| 25 | `25_split_bill` | Split setup | Split dialog + `settle('split')` | `splitStaffOrder` | **Implemented** | — |
| 26 | `26_split_results` | Split bills | `bill-bills` tabs per child | split notes `SPLIT:` | **Implemented** | — |
| 27 | `27_direct_settlement` | Settle on save | Save + **It's Paid** | pay on save | **Implemented** | — |
| 28 | `28_change_calculation` | Settlement amount / change | — | — | **Missing** | **P0** |
| 29 | `29_bill_controls` | Footer: BOGO, Split, charges, Check Items, Cancel | `bill-foot` — Split, Comp, Advance; Save/*; no Cancel | discount in schema unused on UI | **Partial** | **P0** / P1 |
| 30 | `30_discount_modal` | Discount modal | — | `discount` on create/update order | **Missing** (API only) | **P0** |
| 31 | `31_discount_types` | % / fixed / types | — | flat rupee discount only in domain | **Missing** | P1 |
| 32 | `32_promotion_rules` | Coupons / BOGO rules | — | — | **Missing** | P2 |
| 33 | `33_customer_tag_discount` | Tag-based discount | Loyalty checkbox only | no customer tags | **Missing** | P2 |
| 34 | `34_customer_profile` | Customer area | `CustomersPage.tsx` | `listCustomers` | **Implemented** | — |
| 35 | `35_customer_details` | Inline customer on register | modal: name + mobile only | — | **Partial** — no address/locality/tags on cart header | P1 |
| 36 | `36_customer_history` | History modal | `openHistory` + `/api/customers/:id/orders` | `listCustomerOrders` | **Implemented** | — |
| 37 | `37_covers` | Guest count | Covers dialog → `COVER:` note | notes | **Implemented** | — |
| 38 | `38_assignment` | Captain | Assign dialog → `CAPTAIN:` | notes | **Implemented** | — |
| 39 | `39_order_comment` | Order comment | Order note dialog | notes | **Implemented** | — |
| 40 | `40_item_note` | Item note | `ModifierDialog` + cart | line notes | **Implemented** | — |
| 41 | `41_open_item` | Open / custom item name | — | — | **Missing** | P1 |
| 42 | `42_custom_charge` | Custom charge line | — | — | **Missing** | P1 |
| 43 | `43_open_price` | Open price item | — | — | **Missing** | P1 |
| 44 | `44_order_history` | All orders history | `ReportsPage` tickets tab; `OrderDetailPage` | `listOrders`, reports | **Partial** — no Petpooja-style **Order History** list with rich filters | P2 |
| 45 | `45_pickup_billing` | Pick up mode | `mode=pickup`, no table | orders without `tableId` | **Implemented** | — |
| 46 | `46_owner_dashboard` | Owner / inventory marketing | `ReportsPage.tsx` (sales) | `reportRange` | **Partial** — ops reports, not multi-module owner hub | P3 |

---

## Thematic deep dive

### Table view (01, 12)

| Petpooja | After Dunes |
|----------|-------------|
| Area sections, color legend (blank / running / printed / paid / KOT) | `TABLE_AREAS`, `LEGEND`, `tableVisualState` |
| + Reservation, + Contactless, Move KOT, Delivery / Pick Up / Add Table | All present in `TablesPage` |
| Move KOT / **Items** mode toggle on floor | **Move** only via modal button |
| Table CRUD | `createTable` API + Add Table modal |

### Register catalog (03–08)

| Petpooja | After Dunes |
|----------|-------------|
| Favorite Items | Dynamic favorites category |
| Category rail + tiles with left color bar | `bill-cats`, `bill-tile.veg` / `.nveg` |
| Short codes (alpha + numeric) | `shortcutAlpha`, `shortcutNum` |
| Instant search | `search` state filter |
| Veg / egg / non-veg | Binary veg flag only |

### Order lifecycle (09–14, 11)

| Petpooja | After Dunes |
|----------|-------------|
| Open running table, add items | Query param order + table |
| KOT, Save & Print, statuses | `nextTicketStatus`, table colors |
| Same-table reorder | **Implemented**; guest QR merge in `server/logic.ts` |

### Payments (15–17, 23–28)

| Petpooja | After Dunes |
|----------|-------------|
| Cash / Card / Online | Cash, Card, Due, Other→UPI |
| Due + customer mobile | Implemented |
| Part payment | Modal + `markPaid` partial |
| Split | Equal parts 2–8 |
| Settlement field + change | **Not implemented** |
| Payments queue screen | `PaymentsPage` square cards |

### Bill footer (29)

| Control (reference) | After Dunes |
|---------------------|-------------|
| BOGO | **Absent** |
| Split | Button → modal |
| Subtotal / Discount / Delivery / Container / Total | Subtotal + tax line only |
| Check Items (per-line checkbox) | **Absent** |
| Payment radios | Cash, Card, Due, Other, Part |
| Save, Save & Print, Save & eBill, Save & KOT Print, **Cancel** | Save, Print, eBill (stub toast), KOT, KOT & Print, Hold — **Cancel only on Order Detail** |
| Complimentary | Footer + settle `comp` |

### Discounts & promos (30–33)

| Capability | After Dunes |
|------------|-------------|
| Discount modal on bill | **No UI** |
| Discount types (% / fixed / item) | Domain: rupee discount on order only |
| Promotion / coupon rules | **None** |
| Customer tag discount (e.g. School) | **No tags**; loyalty is visit-count checkbox |

**Backend note:** `PosContext.createOrder` / `updateOrder` and Zod schemas accept `discount`; reports aggregate `order.discount`. Wiring a modal is mostly UI + validation.

### Customers (34–36, 35 on register)

| Petpooja | After Dunes |
|----------|-------------|
| CRM list, loyalty | `CustomersPage` |
| Per-customer order history | Modal + API |
| Register: mobile, name, address, locality, tags | Name + mobile in modal only |

### Meta (37–40)

All four workflows map to dialogs and `notes` (`COVER`, `CAPTAIN`, free text, line notes).

### Open items (41–43)

No menu-less line type: cart lines require `menuItemId`. Would need domain line type or synthetic menu SKUs + UI entry.

### History & analytics (44, 46)

| Petpooja | After Dunes |
|----------|-------------|
| Order history browser | Running orders + report ticket drill-down |
| Owner dashboard (inventory, support, etc.) | Sales `ReportsPage`; frame 46 is marketing slide |

### Chrome (02)

| Petpooja | After Dunes |
|----------|-------------|
| Hamburger, logo, New Order, Bill No, support | `PosLayout` — aligned |
| Icon toolbar | Links to tables, running, current order, payments, etc. |

---

## Recommended backlog (ordered)

### P0 — Billing parity

1. **Discount modal** — apply rupee (then %) discount via existing `discount` field; show on footer breakdown.
2. **Settlement / change** — cash tender input; show return due (frame 28).
3. **Cancel on register** — void open bill from footer (reuse `CANCELLED` transition).
4. **Footer totals breakdown** — at minimum Subtotal, Discount (when set), Tax, Total; optional delivery/container when modes/charges exist.

### P1 — Operational completeness

5. **Open item / open price / custom charge** — ad-hoc lines (domain + register entry).
6. **Delivery customer block** — address/locality when `MODE:DELIVERY`.
7. **Dedicated Online/UPI** payment radio (or rename Other).
8. **Check Items** column — line-level “checked” state for bill review (persist on order lines or notes).

### P2 — Promo & CRM

9. **BOGO** button + rule engine (or staged: manual comp line first).
10. **Customer tags** + tag-triggered discount (frame 33).
11. **Promotion / coupon admin** (frame 32).
12. **Order History** page — all orders, date/status filters (frame 44).
13. **Egg diet indicator** — extend menu model + CSS stripe.

### P3 — Polish / out of scope

14. Table tile metadata (covers, captain).
15. Items vs Move KOT toggle on table view.
16. eBill email integration.
17. Owner marketing dashboard (frame 46) — keep Reports as canonical ops view unless product scope expands.

---

## Key file map (for implementers)

| Area | Primary files |
|------|----------------|
| Tables | `src/features/pos/TablesPage.tsx`, `shared/domain.ts` (`tableVisualState`) |
| Register | `src/features/pos/NewOrderPage.tsx`, `src/features/pos/ModifierDialog.tsx`, `src/pos.css` |
| Navbar | `src/features/pos/PosLayout.tsx` |
| Running / detail | `src/features/pos/OrdersPage.tsx`, `OrderDetailPage.tsx`, `OrderCard.tsx` |
| Payments | `src/features/pos/PaymentsPage.tsx`, `server/logic.ts` (`markPaid`) |
| Customers | `src/features/pos/CustomersPage.tsx` |
| Reports | `src/features/pos/ReportsPage.tsx`, `buildSalesReport` |
| Orders / merge | `server/logic.ts`, `server/test.ts` |
| API | `server/http.ts`, `shared/schemas.ts` |

---

## Keeping reference in sync

1. Copy PNGs into `docs/petpooja/reference/` when you want agents to `@`-reference without Downloads.
2. Optional rule: `.cursor/rules/petpooja-fidelity.md` — “Match labels in `docs/petpooja/README.md`; every visible POS control must persist real state.”
3. Re-run this audit after major POS phases; update counts in the **Executive summary** table.
