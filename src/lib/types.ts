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


export type InventorySnapshot = {
  products: InventoryProduct[];
  vehicles: DeliveryVehicle[];
  lastSyncedAt: string;
  source: "api" | "demo";
  warnings?: string[];
};

export type ProductImageUploadDraft = {
  dataUrl: string;
  fileName: string;
  mimeType: string;
};

export type ProductDraft = {
  category: string;
  handle: string;
  imageUrl?: string;
  imageUrls?: string[];
  imageUpload?: ProductImageUploadDraft;
  imageUploads?: ProductImageUploadDraft[];
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

export type ProductWithVariantDraft = ProductDraft & {
  variant: VariantDraft;
};

export type ProductUpdateDraft = Partial<ProductDraft>;

export type VariantUpdateDraft = Partial<VariantDraft>;
