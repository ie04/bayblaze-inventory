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

If `VITE_BAYBLAZE_INVENTORY_API_URL` is empty, the app uses in-memory demo data
so UI work can continue without a live backend. Demo data is not persisted.

## Inventory API Boundary

Browser code should call a trusted inventory API boundary. Do not expose Medusa
admin tokens in Vite environment variables.

Current frontend adapter shape:

```ts
GET /inventory

POST /inventory
{
  "type": "create-product",
  "draft": { "title": "...", "handle": "...", "category": "..." }
}

POST /inventory
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

POST /inventory
{ "type": "update-quantity", "variantId": "...", "quantity": 12 }

POST /inventory
{ "type": "assign-vehicle", "variantId": "...", "vehicleId": "van-01" }

POST /inventory
{ "type": "set-state", "variantId": "...", "state": "ON_VEHICLE" }
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
