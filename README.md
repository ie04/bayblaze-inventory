# BayBlaze Inventory

BayBlaze Inventory is a PWA for product, variant, stock count, and delivery
vehicle assignment workflows. It is a friendly operational frontend for
BayBlaze Medusa, not a replacement commerce database.

## Local Development

```bash
npm install
npm run dev
npm run build
npm run lint
```

For Vercel production, set `VITE_BAYBLAZE_INVENTORY_API_URL=/api` and provide
server-only proxy variables:

```env
BAYBLAZE_API_URL=https://api.bayblaze.net
BAYBLAZE_API_SERVICE_TOKEN=
MEDUSA_BACKEND_URL=https://api.bayblaze.net
BAYBLAZE_INVENTORY_SERVICE_TOKEN=
FIREBASE_PROJECT_ID=bayblaze-driver
FIREBASE_CLIENT_EMAIL=
FIREBASE_PRIVATE_KEY=
```

`FIREBASE_SERVICE_ACCOUNT_JSON` can be used instead of
`FIREBASE_CLIENT_EMAIL` and `FIREBASE_PRIVATE_KEY`. These Firebase variables
are server-only Vercel variables used by `/api/inventory` to merge active driver
vehicles from Firestore `vehicles`.

If the frontend API URL is empty, the app uses in-memory demo data so UI work
can continue without a live backend. Demo data is not persisted. When the API
URL is configured, backend failures are shown as errors instead of silently
falling back to demo data.

## Inventory API Boundary

Browser code should call a trusted inventory API boundary. Do not expose Medusa
admin tokens or BayBlaze service tokens in Vite environment variables.

The Vercel `/api/inventory` proxy prefers `BAYBLAZE_API_URL` and forwards to
`bayblaze-api` with `BAYBLAZE_API_SERVICE_TOKEN`. If those variables are absent,
it falls back to the legacy direct Medusa proxy. The proxy then merges active
vehicles from Firebase Firestore. Vehicles are not stored in Medusa; Firestore
remains the vehicle source used by the driver app. Firestore vehicle sync is
non-fatal: if Firebase Admin is misconfigured or Firestore is unavailable, the
app still loads inventory and shows a warning.

Current frontend adapter shape:

```ts
GET /api/inventory

POST /api/inventory
{
  "type": "create-product",
  "draft": { "title": "...", "handle": "...", "category": "..." }
}

POST /api/inventory
{
  "type": "create-variant",
  "productId": "...",
  "draft": {
    "title": "...",
    "sku": "...",
    "priceCents": 2499,
    "quantity": 12,
    "inventoryState": "IN_WAREHOUSE",
    "vehicleId": "...",
    "barcode": "...",
    "brand": "..."
  }
}

POST /api/inventory
{ "type": "update-quantity", "variantId": "...", "quantity": 12 }

POST /api/inventory
{ "type": "assign-vehicle", "variantId": "...", "vehicleId": "van-01" }

POST /api/inventory
{ "type": "set-state", "variantId": "...", "state": "ON_VEHICLE" }

POST /api/inventory
{ "type": "update-product-image", "productId": "...", "imageUrl": "https://..." }

POST /api/inventory
{
  "type": "update-product-details",
  "productId": "...",
  "draft": { "status": "published" }
}

POST /api/inventory
{
  "type": "create-product-with-variant",
  "draft": {
    "title": "...",
    "handle": "...",
    "category": "...",
    "imageUrl": "https://...",
    "variant": {
      "title": "...",
      "sku": "...",
      "brand": "...",
      "barcode": "...",
      "priceCents": 2499,
      "quantity": 12,
      "inventoryState": "ON_VEHICLE",
      "vehicleId": "van-01"
    }
  }
}

POST /api/inventory
{
  "type": "update-variant-details",
  "variantId": "...",
  "draft": {
    "title": "...",
    "sku": "...",
    "brand": "...",
    "barcode": "...",
    "priceCents": 2499,
    "quantity": 12,
    "inventoryState": "IN_WAREHOUSE"
  }
}
```

The API should return:

```ts
{
  products: InventoryProduct[]
  vehicles: DeliveryVehicle[]
  lastSyncedAt: string
  source: "api"
}
```
