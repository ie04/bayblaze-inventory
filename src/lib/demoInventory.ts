import type { DeliveryVehicle, InventoryProduct, InventorySnapshot } from "./types";

const now = new Date().toISOString();

export const demoVehicles: DeliveryVehicle[] = [
  { id: "van-01", label: "Blaze Van 01", plate: "BB-104", active: true },
  { id: "van-02", label: "Blaze Van 02", plate: "BB-208", active: true },
  { id: "warehouse", label: "Warehouse", active: true },
];

export const demoProducts: InventoryProduct[] = [
  {
    id: "prod_raz_tn9000",
    title: "RAZ TN9000",
    handle: "raz-tn9000",
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
        },
        updatedAt: now,
      },
    ],
  },
  {
    id: "prod_zyn_6mg",
    title: "ZYN Nicotine Pouches",
    handle: "zyn-nicotine-pouches",
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
        },
        updatedAt: now,
      },
    ],
  },
  {
    id: "prod_raw_cones",
    title: "RAW Classic Cones",
    handle: "raw-classic-cones",
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
        },
        updatedAt: now,
      },
    ],
  },
];

export function createDemoSnapshot(): InventorySnapshot {
  return {
    products: structuredClone(demoProducts),
    vehicles: structuredClone(demoVehicles),
    lastSyncedAt: now,
    source: "demo",
  };
}
