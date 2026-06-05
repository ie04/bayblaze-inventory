import { createDemoSnapshot } from "./demoInventory";
import type {
  ContractIssue,
  InventoryProduct,
  InventorySnapshot,
  InventoryState,
  InventoryVariant,
  ProductDraft,
  VariantDraft,
} from "./types";

const apiBaseUrl = import.meta.env.VITE_BAYBLAZE_INVENTORY_API_URL?.toString().replace(/\/$/, "");

type InventoryMutation =
  | { type: "create-product"; draft: ProductDraft }
  | { type: "create-variant"; productId: string; draft: VariantDraft }
  | { type: "update-quantity"; variantId: string; quantity: number }
  | { type: "assign-vehicle"; variantId: string; vehicleId: string }
  | { type: "set-state"; variantId: string; state: InventoryState };

let demoSnapshot = createDemoSnapshot();

export async function loadInventory(): Promise<InventorySnapshot> {
  if (!apiBaseUrl) {
    return waitForDemo(demoSnapshot);
  }

  try {
    return await request<InventorySnapshot>("/inventory");
  } catch (caught) {
    console.warn("Using demo inventory data because the inventory API is unavailable.", caught);
    return waitForDemo(demoSnapshot);
  }
}

export async function mutateInventory(mutation: InventoryMutation): Promise<InventorySnapshot> {
  if (apiBaseUrl) {
    try {
      return await request<InventorySnapshot>("/inventory", {
        body: JSON.stringify(mutation),
        method: "POST",
      });
    } catch (caught) {
      console.warn("Applying inventory mutation to demo data because the inventory API is unavailable.", caught);
    }
  }

  demoSnapshot = applyDemoMutation(demoSnapshot, mutation);
  return waitForDemo(demoSnapshot);
}

export function auditContract(products: InventoryProduct[]): ContractIssue[] {
  return products.flatMap((product) =>
    product.variants.flatMap((variant) => {
      const issues: ContractIssue[] = [];
      const metadata = variant.metadata;

      if (!["ON_VEHICLE", "IN_WAREHOUSE"].includes(metadata.inventoryState)) {
        issues.push(toIssue(product.title, variant, "Inventory state must be ON_VEHICLE or IN_WAREHOUSE.", "danger"));
      }

      if (!Number.isInteger(metadata.availableQuantity) || metadata.availableQuantity < 0) {
        issues.push(toIssue(product.title, variant, "Available quantity must be an integer greater than or equal to 0.", "danger"));
      }

      if (metadata.inventoryState === "ON_VEHICLE" && !metadata.assignedVehicleId) {
        issues.push(toIssue(product.title, variant, "Vehicle inventory must include assignedVehicleId.", "danger"));
      }

      if (!metadata.barcode) {
        issues.push(toIssue(product.title, variant, "Barcode is missing; scan workflows will require manual lookup.", "warning"));
      }

      if (!metadata.brand) {
        issues.push(toIssue(product.title, variant, "Brand metadata is missing; storefront filters may be incomplete.", "warning"));
      }

      return issues;
    }),
  );
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${apiBaseUrl}${path}`, {
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
    },
    ...init,
  });

  if (!response.ok) {
    throw new Error(`Inventory API request failed with HTTP ${response.status}`);
  }

  return response.json() as Promise<T>;
}

function applyDemoMutation(snapshot: InventorySnapshot, mutation: InventoryMutation): InventorySnapshot {
  const products = structuredClone(snapshot.products);
  const updatedAt = new Date().toISOString();

  if (mutation.type === "create-product") {
    products.unshift({
      id: crypto.randomUUID(),
      title: mutation.draft.title,
      handle: mutation.draft.handle,
      status: "draft",
      category: mutation.draft.category,
      variants: [],
    });
  }

  if (mutation.type === "create-variant") {
    const product = products.find((item) => item.id === mutation.productId);
    if (product) {
      product.variants.push({
        id: crypto.randomUUID(),
        productId: product.id,
        productTitle: product.title,
        title: mutation.draft.title,
        sku: mutation.draft.sku,
        priceCents: mutation.draft.priceCents,
        metadata: {
          inventoryState: mutation.draft.inventoryState,
          availableQuantity: mutation.draft.quantity,
          assignedVehicleId:
            mutation.draft.inventoryState === "ON_VEHICLE" ? mutation.draft.vehicleId : undefined,
          barcode: mutation.draft.barcode,
          brand: mutation.draft.brand,
        },
        updatedAt,
      });
    }
  }

  const variant = findVariant(products, "variantId" in mutation ? mutation.variantId : "");
  if (variant && mutation.type === "update-quantity") {
    variant.metadata.availableQuantity = mutation.quantity;
    variant.updatedAt = updatedAt;
  }

  if (variant && mutation.type === "assign-vehicle") {
    variant.metadata.inventoryState = mutation.vehicleId === "warehouse" ? "IN_WAREHOUSE" : "ON_VEHICLE";
    variant.metadata.assignedVehicleId = mutation.vehicleId === "warehouse" ? undefined : mutation.vehicleId;
    variant.updatedAt = updatedAt;
  }

  if (variant && mutation.type === "set-state") {
    variant.metadata.inventoryState = mutation.state;
    if (mutation.state === "IN_WAREHOUSE") {
      variant.metadata.assignedVehicleId = undefined;
    }
    variant.updatedAt = updatedAt;
  }

  return {
    ...snapshot,
    products,
    lastSyncedAt: updatedAt,
  };
}

function findVariant(products: InventoryProduct[], variantId: string) {
  for (const product of products) {
    const variant = product.variants.find((item) => item.id === variantId);
    if (variant) {
      return variant;
    }
  }

  return undefined;
}

function toIssue(
  productTitle: string,
  variant: InventoryVariant,
  message: string,
  severity: ContractIssue["severity"],
): ContractIssue {
  return {
    id: `${variant.id}-${message}`,
    productTitle,
    variantTitle: variant.title,
    message,
    severity,
  };
}

function waitForDemo(snapshot: InventorySnapshot) {
  return new Promise<InventorySnapshot>((resolve) => {
    window.setTimeout(() => resolve(structuredClone(snapshot)), 180);
  });
}
