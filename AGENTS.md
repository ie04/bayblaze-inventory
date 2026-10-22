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

- Embedded Medusa under `bayblaze-api/medusa` remains the source of truth for
  products, variants, orders, fulfillment, payment state, and inventory. The old
  standalone `bayblaze-medusa` repo is retired.
- The inventory PWA must not become a separate commerce database.
- Browser code must not expose Medusa admin tokens or service tokens.
- The PWA calls a same-origin or configured inventory API boundary through
  `VITE_BAYBLAZE_INVENTORY_API_URL`. In Vercel production this should normally
  be `/api`, which routes to `api/inventory.ts` and `api/inventory-image.ts`.
  Those backend boundaries must call `bayblaze-api` only through
  `BAYBLAZE_API_URL` + `BAYBLAZE_API_SERVICE_TOKEN` and must not fall back to
  direct Medusa routes. `BAYBLAZE_API_URL` defaults to
  `https://api.bayblaze.net` when omitted. They remain responsible for
  authenticating staff users and must not expose service tokens to the browser.
- Do not configure inventory-app direct Medusa server env such as
  `MEDUSA_BACKEND_URL` or `BAYBLAZE_INVENTORY_SERVICE_TOKEN`; Medusa credentials
  belong behind `bayblaze-api`.
- The Vercel inventory proxy only authenticates staff and forwards to
  `bayblaze-api`. Vehicle records come from the API's shared registry; it must
  not initialize Firebase Admin or read Firestore directly.
- Production Vercel settings should use:
  `VITE_BAYBLAZE_INVENTORY_API_URL=/api`,
  `BAYBLAZE_API_URL=<shared bayblaze-api origin>`,
  and `BAYBLAZE_API_SERVICE_TOKEN=<shared app-to-api token>`. Firebase Admin
  credentials are not required in this frontend deployment.
- The active production inventory app domain is `https://stock.bayblaze.net`.
  Keep this origin in `bayblaze-api` production `CORS_ORIGINS` so browser auth
  calls to `https://api.bayblaze.net` do not fail CORS preflight with
  `Failed to fetch`.
- When the inventory API is not configured, the app falls back to demo data for
  local UX work. Demo mutations are in-memory only. When the API URL is
  configured, backend failures must surface as errors instead of silently using
  demo data.
- BayBlaze universal account records live behind `bayblaze-api` in
  `accounts/{uid}` and can grant the `inventory` role. Inventory sign-in uses
  the universal BayBlaze account routes: `POST /v1/auth/login`,
  `POST /v1/auth/google/start`, and `POST /v1/auth/google/callback`. The
  browser stores the returned session only after verifying the account has the
  `employee` badge plus the `inventory` role.
- The Vercel `/api/inventory` and `/api/inventory-image` boundaries must verify
  the browser bearer token through `bayblaze-api` `GET /v1/auth/me` and require
  `employee` + `inventory` before using `BAYBLAZE_API_SERVICE_TOKEN` for
  upstream inventory calls.
- Google OAuth redirect URI for the inventory PWA:
  `https://stock.bayblaze.net/auth/google/callback` in production and the
  local Vite callback URL when testing locally.
- `bayblaze-admin` lives at `admin.bayblaze.net` and is the operator surface for
  account role grants, disabling accounts, age-verification test bypasses,
  live drivers, routes, isochrone plots, and order details.

## Variant Metadata Contract

