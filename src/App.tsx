import { useEffect, useMemo, useRef, useState, type ChangeEvent, type FormEvent, type ReactNode } from "react";
import { createPortal } from "react-dom";
import {
  ArrowLeft,
  ChevronDown,
  Image,
  Package,
  Plus,
  RefreshCw,
  Trash2,
  Truck,
  Warehouse,
  X,
} from "lucide-react";

import {
  AppShell,
  Badge,
  Button,
  Card,
  EmptyState,
  ErrorState,
  Input,
  InlineNotice,
  LoadingState,
  PageHeader,
  Select,
  SectionHeader,
  StatusBadge,
  Textarea,
} from "./components/ui";
import { loadInventory, mutateInventory } from "./lib/inventoryApi";
import type {
  DeliveryVehicle,
  InventoryCollection,
  InventoryProduct,
  InventorySnapshot,
  InventoryState,
  InventoryVariant,
  ProductImageUploadDraft,
  ProductUpdateDraft,
  ProductWithVariantDraft,
  VariantDraft,
  VariantUpdateDraft,
} from "./lib/types";

type View = "products" | "add-product" | "vehicles";
type MetadataRow = { id: string; key: string; value: string };

const productSpecFields = [
  { key: "spec_puffs", label: "Puffs", placeholder: "9000" },
  { key: "spec_capacity", label: "Capacity", placeholder: "12mL" },
  { key: "spec_battery", label: "Battery", placeholder: "650mAh" },
] as const;

const reservedProductMetadataKeys = new Set([
  "inventoryCategory",
  ...productSpecFields.map((field) => field.key),
]);

const views: Array<{ id: View; icon: ReactNode; label: string }> = [
  { id: "products", icon: <Package size={18} aria-hidden="true" />, label: "Products" },
  { id: "add-product", icon: <Plus size={18} aria-hidden="true" />, label: "Add" },
  { id: "vehicles", icon: <Truck size={18} aria-hidden="true" />, label: "Vehicles" },
];

function App() {
  const [snapshot, setSnapshot] = useState<InventorySnapshot | null>(null);
  const [activeView, setActiveView] = useState<View>("products");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function refreshInventory() {
    setError("");
    setLoading(true);
    try {
      setSnapshot(await loadInventory());
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Inventory load failed.");
    } finally {
      setLoading(false);
    }
  }

  async function applyMutation(...args: Parameters<typeof mutateInventory>) {
    setBusy(true);
    setError("");
    try {
      const nextSnapshot = await mutateInventory(...args);
      setSnapshot(nextSnapshot);
      return nextSnapshot;
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Inventory update failed.");
      return null;
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    const timer = window.setTimeout(() => void refreshInventory(), 0);
    return () => window.clearTimeout(timer);
  }, []);

  const variants = useMemo(() => flattenVariants(snapshot?.products ?? []), [snapshot]);

  const activeScreen = snapshot ? (
    <InventoryScreen
      busy={busy}
      collections={snapshot.collections}
      products={snapshot.products}
      variants={variants}
      vehicles={snapshot.vehicles}
      view={activeView}
      onCreateProductWithVariant={async (draft) => {
        const nextSnapshot = await applyMutation({ type: "create-product-with-variant", draft });

        if (nextSnapshot) {
          setActiveView("products");
        }
      }}
      onCreateVariant={(productId, draft) =>
        void applyMutation({ type: "create-variant", productId, draft })
      }
      onOpenAddProduct={() => setActiveView("add-product")}
      onUpdateProductDetails={(productId, draft) =>
        void applyMutation({ type: "update-product-details", productId, draft })
      }
      onDeleteProduct={(productId) =>
        void applyMutation({ type: "delete-product", productId })
      }
      onUpdateVariantDetails={(variantId, draft) =>
        void applyMutation({ type: "update-variant-details", variantId, draft })
      }
      onSetState={(variantId, state) => void applyMutation({ type: "set-state", variantId, state })}
      onUpdateQuantity={(variantId, quantity) =>
        void applyMutation({ type: "update-quantity", variantId, quantity })
      }
      onAssignVehicle={(variantId, vehicleId) =>
        void applyMutation({ type: "assign-vehicle", variantId, vehicleId })
      }
    />
  ) : null;

  return (
    <AppShell
      fullScreen
      wide
      header={
        <header className="border-b border-[var(--bb-line)] bg-white/95 px-4 py-3 backdrop-blur md:px-7 md:py-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-xs font-black uppercase text-[var(--bb-blaze)]">BayBlaze</p>
              <h1 className="text-2xl font-black uppercase leading-tight text-[var(--bb-charcoal)]">
                Inventory
              </h1>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <StatusBadge
                status={snapshot?.source === "api" ? "BayBlaze API" : "Demo data"}
                tone={snapshot?.source === "api" ? "success" : "warning"}
              />
              <Button
                aria-label="Refresh inventory"
                disabled={loading}
                loading={loading}
                onClick={() => void refreshInventory()}
                size="icon"
                title="Refresh inventory"
                variant="secondary"
              >
                {!loading ? <RefreshCw size={18} aria-hidden="true" /> : null}
              </Button>
            </div>
          </div>
        </header>
      }
      footer={
        <footer className="fixed inset-x-0 bottom-0 z-50 border-t border-[var(--bb-line)] bg-white/95 px-2 pb-[calc(0.5rem+env(safe-area-inset-bottom))] pt-2 shadow-[0_-12px_30px_rgba(17,24,39,0.08)] backdrop-blur md:hidden">
          <nav className="grid grid-cols-3 gap-1" aria-label="Inventory navigation">
            {views.map((item) => (
              <button
                key={item.id}
                aria-label={item.label}
                className={`grid min-h-13 place-items-center gap-1 rounded-2xl px-1 py-1.5 text-[10px] font-black transition ${
                  activeView === item.id
                    ? "bg-[var(--bb-blaze-soft)] text-[var(--bb-charcoal)] shadow-[var(--bb-shadow-soft)]"
                    : "text-[var(--bb-muted)]"
                }`}
                onClick={() => setActiveView(item.id)}
                type="button"
              >
                {item.icon}
                <span>{item.label}</span>
              </button>
            ))}
          </nav>
        </footer>
      }
    >
      <div className="flex min-h-0 flex-1 flex-col md:grid md:grid-cols-[180px_minmax(0,1fr)]">
        <aside className="hidden border-r border-[var(--bb-line)] bg-[var(--bb-surface-warm)] p-4 md:block">
          <nav className="space-y-2" aria-label="Inventory sections">
            {views.map((item) => (
              <button
                key={item.id}
                className={`flex min-h-12 w-full items-center gap-3 rounded-2xl px-4 text-left text-sm font-black transition ${
                  activeView === item.id
                    ? "bg-white text-[var(--bb-charcoal)] shadow-[var(--bb-shadow-soft)]"
                    : "text-[var(--bb-muted)] hover:bg-white/70"
                }`}
                onClick={() => setActiveView(item.id)}
                type="button"
              >
                {item.icon}
                {item.label}
              </button>
            ))}
          </nav>
        </aside>
        <section className="min-h-0 flex-1 overflow-y-auto px-3 pb-28 pt-4 md:px-7 md:py-5">
          <div className="page-transition flex min-h-0 w-full flex-col gap-4 md:gap-5">
            {error ? <ErrorState>{error}</ErrorState> : null}
            {snapshot?.source === "demo" ? (
              <InlineNotice tone="warning">
                Demo mode is active because the app was built without an inventory API URL. Set
                VITE_BAYBLAZE_INVENTORY_API_URL=/api in Vercel and redeploy to use Medusa inventory.
              </InlineNotice>
            ) : null}
            {snapshot?.warnings?.map((warning) => (
              <InlineNotice key={warning} tone="warning">
                {warning}
              </InlineNotice>
            ))}
            {loading && !snapshot ? <LoadingState label="Loading inventory" /> : activeScreen}
          </div>
        </section>
      </div>
    </AppShell>
  );
}

function InventoryScreen({
  busy,
  collections,
  products,
  variants,
  vehicles,
  view,
  onAssignVehicle,
  onCreateProductWithVariant,
  onCreateVariant,
  onOpenAddProduct,
  onSetState,
  onUpdateProductDetails,
  onDeleteProduct,
  onUpdateVariantDetails,
  onUpdateQuantity,
}: {
  busy: boolean;
  collections: InventoryCollection[];
  products: InventoryProduct[];
  variants: InventoryVariant[];
  vehicles: DeliveryVehicle[];
  view: View;
  onAssignVehicle: (variantId: string, vehicleId: string) => void;
  onCreateProductWithVariant: (draft: ProductWithVariantDraft) => Promise<void> | void;
  onCreateVariant: (productId: string, draft: VariantDraft) => void;
  onOpenAddProduct: () => void;
  onSetState: (variantId: string, state: InventoryState) => void;
  onUpdateProductDetails: (productId: string, draft: ProductUpdateDraft) => void;
  onDeleteProduct: (productId: string) => void;
  onUpdateVariantDetails: (variantId: string, draft: VariantUpdateDraft) => void;
  onUpdateQuantity: (variantId: string, quantity: number) => void;
}) {
  const categoryOptions = useMemo(() => getCategoryOptions(products), [products]);

  if (view === "add-product") {
    return (
      <AddProductFlow
        busy={busy}
        categoryOptions={categoryOptions}
        collections={collections}
        products={products}
        vehicles={vehicles}
        onCreateProductWithVariant={onCreateProductWithVariant}
      />
    );
  }

  if (view === "vehicles") {
    return <VehiclesView variants={variants} vehicles={vehicles} onAssignVehicle={onAssignVehicle} />;
  }

  return (
    <ProductsView
      busy={busy}
      collections={collections}
      products={products}
      vehicles={vehicles}
      onAssignVehicle={onAssignVehicle}
      onCreateVariant={onCreateVariant}
      onOpenAddProduct={onOpenAddProduct}
      onSetState={onSetState}
      onUpdateProductDetails={onUpdateProductDetails}
      onDeleteProduct={onDeleteProduct}
      onUpdateQuantity={onUpdateQuantity}
      onUpdateVariantDetails={onUpdateVariantDetails}
    />
  );
}


