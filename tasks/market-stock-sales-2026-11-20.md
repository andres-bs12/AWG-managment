# Market stock ↔ sales (2026-11-20, v3.1)

Owner's request (after Gaby's `Inventory` branch, commit 8578ac3): the person selling a
non-personalised (finished) ornament picks the numbered piece in New sale and it is deducted
from the numbered stock, so we can track which non-personalised ornaments sell best.
Plus: real tests for V15, a larger photo limit (~40 distinct pieces) and colour names:
**Wine** is a new colour for non-personalised ornaments, **Champagne is simply Beige**.

## Decisions (PM)

1. A finished sale item **must** carry `marketOrnamentId` (new sales only; old orders keep null).
   Only an ornament with status `painted` ("Ready") can be sold. Selling sets it to `sold`,
   `sold_at = now`, links it to the order item. The unnumbered GENERIC finished counter is no
   longer deducted or checked by sales (row stays in the DB, hidden from Stock UI).
2. Selling happens **only through New sale**. `PATCH /api/market-stock/{id}` accepts only
   `unpainted` ↔ `painted`; `sold` → 400 `MARKET_STOCK_SELL_IN_SALE`. A sold ornament cannot
   be changed in Stock. Stock's dialog shows "Sold · <date> · order <CODE>" (link to the order).
3. Cancelling an order (soft cancel) returns its sold market ornaments to `painted`
   (`sold_at` null). The order item keeps its `marketOrnamentId` as history.
4. Two items in one sale with the same `marketOrnamentId` → 400. Concurrent sales of the same
   piece: the second gets 409 `MARKET_STOCK_SOLD` (conditional update `WHERE status='painted'`).
5. IDs stay as Gaby defined them (prefix C = beige; physical labels may already exist).
   Colour from prefix: R Red, W Wine, G Green, C **Beige**. Finish: S Shiny, M Matte.
6. Photo: client resizes to longest side 2000 px, JPEG q 0.88, max 5 MB; server max 5 MB;
   nginx location for the photo route 6m.
7. V15 is not in production → edit it in place (no V16). Gaby's local DB may need
   `flyway repair` or a reset; tell her.

## API contract (both sides implement exactly this)

- `MarketOrnament` JSON: `{ id, status: 'unpainted'|'painted'|'sold', soldAt: string|null,
  revision: number, hasUploadedPhoto: boolean, orderId: string|null, orderCode: string|null }`
  (`orderId`/`orderCode` only while sold through an order).
- `CreateSaleItemInput` / `CreateSaleItemRequest`: new optional `marketOrnamentId` (string);
  required when `kind = finished`, forbidden for `custom` (400 `field: marketOrnamentId`).
- `OrderItem` / `OrderItemDto`: new `marketOrnamentId: string | null`.
- `Stats` / `StatsDto`: new `marketSales: { color: string, finish: 'shiny'|'matte', count: number }[]`
  — finished items with a `marketOrnamentId` in non-cancelled orders in the range, grouped by
  colour (`red|wine|green|beige`) and finish, sorted by count desc.
- Error codes: `MARKET_STOCK_SOLD` (409), `MARKET_STOCK_NOT_READY` (409, piece is not painted),
  `MARKET_STOCK_SELL_IN_SALE` (400), existing `MARKET_STOCK_CHANGED` (409).

## Owner feedback on iPad (2026-11-20, priority)

The stall iPad is where this is used. In the New sale finished-ornament picker:
1. **The photo is the most important thing**: big enough to recognise the piece on the iPad at a glance.
2. Then the **code** (e.g. RM01), clearly readable.
3. Then colour and finish, short: **S** = Shiny, **M** = Matte (e.g. "Red · M").
4. After selecting a piece, **the sale keeps showing its photo** (and code) on the item in the sale, not only during picking.
Pieces without a photo need a clear placeholder (still show the code large). Verify at iPad 820×1180 and 1180×820 (projects `ipadPortrait`/`ipadLandscape`) and phone 360.