Every sellable unit must be represented at the Medusa variant level.
Product images are managed on the Medusa product through `thumbnail` and
`images`; do not require staff to leave the inventory app for routine product
photo updates. Product publish state is managed through Medusa product
`status`; inventory staff can publish a reviewed draft product or move a
published product back to draft from the product editor. The backend must keep
storefront sales-channel linkage in sync automatically when products are
created, published, or saved while already published.
Inventory app image rendering should not request Medusa inventory image URLs
directly from the browser. Stored Medusa URLs under
`/bayblaze/inventory-images/{filename}` should render through the same-origin
`/api/inventory-image?filename={filename}` proxy, which calls
`bayblaze-api` `GET /v1/inventory/images/{filename}` with the server-only
API token.
Product description, Medusa product collection assignment, and storefront
specification metadata are edited in the inventory product create flow and
product editor. The inventory API snapshot includes product `description`,
`collectionId`, `collectionTitle`, editable product `metadata`, and the
available Medusa `collections` list. Storefront spec fields are optional and
should be stored only when relevant as product metadata keys `spec_puffs`,
`spec_capacity`, and `spec_battery`; do not require vape-specific specs for
wraps, cones, accessories, or other products that do not have those attributes.
Keep `inventoryCategory` as the product metadata bridge for BayBlaze category
labels.
The inventory Stock screen should remain the direct editor for human-friendly
variant contract fields: variant name, SKU, brand, barcode, price, available
quantity, unit cost, stock location, and delivery vehicle. Avoid exposing raw variable
names such as `inventoryState`, `availableQuantity`, or `assignedVehicleId` in
primary UI labels. The product editor also provides a product-level price
control that applies one price across all variants by issuing existing
`update-variant-details` mutations for each variant; individual variant price
editing remains available below that bulk control. Unit cost is separate from
listed storefront price and is stored as variant metadata `unitPriceCents` for
profit calculations; product-level unit cost controls apply that metadata value
across all variants without changing Medusa price sets.

BayBlaze product variants must include metadata:

```ts
inventoryState: "ON_VEHICLE" | "IN_WAREHOUSE"
availableQuantity: number
assignedVehicleId?: string
barcode?: string
brand?: string
unitPriceCents?: number
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

## Shared Vehicle Registry

- `bayblaze-api` owns vehicles in the unified `bayblaze-isochronos` Firestore
  database. The old `bayblaze-driver` project is no longer an app-facing vehicle
  source. Inventory receives canonical vehicles on GET/POST `/v1/inventory`.
- Admin creates/edits/deactivates vehicles through `/v1/admin/vehicles` routes;
  Driver links and releases them through its existing API workflows.
- Inventory can assign stock to an active vehicle even while a driver is linked.
  API validation rejects missing/unknown/inactive target vehicles. Warehouse is
  a stock-location choice, not a real vehicle document.
- Vehicle IDs are immutable. Driver clock-out releases the driver link, not the
  stock assigned to that vehicle. Commerce remains the stock source of truth.

## October 2026 Session Recovery

- OVHcloud backend replacement changed account session signing secrets; sessions
  saved before the rebuild can no longer be verified. Expired sessions also
  require reauthentication.
- Inventory and inventory-image proxies tag account-authentication 401 responses
  with `code: INVENTORY_SESSION_INVALID`. Upstream service-token 401 responses
  must not receive that code.
- The browser clears rejected account sessions and returns to sign-in with a
  readable session-expired notice. Preserve session state for 403 access-denied,
  5xx service failures, and upstream credential errors; never retry mutations
  automatically after reauthentication.

## October 2026 Inventory Service Credential Sync

- Inventory Vercel production and preview `BAYBLAZE_API_SERVICE_TOKEN` were
  synchronized with the running OVHcloud API's canonical service token after
  discovering the inventory deployment setting predated the VPS rebuild.
  Redeploy inventory after changing server environment variables.
- Two authentication boundaries must be checked independently: the browser's
  account session is verified at `/v1/auth/me`; Vercel then calls `/v1/inventory`
  using its server-only service token. Repairing a browser session does not
  synchronize the Vercel service credential.
- Never expose the shared service token through a `VITE_*` variable or commit it.
  Read it securely from the backend runtime and pass it to Vercel via stdin.
- The Vercel project is `bayblaze-inventory`, production domain
  `stock.bayblaze.net`. Explicit production deployment is available with
  `vercel deploy --prod --yes` from a linked checkout; verify the custom-domain
  alias after deployment rather than assuming a push activated production.
