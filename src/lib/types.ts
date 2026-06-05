export type InventoryState = "ON_VEHICLE" | "IN_WAREHOUSE";

export type VariantMetadata = {
  assignedVehicleId?: string;
  availableQuantity: number;
  barcode?: string;
  brand?: string;
  inventoryState: InventoryState;
};

export type InventoryVariant = {
  id: string;
  productId: string;
  productTitle: string;
  title: string;
  sku: string;
  priceCents: number;
  metadata: VariantMetadata;
  updatedAt: string;
};

export type InventoryProduct = {
  id: string;
  title: string;
  handle: string;
  status: "draft" | "published";
  category: string;
  thumbnail?: string;
  variants: InventoryVariant[];
};

export type DeliveryVehicle = {
  id: string;
  label: string;
  plate?: string;
  active: boolean;
};

export type ContractIssue = {
  id: string;
  productTitle: string;
  variantTitle: string;
  message: string;
  severity: "danger" | "warning";
};

export type InventorySnapshot = {
  products: InventoryProduct[];
  vehicles: DeliveryVehicle[];
  lastSyncedAt: string;
  source: "api" | "demo";
};

export type ProductDraft = {
  category: string;
  handle: string;
  title: string;
};

export type VariantDraft = {
  barcode?: string;
  brand?: string;
  inventoryState: InventoryState;
  priceCents: number;
  quantity: number;
  sku: string;
  title: string;
  vehicleId?: string;
};
