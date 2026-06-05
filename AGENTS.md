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
  `VITE_BAYBLAZE_INVENTORY_API_URL`. That backend boundary is responsible for
  authenticating staff users and writing to Medusa.
- When the inventory API is not configured or unavailable, the app falls back to
  demo data for local UX work. Demo mutations are in-memory only.

## Variant Metadata Contract

Every sellable unit must be represented at the Medusa variant level.

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