function ProductsView({
  busy,
  collections,
  products,
  vehicles,
  onAssignVehicle,
  onCreateVariant,
  onOpenAddProduct,
  onSetState,
  onUpdateProductDetails,
  onDeleteProduct,
  onUpdateQuantity,
  onUpdateVariantDetails,
}: {
  busy: boolean;
  collections: InventoryCollection[];
  products: InventoryProduct[];
  vehicles: DeliveryVehicle[];
  onAssignVehicle: (variantId: string, vehicleId: string) => void;
  onCreateVariant: (productId: string, draft: VariantDraft) => void;
  onOpenAddProduct: () => void;
  onSetState: (variantId: string, state: InventoryState) => void;
  onUpdateProductDetails: (productId: string, draft: ProductUpdateDraft) => void;
  onDeleteProduct: (productId: string) => void;
  onUpdateQuantity: (variantId: string, quantity: number) => void;
  onUpdateVariantDetails: (variantId: string, draft: VariantUpdateDraft) => void;
}) {
  const [editingProductId, setEditingProductId] = useState<string | null>(null);
  const editingProduct = products.find((product) => product.id === editingProductId);
  const groupedProducts = useMemo(() => groupProductsByCategory(products), [products]);
  const categoryOptions = useMemo(() => getCategoryOptions(products), [products]);

  return (
    <>
      <PageHeader
        icon={<Package size={24} aria-hidden="true" />}
        title="Products"
        actions={
          <Button onClick={onOpenAddProduct} size="sm">
            <Plus size={18} aria-hidden="true" />
            Add
          </Button>
        }
      />
      {groupedProducts.length === 0 ? (
        <EmptyState icon={<Package size={22} aria-hidden="true" />} title="No products yet">
          Add your first product to start building the BayBlaze inventory.
        </EmptyState>
      ) : (
        <div className="space-y-6">
          {groupedProducts.map((group) => (
            <section key={group.category} className="space-y-2">
              <div className="sticky top-0 z-10 -mx-1 flex items-center justify-between gap-3 rounded-2xl bg-white/95 px-1 py-2 backdrop-blur">
                <h3 className="text-sm font-black uppercase tracking-wide text-[var(--bb-blaze)]">
                  {group.category}
                </h3>
                <Badge tone="neutral">
                  {group.products.length} product{group.products.length === 1 ? "" : "s"}
                </Badge>
              </div>
              <div className="space-y-2">
                {group.products.map((product) => (
                  <ProductCard
                    key={product.id}
                    product={product}
                    onSelect={() => setEditingProductId(product.id)}
                  />
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
      {editingProduct ? (
        <ProductEditorDialog
          busy={busy}
          collections={collections}
          product={editingProduct}
          categoryOptions={categoryOptions}
          vehicles={vehicles}
          onAssignVehicle={onAssignVehicle}
          onClose={() => setEditingProductId(null)}
          onCreateVariant={onCreateVariant}
          onSetState={onSetState}
          onUpdateProductDetails={onUpdateProductDetails}
          onDeleteProduct={onDeleteProduct}
          onUpdateQuantity={onUpdateQuantity}
          onUpdateVariantDetails={onUpdateVariantDetails}
        />
      ) : null}
    </>
  );
}

function VehiclesView({
  variants,
  vehicles,
  onAssignVehicle,
}: {
  variants: InventoryVariant[];
  vehicles: DeliveryVehicle[];
  onAssignVehicle: (variantId: string, vehicleId: string) => void;
}) {
  const connectedVehicles = vehicles.filter((vehicle) => vehicle.id !== "warehouse");

  return (
    <>
      <PageHeader
        icon={<Truck size={24} aria-hidden="true" />}
        title="Vehicles"
      />
      {connectedVehicles.length === 0 ? (
        <EmptyState icon={<Truck size={22} aria-hidden="true" />} title="No connected vehicles">
          Add vehicles in the driver system before assigning inventory to them.
        </EmptyState>
      ) : (
        <div className="grid gap-5 lg:grid-cols-2">
          {connectedVehicles.map((vehicle) => {
            const assigned = variants.filter(
              (variant) => variant.metadata.assignedVehicleId === vehicle.id,
            );
            const vehicleUnits = assigned.reduce(
              (sum, variant) => sum + variant.metadata.availableQuantity,
              0,
            );

            return (
              <Card key={vehicle.id} elevated>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-xs font-black uppercase text-[var(--bb-blaze)]">
                      {vehicle.plate ?? "No plate"}
                    </p>
                    <h2 className="mt-1 text-xl font-black text-[var(--bb-charcoal)] md:text-2xl">
                      {vehicle.label}
                    </h2>
                    <p className="mt-1 text-sm font-bold text-[var(--bb-muted)]">
                      {assigned.length} variant{assigned.length === 1 ? "" : "s"} · {vehicleUnits} units
                    </p>
                  </div>
                  <StatusBadge status={vehicle.active ? "Active" : "Inactive"} tone={vehicle.active ? "success" : "neutral"} />
                </div>

                <VehicleAssignmentControl
                  variants={variants}
                  vehicle={vehicle}
                  vehicles={vehicles}
                  onAssignVehicle={onAssignVehicle}
                />

                <div className="mt-5">
                  <SectionHeader title="Current stock" />
                  <div className="mt-4 space-y-3">
                    {assigned.length === 0 ? (
                      <InlineNotice tone="warning">No variants are assigned to this vehicle.</InlineNotice>
                    ) : (
                      <VehicleStockGroups
                        variants={assigned}
                        onMoveToWarehouse={(variantId) => onAssignVehicle(variantId, "warehouse")}
                      />
                    )}
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </>
  );
}

function VehicleStockGroups({
  variants,
  onMoveToWarehouse,
}: {
  variants: InventoryVariant[];
  onMoveToWarehouse: (variantId: string) => void;
}) {
  return (
    <div className="space-y-3">
      {groupVehicleVariants(variants).map((group) => (
        <VehicleStockGroup
          group={group}
          key={group.productId}
          onMoveToWarehouse={onMoveToWarehouse}
        />
      ))}
    </div>
  );
}

type VehicleVariantGroup = {
  productId: string;
  productTitle: string;
  thumbnailUrl: string;
  totalUnits: number;
  variants: InventoryVariant[];
};

function VehicleStockGroup({
  group,
  onMoveToWarehouse,
}: {
  group: VehicleVariantGroup;
  onMoveToWarehouse: (variantId: string) => void;
}) {
  const [open, setOpen] = useState(true);
  const variantCount = group.variants.length;

  return (
    <div className="overflow-hidden rounded-2xl border border-[var(--bb-line)] bg-[var(--bb-surface-warm)]">
      <button
        aria-expanded={open}
        className="flex w-full items-center gap-3 p-3 text-left"
        onClick={() => setOpen((current) => !current)}
        type="button"
      >
        <VariantThumbnail imageUrl={group.thumbnailUrl} />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-black text-[var(--bb-charcoal)]">
            {group.productTitle}
          </span>
          <span className="mt-0.5 block truncate text-xs font-bold text-[var(--bb-muted)]">
            {variantCount} variant{variantCount === 1 ? "" : "s"} · {group.totalUnits} units
          </span>
        </span>
        <Badge tone="brand">{group.totalUnits} units</Badge>
        <ChevronDown
          aria-hidden="true"
          className={`size-5 shrink-0 text-[var(--bb-muted)] transition-transform ${open ? "rotate-180" : ""}`}
        />
      </button>

      {open ? (
        <div className="space-y-2 border-t border-[var(--bb-line)] bg-white p-3">
          {group.variants.map((variant) => (
            <div
              className="grid gap-3 rounded-2xl border border-[var(--bb-line)] bg-white p-3 sm:grid-cols-[auto_minmax(0,1fr)_auto] sm:items-center"
              key={variant.id}
            >
              <VariantThumbnail imageUrl={getVariantThumbnailUrl(variant)} compact />
              <div className="min-w-0">
                <p className="truncate text-sm font-black text-[var(--bb-charcoal)]">
                  {variant.title}
                </p>
                <p className="truncate text-xs font-bold text-[var(--bb-muted)]">
                  {variant.sku}
                </p>
              </div>
              <div className="flex shrink-0 items-center justify-between gap-2 sm:justify-start">
                <Badge tone="brand">{variant.metadata.availableQuantity} units</Badge>
                <Button
                  aria-label={`Move ${variant.title} to warehouse`}
                  onClick={() => onMoveToWarehouse(variant.id)}
                  size="icon"
                  title="Move to warehouse"
                  variant="secondary"
                >
                  <Warehouse size={17} aria-hidden="true" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function VariantThumbnail({
  compact = false,
  imageUrl,
}: {
  compact?: boolean;
  imageUrl: string;
}) {
  return (
    <span
      className={`grid shrink-0 place-items-center overflow-hidden rounded-2xl border border-[var(--bb-line)] bg-white text-[var(--bb-muted)] ${
        compact ? "size-12" : "size-14"
      }`}
    >
      {imageUrl ? (
        <img alt="" className="size-full object-cover" src={getInventoryImageSrc(imageUrl)} />
      ) : (
        <Image size={compact ? 18 : 21} aria-hidden="true" />
      )}
    </span>
  );
}

function groupVehicleVariants(variants: InventoryVariant[]) {
  const groups = new Map<string, VehicleVariantGroup>();

  [...variants]
    .sort((first, second) => {
      const productCompare = first.productTitle.localeCompare(second.productTitle, undefined, {
        sensitivity: "base",
      });

      if (productCompare !== 0) {
        return productCompare;
      }

      return first.title.localeCompare(second.title, undefined, { sensitivity: "base" });
    })
    .forEach((variant) => {
      const groupKey = variant.productId || variant.productTitle;
      const currentGroup = groups.get(groupKey);

      if (currentGroup) {
        currentGroup.totalUnits += variant.metadata.availableQuantity;
        currentGroup.variants.push(variant);

        if (!currentGroup.thumbnailUrl) {
          currentGroup.thumbnailUrl = getVariantThumbnailUrl(variant);
        }
      } else {
        groups.set(groupKey, {
          productId: groupKey,
          productTitle: variant.productTitle,
          thumbnailUrl: getVariantThumbnailUrl(variant),
          totalUnits: variant.metadata.availableQuantity,
          variants: [variant],
        });
      }
    });

  return Array.from(groups.values());
}

function VehicleAssignmentControl({
  variants,
  vehicle,
  vehicles,
  onAssignVehicle,
}: {
  variants: InventoryVariant[];
  vehicle: DeliveryVehicle;
  vehicles: DeliveryVehicle[];
  onAssignVehicle: (variantId: string, vehicleId: string) => void;
}) {
  const [selectedVariantId, setSelectedVariantId] = useState("");
  const assignableVariants = variants.filter(
    (variant) =>
      variant.metadata.assignedVehicleId !== vehicle.id &&
      variant.metadata.availableQuantity > 0,
  );

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!selectedVariantId) {
      return;
    }

    onAssignVehicle(selectedVariantId, vehicle.id);
    setSelectedVariantId("");
  }

  if (assignableVariants.length === 0) {
    return (
      <InlineNotice tone="success">
        Every in-stock variant is already assigned to this vehicle.
      </InlineNotice>
    );
  }

  return (
    <form className="mt-4 grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto]" onSubmit={submit}>
      <Select
        label="Add inventory to this vehicle"
        onChange={(event) => setSelectedVariantId(event.target.value)}
        value={selectedVariantId}
      >
        <option value="">Choose product / variant</option>
        {assignableVariants.map((variant) => (
          <option key={variant.id} value={variant.id}>
            {formatVehicleAssignmentLabel(variant, vehicles)}
          </option>
        ))}
      </Select>
      <Button className="self-end" disabled={!selectedVariantId} type="submit">
        <Plus size={18} aria-hidden="true" />
        Add to vehicle
      </Button>
    </form>
  );
}

function formatVehicleAssignmentLabel(variant: InventoryVariant, vehicles: DeliveryVehicle[]) {
  const currentVehicle = vehicles.find(
    (vehicle) => vehicle.id === variant.metadata.assignedVehicleId,
  );
  const location =
    variant.metadata.inventoryState === "ON_VEHICLE"
      ? currentVehicle?.label ?? "Vehicle"
      : "Warehouse";

  return `${variant.productTitle} / ${variant.title} (${variant.metadata.availableQuantity} units · ${location})`;
}

function ProductCard({
  product,
  onSelect,
}: {
  product: InventoryProduct;
  onSelect: () => void;
}) {
  const units = product.variants.reduce((sum, variant) => sum + variant.metadata.availableQuantity, 0);
  const brand = getProductVariantBrand(product);
  const cheapestVariant = product.variants.reduce<InventoryVariant | null>(
    (lowest, variant) => (!lowest || variant.priceCents < lowest.priceCents ? variant : lowest),
    null,
  );

  return (
    <button className="w-full text-left" onClick={onSelect} type="button">
      <Card interactive className="p-3 md:p-4">
        <div className="flex items-center gap-3">
          <ProductThumbnail product={product} />
          <div className="min-w-0 flex-1">
            <div className="flex min-w-0 flex-wrap items-center gap-2">
              <h2 className="max-w-full truncate text-base font-black text-[var(--bb-charcoal)] md:text-lg">
                {product.title}
              </h2>
              <StatusBadge status={product.status} tone={product.status === "published" ? "success" : "warning"} />
            </div>
            <p className="mt-1 truncate text-sm font-bold text-[var(--bb-muted)]">
              {brand ? `${brand} · ` : ""}
              {product.variants.length} variant{product.variants.length === 1 ? "" : "s"}
              {cheapestVariant ? ` · From ${formatMoney(cheapestVariant.priceCents)}` : " · No variants yet"}
            </p>
            <p className="mt-1 truncate text-xs font-bold text-[var(--bb-muted)]">
              /{product.handle}
            </p>
          </div>
          <div className="grid shrink-0 justify-items-end gap-2">
            <Badge tone={units > 0 ? "brand" : "warning"}>{units} units</Badge>
            <span className="text-xs font-black uppercase text-[var(--bb-muted)]">Open</span>
          </div>
        </div>
      </Card>
    </button>
  );
}

function ProductEditorDialog({
  busy,
  collections,
  product,
  categoryOptions,
  vehicles,
  onAssignVehicle,
  onClose,
  onCreateVariant,
  onSetState,
  onUpdateProductDetails,
  onDeleteProduct,
  onUpdateQuantity,
  onUpdateVariantDetails,
}: {
  busy: boolean;
  collections: InventoryCollection[];
  product: InventoryProduct;
  categoryOptions: string[];
  vehicles: DeliveryVehicle[];
  onAssignVehicle: (variantId: string, vehicleId: string) => void;
  onClose: () => void;
  onCreateVariant: (productId: string, draft: VariantDraft) => void;
  onSetState: (variantId: string, state: InventoryState) => void;
  onUpdateProductDetails: (productId: string, draft: ProductUpdateDraft) => void;
  onDeleteProduct: (productId: string) => void;
  onUpdateQuantity: (variantId: string, quantity: number) => void;
  onUpdateVariantDetails: (variantId: string, draft: VariantUpdateDraft) => void;
}) {
  const [editorMode, setEditorMode] = useState<"details" | "add-variant">("details");

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, []);

  return createPortal(
    <div
      className="fixed inset-0 z-[100] flex items-start justify-center overflow-y-auto bg-black/55 p-2 md:p-6"
      role="dialog"
      aria-modal="true"
    >
      <div className="flex max-h-[calc(100svh-1rem)] w-full max-w-4xl flex-col overflow-hidden rounded-[22px] bg-white shadow-[var(--bb-shadow-shell)] md:max-h-[calc(100svh-3rem)] md:rounded-[var(--bb-radius-shell)]">
        <header className="flex items-start justify-between gap-3 border-b border-[var(--bb-line)] px-4 py-3 md:px-5 md:py-4">
          <div className="flex min-w-0 items-start gap-3">
            {editorMode === "add-variant" ? (
              <Button
                aria-label="Back to product details"
                onClick={() => setEditorMode("details")}
                size="icon"
                title="Back to product details"
                variant="secondary"
              >
                <ArrowLeft size={18} aria-hidden="true" />
              </Button>
            ) : (
              <ProductThumbnail product={product} />
            )}
            <div className="min-w-0">
              <p className="text-xs font-black uppercase text-[var(--bb-blaze)]">
                {editorMode === "add-variant" ? "Add variant" : "Product editor"}
              </p>
              <h2 className="truncate text-xl font-black text-[var(--bb-charcoal)] md:text-2xl">
                {product.title}
              </h2>
              <p className="mt-1 text-sm font-bold text-[var(--bb-muted)]">
                {editorMode === "add-variant"
                  ? "Create a sellable variant with its own photos"
                  : `${product.variants.length} variant${product.variants.length === 1 ? "" : "s"}`}
              </p>
            </div>
          </div>
          <Button aria-label="Close product editor" onClick={onClose} size="icon" title="Close product editor" variant="secondary">
            <X size={18} aria-hidden="true" />
          </Button>
        </header>
        <div className="min-h-0 flex-1 overflow-y-auto px-3 py-4 md:px-5 md:py-5">
          {editorMode === "add-variant" ? (
            <AddVariantWizard
              busy={busy}
              product={product}
              productBrand={getProductVariantBrand(product)}
              vehicles={vehicles}
              onCancel={() => setEditorMode("details")}
              onCreateVariant={(draft) => {
                onCreateVariant(product.id, draft);
                setEditorMode("details");
              }}
            />
          ) : (
            <ProductDetailsCard
              busy={busy}
              collections={collections}
              product={product}
              categoryOptions={categoryOptions}
              vehicles={vehicles}
              onAddVariant={() => setEditorMode("add-variant")}
              onAssignVehicle={onAssignVehicle}
              onSetState={onSetState}
              onUpdateProductDetails={onUpdateProductDetails}
              onDeleteProduct={() => {
                onDeleteProduct(product.id);
                onClose();
              }}
              onUpdateQuantity={onUpdateQuantity}
              onUpdateVariantDetails={onUpdateVariantDetails}
            />
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}

function AddProductFlow({
  busy,
  categoryOptions,
  collections,
  products,
  vehicles,
  onCreateProductWithVariant,
}: {
  busy: boolean;
  categoryOptions: string[];
  collections: InventoryCollection[];
  products: InventoryProduct[];
  vehicles: DeliveryVehicle[];
  onCreateProductWithVariant: (draft: ProductWithVariantDraft) => Promise<void> | void;
}) {
  const [currentStep, setCurrentStep] = useState(0);
  const [brand, setBrand] = useState("");
  const [title, setTitle] = useState("");
  const [handle, setHandle] = useState("");
  const [category, setCategory] = useState("");
  const [collectionId, setCollectionId] = useState("");
  const [description, setDescription] = useState("");
  const [specPuffs, setSpecPuffs] = useState("");
  const [specCapacity, setSpecCapacity] = useState("");
  const [specBattery, setSpecBattery] = useState("");
  const [metadataRows, setMetadataRows] = useState<MetadataRow[]>([]);
  const [newCategory, setNewCategory] = useState("");
  const [isAddingCategory, setIsAddingCategory] = useState(false);
  const [imageUploads, setImageUploads] = useState<Array<ProductImageUploadDraft & { uploadedUrl?: string; uploading?: boolean }>>([]);
  const uploadedImageUrlsRef = useRef<string[]>([]);
  const removedImageUploadsRef = useRef<Set<ProductImageUploadDraft>>(new Set());
  const [draggedPhotoIndex, setDraggedPhotoIndex] = useState<number | null>(null);
  const [dragOverPhotoIndex, setDragOverPhotoIndex] = useState<number | null>(null);
  const [dragPreview, setDragPreview] = useState<{ dataUrl: string; x: number; y: number } | null>(null);
  const [ploppedPhotoIndex, setPloppedPhotoIndex] = useState<number | null>(null);
  const [imageError, setImageError] = useState("");
  const [variantTitle, setVariantTitle] = useState("");
  const [sku, setSku] = useState("");
  const [barcode, setBarcode] = useState("");
  const [price, setPrice] = useState("");
  const [inventoryState, setInventoryState] = useState<InventoryState>("IN_WAREHOUSE");
  const [availableQuantity, setAvailableQuantity] = useState("");
  const [vehicleId, setVehicleId] = useState("");

  const steps = [
    "Product image",
    "Product identity",
    "Storefront details",
    "First variant",
    "Quantity and location",
    "Review",
  ];

  const isFirstStep = currentStep === 0;
  const isLastStep = currentStep === steps.length - 1;
  const activeVehicle = vehicles.find((vehicle) => vehicle.id === vehicleId);
  const availableQuantityNumber = Number(availableQuantity || "0");
  const normalizedHandle = normalizeProductHandle(handle);
  const handleAlreadyExists = Boolean(
    normalizedHandle &&
      products.some((product) => normalizeProductHandle(product.handle) === normalizedHandle),
  );

  useEffect(() => {
    uploadedImageUrlsRef.current = imageUploads
      .map((upload) => upload.uploadedUrl)
      .filter((url): url is string => Boolean(url));
  }, [imageUploads]);

  const addCategoryOptionValue = "__add_category__";
  const visibleCategoryOptions =
    category && !categoryOptions.includes(category) ? [...categoryOptions, category] : categoryOptions;

  function selectAddProductCategory(nextCategory: string) {
    if (nextCategory === addCategoryOptionValue) {
      setIsAddingCategory(true);
      setNewCategory("");
      return;
    }

    setCategory(nextCategory);
    setIsAddingCategory(false);
    setNewCategory("");
  }

  function commitNewCategory() {
    const nextCategory = newCategory.trim();

    if (!nextCategory) {
      return false;
    }

    setCategory(nextCategory);
    setNewCategory("");
    setIsAddingCategory(false);

    return true;
  }

  async function handleProductPhotoChange(event: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files ?? []);

    if (!files.length) {
      return;
    }

    const maxOriginalBytes = 30 * 1024 * 1024;
    const maxPhotos = 6;

    if (imageUploads.length + files.length > maxPhotos) {
      setImageError(`Add up to ${maxPhotos} product photos.`);
      event.target.value = "";
      return;
    }

    for (const file of files) {
      if (!file.type.startsWith("image/")) {
        setImageError("Choose image files only.");
        event.target.value = "";
        return;
      }

      if (file.size > maxOriginalBytes) {
        setImageError("Choose images under 30 MB.");
        event.target.value = "";
        return;
      }
    }

    const nextUploads: Array<ProductImageUploadDraft & { uploadedUrl?: string; uploading?: boolean }> = [];

    for (const file of files) {
      try {
        const dataUrl = await compressImageFileToDataUrl(file);
        const imageUpload = {
          dataUrl,
          fileName: toCompressedImageFileName(file.name || "product-photo"),
          mimeType: "image/jpeg",
          uploading: true,
        };

        nextUploads.push(imageUpload);
      } catch {
        setImageError("Unable to process one of those images. Try another photo.");
        event.target.value = "";
        return;
      }
    }

    setImageUploads((current) => [...current, ...nextUploads].slice(0, maxPhotos));
    setImageError("");
    event.target.value = "";

    for (const imageUpload of nextUploads) {
      try {
        const uploadedUrl = await uploadProductImage(imageUpload);

        if (removedImageUploadsRef.current.has(imageUpload)) {
          removedImageUploadsRef.current.delete(imageUpload);
          void deleteUploadedProductImage(uploadedUrl).catch(() => {
            setImageError("Image was removed, but Medusa cleanup failed. It will be cleaned up later.");
          });
          continue;
        }

        setImageUploads((current) =>
          current.map((item) =>
            item === imageUpload
              ? {
                  ...item,
                  uploadedUrl,
                  uploading: false,
                }
              : item,
          ),
        );
      } catch (caught) {
        removedImageUploadsRef.current.delete(imageUpload);

        setImageUploads((current) =>
          current.map((item) =>
            item === imageUpload
              ? {
                  ...item,
                  uploading: false,
                }
              : item,
          ),
        );
        setImageError(caught instanceof Error ? caught.message : "Product image upload failed.");
      }
    }
  }

  function removeProductPhoto(indexToRemove: number) {
    const uploadToRemove = imageUploads[indexToRemove];

    if (uploadToRemove?.uploadedUrl) {
      void deleteUploadedProductImage(uploadToRemove.uploadedUrl).catch(() => {
        setImageError("Unable to delete that temporary image from Medusa. It will be cleaned up later.");
      });
    } else if (uploadToRemove?.uploading) {
      removedImageUploadsRef.current.add(uploadToRemove);
    }

    setImageUploads((current) => current.filter((_, index) => index !== indexToRemove));
    setDraggedPhotoIndex(null);
    setDragOverPhotoIndex(null);
    setImageError("");
  }

  function reorderProductPhoto(fromIndex: number, toIndex: number) {
    if (fromIndex === toIndex || fromIndex < 0 || toIndex < 0) {
      return;
    }

    setImageUploads((current) => {
      if (fromIndex >= current.length || toIndex >= current.length) {
        return current;
      }

      const nextUploads = [...current];
      const [movedUpload] = nextUploads.splice(fromIndex, 1);
      nextUploads.splice(toIndex, 0, movedUpload);

      return nextUploads;
    });
  }

  function getPhotoIndexFromPoint(clientX: number, clientY: number) {
    const element = document.elementFromPoint(clientX, clientY);
    const photoTile = element?.closest("[data-product-photo-index]");
    const rawIndex = photoTile?.getAttribute("data-product-photo-index");
    const index = Number(rawIndex);

    return Number.isInteger(index) ? index : null;
  }

  function startPhotoDrag(index: number, clientX: number, clientY: number) {
    const upload = imageUploads[index];

    if (!upload) {
      return;
    }

    setDraggedPhotoIndex(index);
    setDragOverPhotoIndex(index);
    setDragPreview({
      dataUrl: upload.dataUrl,
      x: clientX,
      y: clientY,
    });
  }

  function updatePhotoDrag(clientX: number, clientY: number) {
    if (draggedPhotoIndex === null) {
      return;
    }

    setDragPreview((current) =>
      current
        ? {
            ...current,
            x: clientX,
            y: clientY,
          }
        : current,
    );

    const index = getPhotoIndexFromPoint(clientX, clientY);

    if (index !== null) {
      setDragOverPhotoIndex(index);
    }
  }

  function finishPhotoDrag(clientX: number, clientY: number) {
    if (draggedPhotoIndex === null) {
      return;
    }

    const dropIndex = getPhotoIndexFromPoint(clientX, clientY);
    const finalDropIndex = dropIndex ?? dragOverPhotoIndex ?? draggedPhotoIndex;

    reorderProductPhoto(draggedPhotoIndex, finalDropIndex);

    setPloppedPhotoIndex(finalDropIndex);
    window.setTimeout(() => {
      setPloppedPhotoIndex((current) => (current === finalDropIndex ? null : current));
    }, 240);

    setDraggedPhotoIndex(null);
    setDragOverPhotoIndex(null);
    setDragPreview(null);
  }

  function cancelPhotoDrag() {
    setDraggedPhotoIndex(null);
    setDragOverPhotoIndex(null);
    setDragPreview(null);
  }

  const photosAreReady = imageUploads.every((upload) => !upload.uploading && upload.uploadedUrl);
  const canSubmit = Boolean(
    title.trim() &&
      normalizedHandle &&
      !handleAlreadyExists &&
      category.trim() &&
      description.trim() &&
      variantTitle.trim() &&
      sku.trim(),
  );

  const canContinue =
    (currentStep === 0 && photosAreReady) ||
    (currentStep === 1 &&
      Boolean(title.trim() && normalizedHandle && !handleAlreadyExists && (category.trim() || (isAddingCategory && newCategory.trim())))) ||
    (currentStep === 2 && Boolean(description.trim())) ||
    (currentStep === 3 && Boolean(variantTitle.trim() && sku.trim())) ||
    (currentStep === 4 &&
      availableQuantity.trim().length > 0 &&
      Number.isFinite(availableQuantityNumber) &&
      availableQuantityNumber >= 0 &&
      (inventoryState === "IN_WAREHOUSE" || Boolean(vehicleId))) ||
    (isLastStep && canSubmit);

  function goNext() {
    if (!canContinue || isLastStep) {
      return;
    }

    if (currentStep === 1 && isAddingCategory && !commitNewCategory()) {
      return;
    }

    setCurrentStep((step) => Math.min(step + 1, steps.length - 1));
  }

  function goBack() {
    setCurrentStep((step) => Math.max(step - 1, 0));
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!canSubmit) {
      return;
    }

    onCreateProductWithVariant({
      title: title.trim(),
      handle: normalizedHandle,
      category: category.trim(),
      collectionId: collectionId || null,
      description: description.trim(),
      imageUrls: imageUploads.map((upload) => upload.uploadedUrl).filter((url): url is string => Boolean(url)),
      metadata: buildProductMetadataDraft({
        metadataRows,
        specBattery,
        specCapacity,
        specPuffs,
      }),
      variant: {
        barcode: barcode.trim() || undefined,
        brand: brand.trim() || undefined,
        inventoryState,
        priceCents: dollarsToCents(price),
        quantity: availableQuantityNumber,
        sku: sku.trim(),
        title: variantTitle.trim(),
        vehicleId: inventoryState === "ON_VEHICLE" ? vehicleId || undefined : undefined,
      },
    });
  }

  return (
    <>
      <PageHeader icon={<Plus size={24} aria-hidden="true" />} title="Add a Product" />

      <form className="space-y-5 pb-28" onSubmit={submit}>
        <Card elevated>
          <div className="flex items-center justify-between gap-3">
            <StepHeading step={String(currentStep + 1)} title={steps[currentStep]} />
            <Badge tone="neutral">
              {currentStep + 1} / {steps.length}
            </Badge>
          </div>

          <div className="mt-4 h-2 overflow-hidden rounded-full bg-[var(--bb-surface-warm)]">
            <div
              className="h-full rounded-full bg-[var(--bb-blaze)] transition-all"
              style={{ width: `${((currentStep + 1) / steps.length) * 100}%` }}
            />
          </div>
        </Card>

        {currentStep === 0 ? (
          <Card elevated>
            <div className="grid gap-4">
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                {imageUploads.map((upload, index) => {
                  const isDragging = draggedPhotoIndex === index;
                  const isDropTarget = dragOverPhotoIndex === index && draggedPhotoIndex !== null;
                  const didJustPlop = ploppedPhotoIndex === index;

                  return (
                    <div
                      className={[
                        "group relative touch-none select-none overflow-hidden rounded-3xl border bg-[var(--bb-surface-warm)] transition",
                        didJustPlop ? "animate-[bayblaze-photo-plop_240ms_ease-out]" : "",
                        isDragging
                          ? "scale-[0.92] border-[var(--bb-blaze)] opacity-25"
                          : isDropTarget
                            ? "border-[var(--bb-blaze)] ring-4 ring-[var(--bb-blaze-soft)]"
                            : "border-[var(--bb-line)]",
                      ].filter(Boolean).join(" ")}
                      data-product-photo-index={index}
                      key={`${upload.fileName}-${index}`}
                      onPointerCancel={cancelPhotoDrag}
                      onPointerDown={(event) => {
                        if (event.pointerType !== "mouse" || event.button !== 0) {
                          return;
                        }

                        startPhotoDrag(index, event.clientX, event.clientY);
                      }}
                      onPointerMove={(event) => {
                        if (event.pointerType !== "mouse") {
                          return;
                        }

                        updatePhotoDrag(event.clientX, event.clientY);
                      }}
                      onPointerUp={(event) => {
                        if (event.pointerType !== "mouse") {
                          return;
                        }

                        finishPhotoDrag(event.clientX, event.clientY);
                      }}
                      onTouchCancel={cancelPhotoDrag}
                      onTouchEnd={(event) => {
                        const touch = event.changedTouches[0];

                        if (!touch) {
                          cancelPhotoDrag();
                          return;
                        }

                        finishPhotoDrag(touch.clientX, touch.clientY);
                      }}
                      onTouchMove={(event) => {
                        const touch = event.touches[0];

                        if (!touch) {
                          return;
                        }

                        event.preventDefault();
                        updatePhotoDrag(touch.clientX, touch.clientY);
                      }}
                      onTouchStart={(event) => {
                        const touch = event.touches[0];

                        if (!touch) {
                          return;
                        }

                        startPhotoDrag(index, touch.clientX, touch.clientY);
                      }}
                      role="button"
                      tabIndex={0}
                    >
                      <img
                        alt=""
                        className="aspect-square w-full touch-none select-none object-cover"
                        draggable={false}
                        src={upload.dataUrl}
                      />
                      <button
                        aria-label={`Remove ${upload.fileName}`}
                        className="absolute right-2 top-2 rounded-full bg-white/95 px-3 py-1 text-xs font-black text-[var(--bb-charcoal)] shadow transition hover:bg-white"
                        onClick={(event) => {
                          event.stopPropagation();
                          removeProductPhoto(index);
                        }}
                        onPointerDown={(event) => event.stopPropagation()}
                        onTouchStart={(event) => event.stopPropagation()}
                        type="button"
                      >
                        Remove
                      </button>
                      <div className="pointer-events-none absolute bottom-2 left-2 flex flex-wrap gap-1">
                        {index === 0 ? (
                          <span className="rounded-full bg-white/95 px-3 py-1 text-xs font-black text-[var(--bb-blaze)] shadow">
                            Main
                          </span>
                        ) : null}
                        {upload.uploading ? (
                          <span className="rounded-full bg-white/95 px-3 py-1 text-xs font-black text-[var(--bb-muted)] shadow">
                            Uploading
                          </span>
                        ) : null}
                      </div>
                    </div>
                  );
                })}

                <label className="grid aspect-square cursor-pointer place-items-center rounded-3xl border-2 border-dashed border-[var(--bb-line)] bg-white transition hover:border-[var(--bb-blaze)] hover:bg-[var(--bb-blaze-soft)]">
                  <span className="grid place-items-center gap-2 text-center">
                    <span className="grid size-12 place-items-center rounded-full bg-[var(--bb-blaze-soft)] text-[var(--bb-blaze)]">
                      <Plus size={28} aria-hidden="true" />
                    </span>
                    <span className="text-xs font-black uppercase tracking-wide text-[var(--bb-muted)]">
                      Add Photo
                    </span>
                  </span>
                  <input
                    accept="image/*"
                    className="sr-only"
                    multiple
                    onChange={handleProductPhotoChange}
                    type="file"
                  />
                </label>
              </div>

              <p className="text-sm font-bold text-[var(--bb-muted)]">
                Add up to 6 product photos. Drag photos to reorder them. The first photo becomes the main storefront image.
              </p>

              {imageError ? <InlineNotice tone="warning">{imageError}</InlineNotice> : null}
            </div>
          </Card>
        ) : null}

        {dragPreview ? (
          <div
            aria-hidden="true"
            className="pointer-events-none fixed z-[9999] size-28 -translate-x-1/2 -translate-y-1/2 overflow-hidden rounded-3xl border-2 border-white bg-white shadow-2xl transition-transform duration-75"
            style={{
              left: dragPreview.x,
              top: dragPreview.y,
              transform: "translate(-50%, -50%) scale(0.82) rotate(-2deg)",
            }}
          >
            <img alt="" className="h-full w-full object-cover" src={dragPreview.dataUrl} />
          </div>
        ) : null}

        {currentStep === 1 ? (
          <Card elevated>
            <div className="grid gap-3">
              <Input
                label="Product name"
                onChange={(event) => setTitle(event.target.value)}
                placeholder="RAZ TN9000"
                value={title}
              />
              <Input
                label="Brand"
                onChange={(event) => setBrand(event.target.value)}
                placeholder="RAZ"
                value={brand}
              />
              <div className="space-y-2">
                <Select
                  label="Category"
                  onChange={(event) => selectAddProductCategory(event.target.value)}
                  value={isAddingCategory ? addCategoryOptionValue : category}
                >
                  <option value="">Choose category</option>
                  {visibleCategoryOptions.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                  <option value={addCategoryOptionValue}>+ Add Category</option>
                </Select>

                {isAddingCategory ? (
                  <div className="rounded-3xl border border-[var(--bb-line)] bg-[var(--bb-surface-warm)] p-3">
                    <input
                      aria-label="New category name"
                      className="h-11 w-full rounded-full border border-[var(--bb-line)] bg-white px-4 text-sm font-bold text-[var(--bb-charcoal)] outline-none transition placeholder:text-[var(--bb-muted)] focus:border-[var(--bb-blaze)] focus:ring-4 focus:ring-[var(--bb-blaze-soft)]"
                      onChange={(event) => setNewCategory(event.target.value)}
                      onKeyDown={(event) => {
                        if (event.key === "Enter") {
                          event.preventDefault();
                          commitNewCategory();
                        }
                      }}
                      placeholder="New category name"
                      value={newCategory}
                    />
                    <p className="mt-2 text-xs font-bold text-[var(--bb-muted)]">
                      This category will be selected when you continue.
                    </p>
                  </div>
                ) : null}
              </div>
              <Input
                label="Product handle"
                onChange={(event) => setHandle(event.target.value)}
                placeholder="raz-tn9000"
                value={handle}
              />
              {handleAlreadyExists ? (
                <InlineNotice tone="warning">
                  A product already uses /{normalizedHandle}. Choose a different handle or edit the existing product.
                </InlineNotice>
              ) : null}
            </div>
          </Card>
        ) : null}

        {currentStep === 2 ? (
          <Card elevated>
            <div className="grid gap-3">
              <Textarea
                label="Product description"
                onChange={(event) => setDescription(event.target.value)}
                placeholder="High-capacity disposable vape with bold flavor delivery."
                value={description}
              />
              <Select
                label="Collection"
                onChange={(event) => setCollectionId(event.target.value)}
                value={collectionId}
              >
                <option value="">No collection</option>
                {collections.map((collection) => (
                  <option key={collection.id} value={collection.id}>
                    {collection.title}
                  </option>
                ))}
              </Select>
              <div className="grid gap-3 sm:grid-cols-3">
                <Input
                  label="Puffs (optional)"
                  onChange={(event) => setSpecPuffs(event.target.value)}
                  placeholder="9000"
                  value={specPuffs}
                />
                <Input
                  label="Capacity (optional)"
                  onChange={(event) => setSpecCapacity(event.target.value)}
                  placeholder="12mL"
                  value={specCapacity}
                />
                <Input
                  label="Battery (optional)"
                  onChange={(event) => setSpecBattery(event.target.value)}
                  placeholder="650mAh"
                  value={specBattery}
                />
              </div>
              <MetadataRowsEditor rows={metadataRows} onChange={setMetadataRows} />
            </div>
          </Card>
        ) : null}

        {currentStep === 3 ? (
          <Card elevated>
            <div className="grid gap-3">
              <Input
                label="Variant name"
                onChange={(event) => setVariantTitle(event.target.value)}
                placeholder="Blue Razz Ice"
                value={variantTitle}
              />
              <Input
                label="SKU"
                onChange={(event) => setSku(event.target.value)}
                placeholder="RAZ-TN9000-BRI"
                value={sku}
              />
              <Input label="Barcode" onChange={(event) => setBarcode(event.target.value)} value={barcode} />
              <Input
                label="Price"
                min={0}
                onChange={(event) => setPrice(event.target.value)}
                placeholder="24.99"
                step="0.01"
                type="number"
                value={price}
              />
            </div>
          </Card>
        ) : null}

        {currentStep === 4 ? (
          <Card elevated>
            <div className="grid gap-3">
              <Input
                label="Available quantity"
                min={0}
                onChange={(event) => setAvailableQuantity(event.target.value)}
                placeholder="0"
                type="number"
                value={availableQuantity}
              />
              <Select
                label="Stock location"
                onChange={(event) => {
                  const nextState = event.target.value as InventoryState;
                  setInventoryState(nextState);

                  if (nextState === "IN_WAREHOUSE") {
                    setVehicleId("");
                  }
                }}
                value={inventoryState}
              >
                <option value="IN_WAREHOUSE">In warehouse</option>
                <option value="ON_VEHICLE">On vehicle</option>
              </Select>
              {inventoryState === "ON_VEHICLE" ? (
                <Select label="Delivery vehicle" onChange={(event) => setVehicleId(event.target.value)} value={vehicleId}>
                  <option value="">Choose vehicle</option>
                  {vehicles
                    .filter((vehicle) => vehicle.id !== "warehouse")
                    .map((vehicle) => (
                      <option key={vehicle.id} value={vehicle.id}>
                        {vehicle.label}
                      </option>
                    ))}
                </Select>
              ) : null}
            </div>
          </Card>
        ) : null}

        {currentStep === 5 ? (
          <Card elevated>
            <div className="space-y-4">
              <div>
                <p className="text-xs font-black uppercase text-[var(--bb-blaze)]">Product</p>
                <h2 className="mt-1 text-2xl font-black text-[var(--bb-charcoal)]">
                  {title.trim() || "Untitled product"}
                </h2>
                <p className="mt-1 text-sm font-bold text-[var(--bb-muted)]">
                  {brand.trim() ? `${brand.trim()} · ` : ""}
                  {category.trim() || "No category"}
                </p>
                <p className="mt-1 text-sm font-bold text-[var(--bb-muted)]">
                  {collections.find((collection) => collection.id === collectionId)?.title ?? "No collection"}
                </p>
              </div>

              <div className="rounded-3xl border border-[var(--bb-line)] bg-white p-4">
                <p className="text-xs font-black uppercase text-[var(--bb-muted)]">Storefront details</p>
                <p className="mt-1 text-sm font-bold text-[var(--bb-charcoal)]">
                  {description.trim() || "Missing description"}
                </p>
                <p className="mt-2 text-sm font-bold text-[var(--bb-muted)]">
                  Puffs: {specPuffs.trim() || "Not set"} · Capacity: {specCapacity.trim() || "Not set"} · Battery:{" "}
                  {specBattery.trim() || "Not set"}
                </p>
              </div>

              <div className="rounded-3xl border border-[var(--bb-line)] bg-[var(--bb-surface-warm)] p-4">
                <p className="text-xs font-black uppercase text-[var(--bb-muted)]">First variant</p>
                <p className="mt-1 text-lg font-black text-[var(--bb-charcoal)]">
                  {variantTitle.trim() || "Untitled variant"}
                </p>
                <p className="mt-1 text-sm font-bold text-[var(--bb-muted)]">
                  SKU: {sku.trim() || "Missing"} · Price: {price.trim() ? `$${price.trim()}` : "$0.00"}
                </p>
                <p className="mt-1 text-sm font-bold text-[var(--bb-muted)]">
                  {availableQuantityNumber} unit{availableQuantityNumber === 1 ? "" : "s"} ·{" "}
                  {inventoryState === "ON_VEHICLE"
                    ? activeVehicle?.label ?? "Vehicle not selected"
                    : "Warehouse"}
                </p>
              </div>

              {!canSubmit ? (
                <InlineNotice tone="warning">
                  Complete product name, handle, category, description, specs, variant name, and SKU before creating the product.
                </InlineNotice>
              ) : null}
              {handleAlreadyExists ? (
                <InlineNotice tone="warning">
                  A product already uses /{normalizedHandle}. Choose a different handle or edit the existing product.
                </InlineNotice>
              ) : null}
            </div>
          </Card>
        ) : null}

        <div className="sticky bottom-[calc(4.5rem+env(safe-area-inset-bottom))] z-40 rounded-3xl border border-[var(--bb-line)] bg-white/95 p-3 shadow-[0_-12px_30px_rgba(17,24,39,0.08)] backdrop-blur md:bottom-4">
          <div className="grid grid-cols-2 gap-2">
            <Button fullWidth disabled={busy || isFirstStep} onClick={goBack} type="button" variant="secondary">
              Back
            </Button>
            {isLastStep ? (
              <Button fullWidth disabled={!canContinue} loading={busy} type="submit">
                <Plus size={18} aria-hidden="true" />
                Create product
              </Button>
            ) : (
              <Button fullWidth disabled={!canContinue || busy} onClick={goNext} type="button">
                Continue
              </Button>
            )}
          </div>
        </div>
      </form>
    </>
  );
}

async function uploadProductImage(imageUpload: ProductImageUploadDraft) {
  const imageBlob = dataUrlToBlob(imageUpload.dataUrl);
  const maxBytes = 900 * 1024;

  if (imageBlob.size > maxBytes) {
    throw new Error("Product image is still too large after compression. Try a smaller or cropped photo.");
  }

  const formData = new FormData();
  formData.append("image", imageBlob, imageUpload.fileName || "product-photo.jpg");

  const response = await fetch("/api/inventory-image", {
    body: formData,
    method: "POST",
  });

  if (!response.ok) {
    const message = await readUploadErrorMessage(response);

    throw new Error(`Product image upload failed with HTTP ${response.status}: ${message}`);
  }

  const body = (await response.json()) as { url?: unknown };

  if (typeof body.url !== "string" || !body.url.trim()) {
    throw new Error("Product image upload did not return a URL.");
  }

  return body.url.trim();
}

function dataUrlToBlob(dataUrl: string) {
  const match = dataUrl.match(/^data:([^;]+);base64,(.+)$/);

  if (!match) {
    throw new Error("Product image could not be prepared for upload.");
  }

  const mimeType = match[1];
  const binary = window.atob(match[2]);
  const bytes = new Uint8Array(binary.length);

  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }

  return new Blob([bytes], { type: mimeType });
}

async function readUploadErrorMessage(response: Response) {
  try {
    const body = (await response.json()) as { message?: unknown };
    return typeof body.message === "string" && body.message.trim()
      ? body.message.trim()
      : response.statusText || "No response details returned.";
  } catch {
    return response.statusText || "No response details returned.";
  }
}

async function deleteUploadedProductImage(url: string) {
  await deleteUploadedProductImages([url]);
}

async function deleteUploadedProductImages(urls: string[]) {
  const uniqueUrls = Array.from(new Set(urls.filter(Boolean)));

  if (!uniqueUrls.length) {
    return;
  }

  const response = await fetch("/api/inventory-image", {
    body: JSON.stringify({ urls: uniqueUrls }),
    headers: {
      "Content-Type": "application/json",
    },
    keepalive: true,
    method: "DELETE",
  });

  if (!response.ok) {
    const message = await readUploadErrorMessage(response);

    throw new Error(`Product image cleanup failed with HTTP ${response.status}: ${message}`);
  }
}

function compressImageFileToDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const image = new window.Image();
    const objectUrl = URL.createObjectURL(file);

    image.addEventListener("load", () => {
      URL.revokeObjectURL(objectUrl);

      const targetMaxChars = 760_000;
      const dimensions = [1000, 850, 700, 560];
      const qualities = [0.68, 0.6, 0.52, 0.44];

      const canvas = document.createElement("canvas");
      const context = canvas.getContext("2d");

      if (!context) {
        reject(new Error("Unable to prepare product image."));
        return;
      }

      for (const maxDimension of dimensions) {
        const scale = Math.min(1, maxDimension / Math.max(image.width, image.height));
        const width = Math.max(1, Math.round(image.width * scale));
        const height = Math.max(1, Math.round(image.height * scale));

        canvas.width = width;
        canvas.height = height;
        context.clearRect(0, 0, width, height);
        context.drawImage(image, 0, 0, width, height);

        for (const quality of qualities) {
          const dataUrl = canvas.toDataURL("image/jpeg", quality);

          if (dataUrl.length <= targetMaxChars) {
            resolve(dataUrl);
            return;
          }
        }
      }

      reject(new Error("Product image is too large after compression."));
    });

    image.addEventListener("error", () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error("Unable to read product image."));
    });

    image.src = objectUrl;
  });
}

function toCompressedImageFileName(fileName: string) {
  const baseName = fileName.replace(/\.[a-zA-Z0-9]+$/, "") || "product-photo";

  return `${baseName}.jpg`;
}

function StepHeading({
  step,
  title,
}: {
  step: string;
  title: string;
}) {
  return (
    <div className="flex items-start gap-3">
      <Badge tone="brand">Step {step}</Badge>
      <div>
        <h3 className="text-lg font-black text-[var(--bb-charcoal)]">{title}</h3>
      </div>
    </div>
  );
}

function MetadataRowsEditor({
  rows,
  onChange,
}: {
  rows: MetadataRow[];
  onChange: (rows: MetadataRow[]) => void;
}) {
  function updateRow(rowId: string, field: "key" | "value", value: string) {
    onChange(rows.map((row) => (row.id === rowId ? { ...row, [field]: value } : row)));
  }

  function addRow() {
    onChange([...rows, { id: crypto.randomUUID(), key: "", value: "" }]);
  }

  function removeRow(rowId: string) {
    onChange(rows.filter((row) => row.id !== rowId));
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-3">
        <span className="text-xs font-black uppercase text-[var(--bb-muted)]">Additional metadata</span>
        <Button onClick={addRow} size="sm" type="button" variant="secondary">
          <Plus size={16} aria-hidden="true" />
          Add
        </Button>
      </div>
      {rows.length ? (
        <div className="space-y-2">
          {rows.map((row) => (
            <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] gap-2" key={row.id}>
              <Input
                aria-label="Metadata key"
                onChange={(event) => updateRow(row.id, "key", event.target.value)}
                placeholder="custom_key"
                value={row.key}
              />
              <Input
                aria-label="Metadata value"
                onChange={(event) => updateRow(row.id, "value", event.target.value)}
                placeholder="Value"
                value={row.value}
              />
              <Button
                aria-label="Remove metadata row"
                onClick={() => removeRow(row.id)}
                size="icon"
                title="Remove metadata row"
                type="button"
                variant="quiet"
              >
                <Trash2 size={16} aria-hidden="true" />
              </Button>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-sm font-bold text-[var(--bb-muted)]">No extra metadata.</p>
      )}
    </div>
  );
}

function metadataToRows(metadata: Record<string, string>) {
  return Object.entries(metadata)
    .filter(([key, value]) => !reservedProductMetadataKeys.has(key) && value.trim())
    .sort(([firstKey], [secondKey]) => firstKey.localeCompare(secondKey))
    .map(([key, value]) => ({ id: crypto.randomUUID(), key, value }));
}

function buildProductMetadataDraft({
  metadataRows,
  originalMetadata = {},
  specBattery,
  specCapacity,
  specPuffs,
}: {
  metadataRows: MetadataRow[];
  originalMetadata?: Record<string, string>;
  specBattery: string;
  specCapacity: string;
  specPuffs: string;
}) {
  const metadata: Record<string, string | null> = {
    spec_battery: specBattery.trim() || null,
    spec_capacity: specCapacity.trim() || null,
    spec_puffs: specPuffs.trim() || null,
  };
  const nextKeys = new Set<string>(Object.keys(metadata));

  for (const row of metadataRows) {
    const key = row.key.trim();

    if (!key || reservedProductMetadataKeys.has(key)) {
      continue;
    }

    metadata[key] = row.value.trim() || null;
    nextKeys.add(key);
  }

  for (const key of Object.keys(originalMetadata)) {
    if (!reservedProductMetadataKeys.has(key) && !nextKeys.has(key)) {
      metadata[key] = null;
    }
  }

  return metadata;
}

function ProductDetailsCard({
  busy,
  collections,
  product,
  categoryOptions,
  vehicles,
  onAddVariant,
  onAssignVehicle,
  onSetState,
  onUpdateProductDetails,
  onDeleteProduct,
  onUpdateQuantity,
  onUpdateVariantDetails,
}: {
  busy: boolean;
  collections: InventoryCollection[];
  product: InventoryProduct;
  categoryOptions: string[];
  vehicles: DeliveryVehicle[];
  onAddVariant: () => void;
  onAssignVehicle: (variantId: string, vehicleId: string) => void;
  onSetState: (variantId: string, state: InventoryState) => void;
  onUpdateProductDetails: (productId: string, draft: ProductUpdateDraft) => void;
  onDeleteProduct: () => void;
  onUpdateQuantity: (variantId: string, quantity: number) => void;
  onUpdateVariantDetails: (variantId: string, draft: VariantUpdateDraft) => void;
}) {
  const [title, setTitle] = useState(product.title);
  const [handle, setHandle] = useState(product.handle);
  const [category, setCategory] = useState(product.category);
  const [collectionId, setCollectionId] = useState(product.collectionId ?? "");
  const [description, setDescription] = useState(product.description);
  const [specPuffs, setSpecPuffs] = useState(product.metadata.spec_puffs ?? "");
  const [specCapacity, setSpecCapacity] = useState(product.metadata.spec_capacity ?? "");
  const [specBattery, setSpecBattery] = useState(product.metadata.spec_battery ?? "");
  const [metadataRows, setMetadataRows] = useState<MetadataRow[]>(() =>
    metadataToRows(product.metadata),
  );
  const [newCategory, setNewCategory] = useState("");
  const [isAddingCategory, setIsAddingCategory] = useState(false);
  const [imageUrl, setImageUrl] = useState(() => getProductImageUrls(product)[0] ?? "");
  const [selectedImageIndex, setSelectedImageIndex] = useState(0);
  const productImageUrls = useMemo(() => getProductImageUrls(product, imageUrl), [imageUrl, product]);
  const safeSelectedImageIndex =
    productImageUrls.length > 0 ? Math.min(selectedImageIndex, productImageUrls.length - 1) : 0;
  const productBrand = getProductVariantBrand(product);
  const addCategoryOptionValue = "__add_category__";
  const visibleCategoryOptions =
    category && !categoryOptions.includes(category) ? [...categoryOptions, category] : categoryOptions;

  function selectCategory(nextCategory: string) {
    if (nextCategory === addCategoryOptionValue) {
      setIsAddingCategory(true);
      setNewCategory("");
      return;
    }

    setCategory(nextCategory);
    setIsAddingCategory(false);
    setNewCategory("");
  }

  function saveNewCategory() {
    const nextCategory = newCategory.trim();

    if (!nextCategory) {
      return;
    }

    setCategory(nextCategory);
    setNewCategory("");
    setIsAddingCategory(false);
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const nextImageUrl = imageUrl.trim();
    const originalImageUrl = product.thumbnail?.trim() ?? "";

    onUpdateProductDetails(product.id, {
      category: category.trim(),
      collectionId: collectionId || null,
      description: description.trim(),
      handle: handle.trim(),
      imageUrl: nextImageUrl && nextImageUrl !== originalImageUrl ? nextImageUrl : undefined,
      metadata: buildProductMetadataDraft({
        metadataRows,
        originalMetadata: product.metadata,
        specBattery,
        specCapacity,
        specPuffs,
      }),
      title: title.trim(),
    });
  }

  function deleteProduct() {
    const confirmed = window.confirm(
      `Delete ${product.title}? This removes the product from Medusa inventory and the storefront after sync.`,
    );

    if (!confirmed) {
      return;
    }

    onDeleteProduct();
  }

  function publishProduct() {
    onUpdateProductDetails(product.id, {
      status: "published",
    });
  }

  function moveProductToDraft() {
    onUpdateProductDetails(product.id, {
      status: "draft",
    });
  }

  return (
    <Card className="flex min-h-full flex-col">
      <div className="flex items-center justify-between gap-3">
        <SectionHeader title="Product details" />
        <StatusBadge
          status={product.status === "published" ? "Published" : "Draft"}
          tone={product.status === "published" ? "success" : "warning"}
        />
      </div>
      <div className="mt-4 grid min-h-0 gap-4 lg:grid-cols-[220px_minmax(0,1fr)] lg:items-start">
        <ProductImageBrowser
          imageUrls={productImageUrls}
          productTitle={product.title}
          selectedIndex={safeSelectedImageIndex}
          onSelect={setSelectedImageIndex}
        />

        <form className="space-y-3" onSubmit={submit}>
        <Input label="Product name" onChange={(event) => setTitle(event.target.value)} value={title} />
        <Input label="Product handle" onChange={(event) => setHandle(event.target.value)} value={handle} />
        <div className="space-y-2">
          <Select
            label="Category"
            onChange={(event) => selectCategory(event.target.value)}
            value={isAddingCategory ? addCategoryOptionValue : category}
          >
            <option value="">Choose category</option>
            {visibleCategoryOptions.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
            <option value={addCategoryOptionValue}>+ Add Category</option>
          </Select>
          {isAddingCategory ? (
            <div className="rounded-3xl border border-[var(--bb-line)] bg-[var(--bb-surface-warm)] p-3">
              <input
                aria-label="New category name"
                className="h-11 w-full rounded-full border border-[var(--bb-line)] bg-white px-4 text-sm font-bold text-[var(--bb-charcoal)] outline-none transition placeholder:text-[var(--bb-muted)] focus:border-[var(--bb-blaze)] focus:ring-4 focus:ring-[var(--bb-blaze-soft)]"
                onChange={(event) => setNewCategory(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    saveNewCategory();
                  }
                }}
                placeholder="New category name"
                value={newCategory}
              />
              <Button
                className="mt-2 rounded-full"
                disabled={!newCategory.trim()}
                onClick={saveNewCategory}
                size="sm"
                type="button"
              >
                Save category
              </Button>
            </div>
          ) : null}
        </div>
        <Textarea
          label="Product description"
          onChange={(event) => setDescription(event.target.value)}
          value={description}
        />
        <Select label="Collection" onChange={(event) => setCollectionId(event.target.value)} value={collectionId}>
          <option value="">No collection</option>
          {collections.map((collection) => (
            <option key={collection.id} value={collection.id}>
              {collection.title}
            </option>
          ))}
        </Select>
        <div className="grid gap-3">
          <Input label="Puffs (optional)" onChange={(event) => setSpecPuffs(event.target.value)} value={specPuffs} />
          <Input label="Capacity (optional)" onChange={(event) => setSpecCapacity(event.target.value)} value={specCapacity} />
          <Input label="Battery (optional)" onChange={(event) => setSpecBattery(event.target.value)} value={specBattery} />
        </div>
        <MetadataRowsEditor rows={metadataRows} onChange={setMetadataRows} />
        <Input icon={<Image size={18} aria-hidden="true" />} label="Image URL" onChange={(event) => setImageUrl(event.target.value)} placeholder="https://..." type="url" value={imageUrl} />
        <Button fullWidth loading={busy} type="submit">
          Save product
        </Button>
        {product.status === "published" ? (
          <Button fullWidth disabled={busy} onClick={moveProductToDraft} type="button" variant="quiet">
            Move to draft
          </Button>
        ) : (
          <Button fullWidth disabled={busy} onClick={publishProduct} type="button" variant="secondary">
            Publish product
          </Button>
        )}
        <Button
          fullWidth
          disabled={busy}
          onClick={deleteProduct}
          type="button"
          variant="danger"
        >
          <Trash2 size={18} aria-hidden="true" />
          Delete product
        </Button>
        </form>
      </div>

      <details className="mt-5 rounded-3xl border border-[var(--bb-line)] bg-[var(--bb-surface-warm)] p-3 open:bg-white md:p-4">
        <summary className="flex cursor-pointer list-none items-center justify-between gap-3 text-left">
          <div>
            <p className="text-xs font-black uppercase text-[var(--bb-blaze)]">
              Variants
            </p>
            <p className="mt-1 text-sm font-bold text-[var(--bb-muted)]">
              {product.variants.length} variant{product.variants.length === 1 ? "" : "s"} attached to this product
            </p>
          </div>
          <Badge tone="neutral">Open</Badge>
        </summary>

        <div className="mt-4 space-y-4">
          <Button fullWidth onClick={onAddVariant} type="button">
            <Plus size={18} aria-hidden="true" />
            Add variant
          </Button>

          {product.variants.length === 0 ? (
            <EmptyState title="No variants yet">
              Add the first sellable variant for this product.
            </EmptyState>
          ) : (
            <div className="space-y-3">
              {product.variants.map((variant) => (
                <VariantContractCard
                  busy={busy}
                  key={`${variant.id}-${variant.updatedAt}-${variant.metadata.availableQuantity}`}
                  productBrand={productBrand}
                  variant={variant}
                  vehicles={vehicles}
                  onAssignVehicle={onAssignVehicle}
                  onSetState={onSetState}
                  onUpdateQuantity={onUpdateQuantity}
                  onUpdateVariantDetails={onUpdateVariantDetails}
                />
              ))}
            </div>
          )}
        </div>
      </details>
    </Card>
  );
}

function ProductImageBrowser({
  imageUrls,
  productTitle,
  selectedIndex,
  onSelect,
}: {
  imageUrls: string[];
  productTitle: string;
  selectedIndex: number;
  onSelect: (index: number) => void;
}) {
  const selectedImageUrl = imageUrls[selectedIndex] ?? imageUrls[0] ?? "";

  return (
    <aside className="rounded-3xl border border-[var(--bb-line)] bg-[var(--bb-surface-warm)] p-3">
      <div className="overflow-hidden rounded-2xl border border-[var(--bb-line)] bg-white">
        {selectedImageUrl ? (
          <img
            alt={productTitle}
            className="aspect-square w-full object-contain p-2"
            src={getInventoryImageSrc(selectedImageUrl)}
          />
        ) : (
          <div className="grid aspect-square place-items-center text-[var(--bb-muted)]">
            <Image size={30} aria-hidden="true" />
          </div>
        )}
      </div>

      <div className="mt-3">
        <p className="text-xs font-black uppercase text-[var(--bb-muted)]">
          Product images
        </p>

        {imageUrls.length > 1 ? (
          <div
            className="-mx-1 mt-2 flex gap-2 overflow-x-auto px-1 pb-1"
            aria-label="Product image thumbnails"
          >
            {imageUrls.map((imageUrl, index) => (
              <button
                aria-label={`Show product image ${index + 1}`}
                aria-pressed={selectedIndex === index}
                className={`grid size-14 shrink-0 place-items-center overflow-hidden rounded-2xl border bg-white transition ${
                  selectedIndex === index
                    ? "border-[var(--bb-blaze)] ring-2 ring-[var(--bb-blaze-soft)]"
                    : "border-[var(--bb-line)]"
                }`}
                key={`${imageUrl}-${index}`}
                onClick={() => onSelect(index)}
                type="button"
              >
                <img
                  alt=""
                  className="size-full object-cover"
                  src={getInventoryImageSrc(imageUrl)}
                />
              </button>
            ))}
          </div>
        ) : (
          <p className="mt-2 text-sm font-bold text-[var(--bb-muted)]">
            {imageUrls.length === 1 ? "1 image available." : "No images yet."}
          </p>
        )}
      </div>
    </aside>
  );
}

function getProductImageUrls(product: InventoryProduct, imageOverride = "") {
  const urls = [
    imageOverride,
    ...(product.imageUrls ?? []),
    product.thumbnail,
  ];

  return Array.from(
    new Set(
      urls
        .map((url) => (typeof url === "string" ? url.trim() : ""))
        .filter(Boolean),
    ),
  );
}

function getVariantThumbnailUrl(variant: InventoryVariant) {
  const urls = [
    ...(variant.imageUrls ?? []),
    variant.imageUrl,
    ...(variant.images ?? []).map((image) => (typeof image === "string" ? image : image.url ?? "")),
  ];

  return (
    urls
      .map((url) => (typeof url === "string" ? url.trim() : ""))
      .find(Boolean) ?? ""
  );
}

function getProductVariantBrand(product: InventoryProduct) {
  return product.variants.find((variant) => variant.metadata.brand?.trim())?.metadata.brand?.trim() ?? "";
}

function ProductThumbnail({ product }: { product: InventoryProduct }) {
  return (
    <span className="grid size-14 shrink-0 overflow-hidden rounded-2xl bg-[var(--bb-surface-warm)] text-[var(--bb-muted)] md:size-16">
      {product.thumbnail ? (
        <img alt="" className="size-full object-cover" src={getInventoryImageSrc(product.thumbnail)} />
      ) : (
        <span className="grid place-items-center">
          <Image size={22} aria-hidden="true" />
        </span>
      )}
    </span>
  );
}

function AddVariantWizard({
  busy,
  product,
  productBrand,
  vehicles,
  onCancel,
  onCreateVariant,
}: {
  busy: boolean;
  product: InventoryProduct;
  productBrand: string;
  vehicles: DeliveryVehicle[];
  onCancel: () => void;
  onCreateVariant: (draft: VariantDraft) => void;
}) {
  const [currentStep, setCurrentStep] = useState(0);
  const [imageUploads, setImageUploads] = useState<Array<ProductImageUploadDraft & { uploadedUrl?: string; uploading?: boolean }>>([]);
  const removedImageUploadsRef = useRef<Set<ProductImageUploadDraft>>(new Set());
  const [draggedPhotoIndex, setDraggedPhotoIndex] = useState<number | null>(null);
  const [dragOverPhotoIndex, setDragOverPhotoIndex] = useState<number | null>(null);
  const [dragPreview, setDragPreview] = useState<{ dataUrl: string; x: number; y: number } | null>(null);
  const [ploppedPhotoIndex, setPloppedPhotoIndex] = useState<number | null>(null);
  const [imageError, setImageError] = useState("");
  const [title, setTitle] = useState("");
  const [sku, setSku] = useState("");
  const [brand, setBrand] = useState(productBrand);
  const [barcode, setBarcode] = useState("");
  const [price, setPrice] = useState("");
  const [quantity, setQuantity] = useState("");
  const [inventoryState, setInventoryState] = useState<InventoryState>("IN_WAREHOUSE");
  const [vehicleId, setVehicleId] = useState("");

  const steps = ["Variant images", "Variant data", "Quantity and location", "Review"];
  const isFirstStep = currentStep === 0;
  const isLastStep = currentStep === steps.length - 1;
  const quantityNumber = Number(quantity || "0");
  const photosAreReady = imageUploads.every((upload) => !upload.uploading && upload.uploadedUrl);
  const activeVehicle = vehicles.find((vehicle) => vehicle.id === vehicleId);
  const canSubmit = Boolean(
    title.trim() &&
      sku.trim() &&
      photosAreReady &&
      quantity.trim().length > 0 &&
      Number.isFinite(quantityNumber) &&
      quantityNumber >= 0 &&
      (inventoryState === "IN_WAREHOUSE" || vehicleId),
  );
  const canContinue =
    (currentStep === 0 && photosAreReady) ||
    (currentStep === 1 && Boolean(title.trim() && sku.trim())) ||
    (currentStep === 2 &&
      quantity.trim().length > 0 &&
      Number.isFinite(quantityNumber) &&
      quantityNumber >= 0 &&
      (inventoryState === "IN_WAREHOUSE" || Boolean(vehicleId))) ||
    (isLastStep && canSubmit);

  async function handleVariantPhotoChange(event: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files ?? []);

    if (!files.length) {
      return;
    }

    const maxOriginalBytes = 30 * 1024 * 1024;
    const maxPhotos = 4;

    if (imageUploads.length + files.length > maxPhotos) {
      setImageError(`Add up to ${maxPhotos} variant photos.`);
      event.target.value = "";
      return;
    }

    for (const file of files) {
      if (!file.type.startsWith("image/")) {
        setImageError("Choose image files only.");
        event.target.value = "";
        return;
      }

      if (file.size > maxOriginalBytes) {
        setImageError("Choose images under 30 MB.");
        event.target.value = "";
        return;
      }
    }

    const nextUploads: Array<ProductImageUploadDraft & { uploadedUrl?: string; uploading?: boolean }> = [];

    for (const file of files) {
      try {
        const dataUrl = await compressImageFileToDataUrl(file);
        nextUploads.push({
          dataUrl,
          fileName: toCompressedImageFileName(file.name || "variant-photo"),
          mimeType: "image/jpeg",
          uploading: true,
        });
      } catch {
        setImageError("Unable to process one of those images. Try another photo.");
        event.target.value = "";
        return;
      }
    }

    setImageUploads((current) => [...current, ...nextUploads].slice(0, maxPhotos));
    setImageError("");
    event.target.value = "";

    for (const imageUpload of nextUploads) {
      try {
        const uploadedUrl = await uploadProductImage(imageUpload);

        if (removedImageUploadsRef.current.has(imageUpload)) {
          removedImageUploadsRef.current.delete(imageUpload);
          void deleteUploadedProductImage(uploadedUrl).catch(() => {
            setImageError("Image was removed, but Medusa cleanup failed. It will be cleaned up later.");
          });
          continue;
        }

        setImageUploads((current) =>
          current.map((item) =>
            item === imageUpload
              ? {
                  ...item,
                  uploadedUrl,
                  uploading: false,
                }
              : item,
          ),
        );
      } catch (caught) {
        removedImageUploadsRef.current.delete(imageUpload);
        setImageUploads((current) =>
          current.map((item) =>
            item === imageUpload
              ? {
                  ...item,
                  uploading: false,
                }
              : item,
          ),
        );
        setImageError(caught instanceof Error ? caught.message : "Variant image upload failed.");
      }
    }
  }

  function removeVariantPhoto(indexToRemove: number) {
    const uploadToRemove = imageUploads[indexToRemove];

    if (uploadToRemove?.uploadedUrl) {
      void deleteUploadedProductImage(uploadToRemove.uploadedUrl).catch(() => {
        setImageError("Unable to delete that temporary image from Medusa. It will be cleaned up later.");
      });
    } else if (uploadToRemove?.uploading) {
      removedImageUploadsRef.current.add(uploadToRemove);
    }

    setImageUploads((current) => current.filter((_, index) => index !== indexToRemove));
    setDraggedPhotoIndex(null);
    setDragOverPhotoIndex(null);
    setImageError("");
  }

  function reorderVariantPhoto(fromIndex: number, toIndex: number) {
    if (fromIndex === toIndex || fromIndex < 0 || toIndex < 0) {
      return;
    }

    setImageUploads((current) => {
      if (fromIndex >= current.length || toIndex >= current.length) {
        return current;
      }

      const nextUploads = [...current];
      const [movedUpload] = nextUploads.splice(fromIndex, 1);
      nextUploads.splice(toIndex, 0, movedUpload);

      return nextUploads;
    });
  }

  function getVariantPhotoIndexFromPoint(clientX: number, clientY: number) {
    const element = document.elementFromPoint(clientX, clientY);
    const photoTile = element?.closest("[data-variant-photo-index]");
    const rawIndex = photoTile?.getAttribute("data-variant-photo-index");
    const index = Number(rawIndex);

    return Number.isInteger(index) ? index : null;
  }

  function startVariantPhotoDrag(index: number, clientX: number, clientY: number) {
    const upload = imageUploads[index];

    if (!upload) {
      return;
    }

    setDraggedPhotoIndex(index);
    setDragOverPhotoIndex(index);
    setDragPreview({
      dataUrl: upload.dataUrl,
      x: clientX,
      y: clientY,
    });
  }

  function updateVariantPhotoDrag(clientX: number, clientY: number) {
    if (draggedPhotoIndex === null) {
      return;
    }

    setDragPreview((current) =>
      current
        ? {
            ...current,
            x: clientX,
            y: clientY,
          }
        : current,
    );

    const index = getVariantPhotoIndexFromPoint(clientX, clientY);

    if (index !== null) {
      setDragOverPhotoIndex(index);
    }
  }

  function finishVariantPhotoDrag(clientX: number, clientY: number) {
    if (draggedPhotoIndex === null) {
      return;
    }

    const dropIndex = getVariantPhotoIndexFromPoint(clientX, clientY);
    const finalDropIndex = dropIndex ?? dragOverPhotoIndex ?? draggedPhotoIndex;

    reorderVariantPhoto(draggedPhotoIndex, finalDropIndex);

    setPloppedPhotoIndex(finalDropIndex);
    window.setTimeout(() => {
      setPloppedPhotoIndex((current) => (current === finalDropIndex ? null : current));
    }, 240);

    setDraggedPhotoIndex(null);
    setDragOverPhotoIndex(null);
    setDragPreview(null);
  }

  function cancelVariantPhotoDrag() {
    setDraggedPhotoIndex(null);
    setDragOverPhotoIndex(null);
    setDragPreview(null);
  }

  function goNext() {
    if (!canContinue || isLastStep) {
      return;
    }

    setCurrentStep((step) => Math.min(step + 1, steps.length - 1));
  }

  function goBack() {
    setCurrentStep((step) => Math.max(step - 1, 0));
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!canSubmit) {
      return;
    }

    onCreateVariant({
      barcode: barcode.trim() || undefined,
      brand: (productBrand || brand).trim() || undefined,
      imageUrls: imageUploads.map((upload) => upload.uploadedUrl).filter((url): url is string => Boolean(url)),
      inventoryState,
      priceCents: dollarsToCents(price),
      quantity: quantityNumber,
      sku: sku.trim(),
      title: title.trim(),
      vehicleId: inventoryState === "ON_VEHICLE" ? vehicleId || undefined : undefined,
    });
  }

  return (
    <form className="space-y-4 pb-2" onSubmit={submit}>
      <Card elevated>
        <div className="flex items-center justify-between gap-3">
          <StepHeading step={String(currentStep + 1)} title={steps[currentStep]} />
          <Badge tone="neutral">
            {currentStep + 1} / {steps.length}
          </Badge>
        </div>
        <div className="mt-4 h-2 overflow-hidden rounded-full bg-[var(--bb-surface-warm)]">
          <div
            className="h-full rounded-full bg-[var(--bb-blaze)] transition-all"
            style={{ width: `${((currentStep + 1) / steps.length) * 100}%` }}
          />
        </div>
      </Card>

      {currentStep === 0 ? (
        <Card elevated>
          <div className="grid gap-4">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {imageUploads.map((upload, index) => {
                const isDragging = draggedPhotoIndex === index;
                const isDropTarget = dragOverPhotoIndex === index && draggedPhotoIndex !== null;
                const didJustPlop = ploppedPhotoIndex === index;

                return (
                  <div
                    className={[
                      "group relative touch-none select-none overflow-hidden rounded-3xl border bg-[var(--bb-surface-warm)] transition",
                      didJustPlop ? "animate-[bayblaze-photo-plop_240ms_ease-out]" : "",
                      isDragging
                        ? "scale-[0.92] border-[var(--bb-blaze)] opacity-25"
                        : isDropTarget
                          ? "border-[var(--bb-blaze)] ring-4 ring-[var(--bb-blaze-soft)]"
                          : "border-[var(--bb-line)]",
                    ].filter(Boolean).join(" ")}
                    data-variant-photo-index={index}
                    key={`${upload.fileName}-${index}`}
                    onPointerCancel={cancelVariantPhotoDrag}
                    onPointerDown={(event) => {
                      if (event.pointerType !== "mouse" || event.button !== 0) {
                        return;
                      }

                      startVariantPhotoDrag(index, event.clientX, event.clientY);
                    }}
                    onPointerMove={(event) => {
                      if (event.pointerType !== "mouse") {
                        return;
                      }

                      updateVariantPhotoDrag(event.clientX, event.clientY);
                    }}
                    onPointerUp={(event) => {
                      if (event.pointerType !== "mouse") {
                        return;
                      }

                      finishVariantPhotoDrag(event.clientX, event.clientY);
                    }}
                    onTouchCancel={cancelVariantPhotoDrag}
                    onTouchEnd={(event) => {
                      const touch = event.changedTouches[0];

                      if (!touch) {
                        cancelVariantPhotoDrag();
                        return;
                      }

                      finishVariantPhotoDrag(touch.clientX, touch.clientY);
                    }}
                    onTouchMove={(event) => {
                      const touch = event.touches[0];

                      if (!touch) {
                        return;
                      }

                      event.preventDefault();
                      updateVariantPhotoDrag(touch.clientX, touch.clientY);
                    }}
                    onTouchStart={(event) => {
                      const touch = event.touches[0];

                      if (!touch) {
                        return;
                      }

                      startVariantPhotoDrag(index, touch.clientX, touch.clientY);
                    }}
                    role="button"
                    tabIndex={0}
                  >
                    <img
                      alt=""
                      className="aspect-square w-full touch-none select-none object-cover"
                      draggable={false}
                      src={upload.dataUrl}
                    />
                    <button
                      aria-label={`Remove ${upload.fileName}`}
                      className="absolute right-2 top-2 rounded-full bg-white/95 px-3 py-1 text-xs font-black text-[var(--bb-charcoal)] shadow transition hover:bg-white"
                      onClick={(event) => {
                        event.stopPropagation();
                        removeVariantPhoto(index);
                      }}
                      onPointerDown={(event) => event.stopPropagation()}
                      onTouchStart={(event) => event.stopPropagation()}
                      type="button"
                    >
                      Remove
                    </button>
                    {upload.uploading ? (
                      <span className="pointer-events-none absolute bottom-2 left-2 rounded-full bg-white/95 px-3 py-1 text-xs font-black text-[var(--bb-muted)] shadow">
                        Uploading
                      </span>
                    ) : null}
                  </div>
                );
              })}

              <label className="grid aspect-square cursor-pointer place-items-center rounded-3xl border-2 border-dashed border-[var(--bb-line)] bg-white transition hover:border-[var(--bb-blaze)] hover:bg-[var(--bb-blaze-soft)]">
                <span className="grid place-items-center gap-2 text-center">
                  <span className="grid size-12 place-items-center rounded-full bg-[var(--bb-blaze-soft)] text-[var(--bb-blaze)]">
                    <Plus size={28} aria-hidden="true" />
                  </span>
                  <span className="text-xs font-black uppercase text-[var(--bb-muted)]">
                    Add Photo
                  </span>
                </span>
                <input
                  accept="image/*"
                  className="sr-only"
                  multiple
                  onChange={handleVariantPhotoChange}
                  type="file"
                />
              </label>
            </div>

            {imageError ? <InlineNotice tone="warning">{imageError}</InlineNotice> : null}
          </div>
        </Card>
      ) : null}

      {dragPreview ? (
        <div
          aria-hidden="true"
          className="pointer-events-none fixed z-[9999] size-28 -translate-x-1/2 -translate-y-1/2 overflow-hidden rounded-3xl border-2 border-white bg-white shadow-2xl transition-transform duration-75"
          style={{
            left: dragPreview.x,
            top: dragPreview.y,
            transform: "translate(-50%, -50%) scale(0.82) rotate(-2deg)",
          }}
        >
          <img alt="" className="h-full w-full object-cover" src={dragPreview.dataUrl} />
        </div>
      ) : null}

      {currentStep === 1 ? (
        <Card elevated>
          <div className="grid gap-3">
            <Input label="Variant name" onChange={(event) => setTitle(event.target.value)} placeholder="Blue Razz Ice" value={title} />
            <Input label="SKU" onChange={(event) => setSku(event.target.value)} placeholder="RAZ-TN9000-BRI" value={sku} />
            <div className="grid gap-3 sm:grid-cols-2">
              <Input
                disabled={Boolean(productBrand)}
                label="Brand"
                onChange={(event) => setBrand(event.target.value)}
                value={productBrand || brand}
              />
              <Input label="Barcode" onChange={(event) => setBarcode(event.target.value)} value={barcode} />
            </div>
            <Input
              label="Price"
              min={0}
              onChange={(event) => setPrice(event.target.value)}
              placeholder="24.99"
              step="0.01"
              type="number"
              value={price}
            />
          </div>
        </Card>
      ) : null}

      {currentStep === 2 ? (
        <Card elevated>
          <div className="grid gap-3">
            <Input
              label="Available quantity"
              min={0}
              onChange={(event) => setQuantity(event.target.value)}
              placeholder="0"
              type="number"
              value={quantity}
            />
            <Select
              label="Stock location"
              onChange={(event) => {
                const nextState = event.target.value as InventoryState;
                setInventoryState(nextState);

                if (nextState === "IN_WAREHOUSE") {
                  setVehicleId("");
                }
              }}
              value={inventoryState}
            >
              <option value="IN_WAREHOUSE">In warehouse</option>
              <option value="ON_VEHICLE">On vehicle</option>
            </Select>
            {inventoryState === "ON_VEHICLE" ? (
              <Select label="Delivery vehicle" onChange={(event) => setVehicleId(event.target.value)} value={vehicleId}>
                <option value="">Choose vehicle</option>
                {vehicles
                  .filter((vehicle) => vehicle.id !== "warehouse")
                  .map((vehicle) => (
                    <option key={vehicle.id} value={vehicle.id}>
                      {vehicle.label}
                    </option>
                  ))}
              </Select>
            ) : null}
          </div>
        </Card>
      ) : null}

      {currentStep === 3 ? (
        <Card elevated>
          <div className="space-y-4">
            <div>
              <p className="text-xs font-black uppercase text-[var(--bb-blaze)]">{product.title}</p>
              <h3 className="mt-1 text-2xl font-black text-[var(--bb-charcoal)]">
                {title.trim() || "Untitled variant"}
              </h3>
              <p className="mt-1 text-sm font-bold text-[var(--bb-muted)]">
                SKU: {sku.trim() || "Missing"} · Price: {price.trim() ? `$${price.trim()}` : "$0.00"}
              </p>
            </div>
            <div className="grid grid-cols-3 gap-2">
              {imageUploads.slice(0, 3).map((upload, index) => (
                <img
                  alt=""
                  className="aspect-square rounded-3xl border border-[var(--bb-line)] object-cover"
                  key={`${upload.fileName}-review-${index}`}
                  src={upload.dataUrl}
                />
              ))}
            </div>
            <p className="text-sm font-bold text-[var(--bb-muted)]">
              {quantityNumber} unit{quantityNumber === 1 ? "" : "s"} ·{" "}
              {inventoryState === "ON_VEHICLE" ? activeVehicle?.label ?? "Vehicle not selected" : "Warehouse"}
            </p>
            {!canSubmit ? (
              <InlineNotice tone="warning">
                Complete variant photos, name, SKU, quantity, and stock location before adding this variant.
              </InlineNotice>
            ) : null}
          </div>
        </Card>
      ) : null}

      <div className="sticky bottom-0 z-40 rounded-3xl border border-[var(--bb-line)] bg-white/95 p-3 shadow-[0_-12px_30px_rgba(17,24,39,0.08)] backdrop-blur">
        <div className="grid grid-cols-2 gap-2">
          {isFirstStep ? (
            <Button fullWidth disabled={busy} onClick={onCancel} type="button" variant="secondary">
              Cancel
            </Button>
          ) : (
            <Button fullWidth disabled={busy} onClick={goBack} type="button" variant="secondary">
              Back
            </Button>
          )}
          {isLastStep ? (
            <Button fullWidth disabled={!canContinue} loading={busy} type="submit">
              <Plus size={18} aria-hidden="true" />
              Add variant
            </Button>
          ) : (
            <Button fullWidth disabled={!canContinue || busy} onClick={goNext} type="button">
              Continue
            </Button>
          )}
        </div>
      </div>
    </form>
  );
}

function VariantContractCard({
  busy,
  productBrand,
  variant,
  vehicles,
  onAssignVehicle,
  onSetState,
  onUpdateQuantity,
  onUpdateVariantDetails,
}: {
  busy: boolean;
  productBrand: string;
  variant: InventoryVariant;
  vehicles: DeliveryVehicle[];
  onAssignVehicle: (variantId: string, vehicleId: string) => void;
  onSetState: (variantId: string, state: InventoryState) => void;
  onUpdateQuantity: (variantId: string, quantity: number) => void;
  onUpdateVariantDetails: (variantId: string, draft: VariantUpdateDraft) => void;
}) {
  const [title, setTitle] = useState(variant.title);
  const [sku, setSku] = useState(variant.sku);
  const [brand, setBrand] = useState(productBrand || variant.metadata.brand || "");
  const [barcode, setBarcode] = useState(variant.metadata.barcode ?? "");
  const [price, setPrice] = useState(centsToDollarsString(variant.priceCents));
  const [quantity, setQuantity] = useState(variant.metadata.availableQuantity);
  const [inventoryState, setInventoryState] = useState<InventoryState>(
    variant.metadata.inventoryState,
  );
  const [vehicleId, setVehicleId] = useState(variant.metadata.assignedVehicleId ?? "");

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const nextVehicleId = inventoryState === "ON_VEHICLE" ? vehicleId : undefined;

    onUpdateVariantDetails(variant.id, {
      barcode: barcode.trim() || undefined,
      brand: (productBrand || brand).trim() || undefined,
      inventoryState,
      priceCents: dollarsToCents(price),
      quantity,
      sku: sku.trim(),
      title: title.trim(),
      vehicleId: nextVehicleId,
    });
    onUpdateQuantity(variant.id, quantity);
    onSetState(variant.id, inventoryState);
    onAssignVehicle(variant.id, nextVehicleId ?? "warehouse");
  }

  return (
    <Card as="article" elevated>
      <form className="grid gap-4" onSubmit={submit}>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-xs font-black uppercase text-[var(--bb-blaze)]">
              {variant.productTitle}
            </p>
            <h3 className="mt-1 truncate text-xl font-black text-[var(--bb-charcoal)]">
              {variant.title}
            </h3>
          </div>
          <StatusBadge
            status={inventoryState === "ON_VEHICLE" ? "On vehicle" : "Warehouse"}
            tone={inventoryState === "ON_VEHICLE" ? "brand" : "info"}
          />
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <Input label="Variant name" onChange={(event) => setTitle(event.target.value)} value={title} />
          <Input label="SKU" onChange={(event) => setSku(event.target.value)} value={sku} />
          <Input
            disabled={Boolean(productBrand)}
            label="Brand"
            onChange={(event) => setBrand(event.target.value)}
            value={productBrand || brand}
          />
          <Input label="Barcode" onChange={(event) => setBarcode(event.target.value)} value={barcode} />
          <Input label="Price" min={0} onChange={(event) => setPrice(event.target.value)} step="0.01" type="number" value={price} />
          <Input label="Available quantity" min={0} onChange={(event) => setQuantity(Number(event.target.value))} type="number" value={quantity} />
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <Select label="Stock location" onChange={(event) => setInventoryState(event.target.value as InventoryState)} value={inventoryState}>
            <option value="IN_WAREHOUSE">In warehouse</option>
            <option value="ON_VEHICLE">On vehicle</option>
          </Select>
          {inventoryState === "ON_VEHICLE" ? (
            <Select label="Delivery vehicle" onChange={(event) => setVehicleId(event.target.value)} value={vehicleId}>
              <option value="">Choose vehicle</option>
              {vehicles
                .filter((vehicle) => vehicle.id !== "warehouse")
                .map((vehicle) => (
                  <option key={vehicle.id} value={vehicle.id}>
                    {vehicle.label}
                  </option>
                ))}
            </Select>
          ) : (
            <Input disabled label="Delivery vehicle" value="Not assigned" />
          )}
        </div>
        <Button fullWidth loading={busy} type="submit">
          Save variant
        </Button>
      </form>
    </Card>
  );
}

function groupProductsByCategory(products: InventoryProduct[]) {
  return [...products]
    .sort((first, second) => {
      const categoryCompare = (first.category || "Uncategorized").localeCompare(
        second.category || "Uncategorized",
        undefined,
        { sensitivity: "base" },
      );

      if (categoryCompare !== 0) {
        return categoryCompare;
      }

      return first.title.localeCompare(second.title, undefined, { sensitivity: "base" });
    })
    .reduce<Array<{ category: string; products: InventoryProduct[] }>>((groups, product) => {
      const category = product.category || "Uncategorized";
      const currentGroup = groups.at(-1);

      if (currentGroup?.category === category) {
        currentGroup.products.push(product);
      } else {
        groups.push({ category, products: [product] });
      }

      return groups;
    }, []);
}

function getCategoryOptions(products: InventoryProduct[]) {
  return Array.from(
    new Set(
      products
        .map((product) => product.category.trim())
        .filter((category) => category.length > 0),
    ),
  ).sort((first, second) => first.localeCompare(second, undefined, { sensitivity: "base" }));
}

function normalizeProductHandle(value: string) {
  return value.trim().toLowerCase().replace(/^\/+|\/+$/g, "");
}

function getInventoryImageSrc(value: string) {
  const imageUrl = value.trim();

  if (!imageUrl) {
    return "";
  }

  const pathname = getImagePathname(imageUrl);

  const match = pathname.match(/\/bayblaze\/inventory-images\/([^/?#]+)$/);

  if (!match) {
    return imageUrl;
  }

  return `/api/inventory-image?filename=${encodeURIComponent(match[1])}`;
}

function getImagePathname(imageUrl: string) {
  try {
    return new URL(imageUrl).pathname;
  } catch {
    return imageUrl;
  }
}

function flattenVariants(products: InventoryProduct[]) {
  return products.flatMap((product) => product.variants);
}

function formatMoney(cents: number) {
  return new Intl.NumberFormat(undefined, {
    currency: "USD",
    style: "currency",
  }).format(cents / 100);
}

function centsToDollarsString(cents: number) {
  if (!cents) {
    return "";
  }

  return (cents / 100).toFixed(2);
}

function dollarsToCents(value: string) {
  const dollars = Number(value);

  if (!Number.isFinite(dollars) || dollars <= 0) {
    return 0;
  }

  return Math.round(dollars * 100);
}

export default App;
