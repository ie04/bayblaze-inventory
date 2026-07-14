import type { DeliveryVehicle, InventoryCollection, InventoryProduct, InventorySnapshot } from "./types";

const now = new Date().toISOString();

export const demoVehicles: DeliveryVehicle[] = [
  { id: "van-01", label: "Blaze Van 01", plate: "BB-104", active: true },
  { id: "van-02", label: "Blaze Van 02", plate: "BB-208", active: true },
  { id: "warehouse", label: "Warehouse", active: true },
];

export const demoCollections: InventoryCollection[] = [
  { id: "pcol_best_sellers", title: "Best Sellers", handle: "best-sellers" },
  { id: "pcol_new_arrivals", title: "New Arrivals", handle: "new-arrivals" },
];

export const demoProducts: InventoryProduct[] = [
  {
    id: "prod_raz_tn9000",
    collectionId: "pcol_best_sellers",
    collectionTitle: "Best Sellers",
    description: "High-capacity disposable vape with bold flavor delivery.",
    title: "RAZ TN9000",
    handle: "raz-tn9000",
    metadata: {
      inventoryCategory: "Vapes",
      spec_battery: "650mAh",
      spec_capacity: "12mL",
      spec_puffs: "9000",
    },
    status: "published",
    category: "Vapes",
    variants: [
      {
        id: "variant_raz_blue_razz",
        productId: "prod_raz_tn9000",
        productTitle: "RAZ TN9000",
        title: "Blue Razz Ice",
        sku: "RAZ-TN9000-BRI",
        priceCents: 2499,
        metadata: {
          inventoryState: "ON_VEHICLE",
          availableQuantity: 18,
          assignedVehicleId: "van-01",
          barcode: "850044990011",
          brand: "RAZ",
          unitPriceCents: 1225,
        },
        updatedAt: now,
      },
      {
        id: "variant_raz_miami_mint",
        productId: "prod_raz_tn9000",
        productTitle: "RAZ TN9000",
        title: "Miami Mint",
        sku: "RAZ-TN9000-MM",
        priceCents: 2499,
        metadata: {
          inventoryState: "IN_WAREHOUSE",
          availableQuantity: 44,
          barcode: "850044990028",
          brand: "RAZ",
          unitPriceCents: 1225,
        },
        updatedAt: now,
      },
    ],
  },
  {
    id: "prod_zyn_6mg",
    description: "Smoke-free nicotine pouches in a compact can.",
    title: "ZYN Nicotine Pouches",
    handle: "zyn-nicotine-pouches",
    metadata: {
      inventoryCategory: "Nicotine",
    },
    status: "published",
    category: "Nicotine",
    variants: [
      {
        id: "variant_zyn_cool_mint_6",
        productId: "prod_zyn_6mg",
        productTitle: "ZYN Nicotine Pouches",
        title: "Cool Mint 6mg",
        sku: "ZYN-CM-6MG",
        priceCents: 699,
        metadata: {
          inventoryState: "ON_VEHICLE",
          availableQuantity: 32,
          assignedVehicleId: "van-02",
          barcode: "818892021990",
          brand: "ZYN",
          unitPriceCents: 375,
        },
        updatedAt: now,
      },
    ],
  },
  {
    id: "prod_raw_cones",
    description: "Classic pre-rolled cones for quick packing.",
    title: "RAW Classic Cones",
    handle: "raw-classic-cones",
    metadata: {
      inventoryCategory: "Accessories",
    },
    status: "draft",
    category: "Accessories",
    variants: [
      {
        id: "variant_raw_king_3pk",
        productId: "prod_raw_cones",
        productTitle: "RAW Classic Cones",
        title: "King Size 3 Pack",
        sku: "RAW-KING-3",
        priceCents: 349,
        metadata: {
          inventoryState: "IN_WAREHOUSE",
          availableQuantity: 0,
          brand: "RAW",
          unitPriceCents: 160,
        },
        updatedAt: now,
      },
    ],
  },
];

export function createDemoSnapshot(): InventorySnapshot {
  return {
    collections: structuredClone(demoCollections),
    products: structuredClone(demoProducts),
    vehicles: structuredClone(demoVehicles),
    lastSyncedAt: now,
    source: "demo",
  };
}
