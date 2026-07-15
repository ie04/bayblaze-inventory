# BayBlaze Inventory

BayBlaze Inventory is a mobile-friendly operations PWA for managing BayBlaze
products, variants, stock counts, product photos, unit costs, and delivery
vehicle assignments. It is designed for routine staff workflows while keeping
commerce data owned by trusted backend services.

## Highlights

- React, TypeScript, Vite, Tailwind CSS, and PWA support.
- Product and variant management with image upload workflows.
- Variant-level inventory state for warehouse and delivery-vehicle stock.
- Unit-cost fields for internal profit calculations, separate from storefront
  listed prices.
- Account-gated access through the BayBlaze backend.
- Server-side proxy boundary so privileged commerce and Firebase credentials are
  not exposed to the browser.

## Local Development

```bash
npm install
npm run dev
npm run build
npm run lint
```

## Repository Notes

This repository contains the inventory frontend and its serverless proxy code.
Production deployments require separately configured BayBlaze API, account, and
commerce credentials.
