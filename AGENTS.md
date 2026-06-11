# BayBlaze Inventory App Notes

## Durable Project Memory

Record durable project facts, recurring commands, deployment details, service
boundaries, and workflow preferences in this file so future Codex sessions can
pick them up after context compaction or a new chat.

When code changes are complete, automatically commit and push the changes unless
the user explicitly says not to. Use a concise commit message that reflects the
completed work.

When infrastructure, deployment, environment variables, service topology,
runner setup, or cross-repo integration details change, update the relevant
`AGENTS.md` files in the same work session so future Codex/LLM sessions inherit
the current operating model.

## Repo Purpose

`bayblaze-inventory` is the BayBlaze Inventory App: a React, TypeScript, Vite,
Tailwind CSS PWA for routine product, variant, stock count, and vehicle
assignment work against BayBlaze Medusa.

The app should follow the shared BayBlaze UI topology and design system in
`../design/BAYBLAZE_UI_GUIDE.md`. Reuse the local primitives in
`src/components/ui` and the shared `--bb-*` tokens in `src/index.css` before
creating new primitives.

## Source Of Truth Boundary

- `bayblaze-medusa` remains the source of truth for products, variants, orders,
  fulfillment, payment state, and inventory.
- The inventory PWA must not become a separate commerce database.
- Browser code must not expose Medusa admin tokens or service tokens.
- The PWA calls a same-origin or configured inventory API boundary through
  `VITE_BAYBLAZE_INVENTORY_API_URL`. In Vercel production this should normally
  be `/api`, which routes to `api/inventory.ts` and `api/inventory-image.ts`.
  Those backend boundaries must call `bayblaze-api` only through
  `BAYBLAZE_API_URL` + `BAYBLAZE_API_SERVICE_TOKEN` (or
  `BAYBLAZE_INVENTORY_APP_TO_API_TOKEN`) and must not fall back to direct
  Medusa routes. `BAYBLAZE_API_URL` defaults to `https://api.bayblaze.net` when
  omitted. They remain responsible for authenticating staff users and must not
  expose service tokens to the browser.
- Do not configure inventory-app direct Medusa server env such as
  `MEDUSA_BACKEND_URL` or `BAYBLAZE_INVENTORY_SERVICE_TOKEN`; Medusa credentials
  belong behind `bayblaze-api`.
- The Vercel `/api/inventory` proxy also reads active vehicles from Firebase
  Firestore `vehicles` with Firebase Admin. Server-only Firebase env may be
  provided either as `FIREBASE_SERVICE_ACCOUNT_JSON` or as
  `FIREBASE_PROJECT_ID`, `FIREBASE_CLIENT_EMAIL`, and `FIREBASE_PRIVATE_KEY`.
  This keeps Firestore as the driver vehicle source while Medusa remains the
  inventory/product source. Firestore vehicle sync must be non-fatal: if it
  fails, the proxy should still return Medusa inventory with a warning.
- Production Vercel settings should use:
  `VITE_BAYBLAZE_INVENTORY_API_URL=/api`,
  `BAYBLAZE_API_URL=<shared bayblaze-api origin>`,
  and `BAYBLAZE_API_SERVICE_TOKEN=<shared app-to-api token>`. Add Firebase Admin
  server variables as above for vehicle dropdowns.
- When the inventory API is not configured, the app falls back to demo data for
  local UX work. Demo mutations are in-memory only. When the API URL is
  configured, backend failures must surface as errors instead of silently using
  demo data.

## Variant Metadata Contract

Every sellable unit must be represented at the Medusa variant level.
Product images are managed on the Medusa product through `thumbnail` and
`images`; do not require staff to leave the inventory app for routine product
photo updates. Product publish state is managed through Medusa product
`status`; inventory staff can publish a reviewed draft product or move a
published product back to draft from the product editor. The backend must keep
storefront sales-channel linkage in sync automatically when products are
created, published, or saved while already published.
Product description, Medusa product collection assignment, and storefront
specification metadata are edited in the inventory product create flow and
product editor. The inventory API snapshot includes product `description`,
`collectionId`, `collectionTitle`, editable product `metadata`, and the
available Medusa `collections` list. Storefront spec fields should be stored as
product metadata keys `spec_puffs`, `spec_capacity`, and `spec_battery`; keep
`inventoryCategory` as the product metadata bridge for BayBlaze category labels.
The inventory Stock screen should remain the direct editor for human-friendly
variant contract fields: variant name, SKU, brand, barcode, price, available
quantity, stock location, and delivery vehicle. Avoid exposing raw variable
names such as `inventoryState`, `availableQuantity`, or `assignedVehicleId` in
primary UI labels.

BayBlaze product variants must include metadata:

```ts
inventoryState: "ON_VEHICLE" | "IN_WAREHOUSE"
availableQuantity: number
assignedVehicleId?: string
barcode?: string
brand?: string
```

`assignedVehicleId` is required when `inventoryState` is `ON_VEHICLE`.
`availableQuantity` must be an integer greater than or equal to 0.

The storefront, driver app, and IsoChronos should consume normalized
variant-level inventory data from Medusa or backend materializations, not from
the inventory PWA.

## Local Commands

```bash
npm install
npm run dev
npm run build
npm run lint
```

## Deployment Assumptions

- The PWA can be deployed as a static Vite app to Firebase Hosting or another
  static host.
- Server-only Medusa credentials belong in the backend/API boundary only.
- Public browser config must use the `VITE_` prefix and must be safe to expose.

## June 2026 Driver Vehicle Source Clarification

- Vehicle dropdown/source data that comes from Firestore should read from the
  `bayblaze-driver` Firebase project, not the `bayblaze-isochronos` project.
  IsoChronos owns routing/cache/usage collections; the driver project owns
  `vehicles`, `driver_profiles`, `driver_delivery_queues`, and live driver
  location snapshots.
- The inventory app may display and assign Medusa variant `assignedVehicleId`,
  but it must not become the owner of driver queues, driver live locations, or
  order delivery lifecycle status. Those remain driver/Medusa/IsoChronos
  integration concerns.
