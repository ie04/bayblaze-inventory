import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from "react";
import {
  AlertTriangle,
  Barcode,
  Boxes,
  CheckCircle2,
  ClipboardCheck,
  Image,
  Package,
  Plus,
  RefreshCw,
  Search,
  ShieldCheck,
  Truck,
  Warehouse,
  X,
} from "lucide-react";

import {
  ActionBar,
  AppShell,
  Badge,
  Button,
  Card,
  EmptyState,
  ErrorState,
  Input,
  InlineNotice,
  LoadingState,
  MetricCard,
  PageHeader,
  Select,
  SectionHeader,
  StatusBadge,
} from "./components/ui";
import { auditContract, loadInventory, mutateInventory } from "./lib/inventoryApi";
import type {
  ContractIssue,
  DeliveryVehicle,
  InventoryProduct,
  InventorySnapshot,
  InventoryState,
  InventoryVariant,
  ProductUpdateDraft,
  ProductWithVariantDraft,
  VariantDraft,
  VariantUpdateDraft,
} from "./lib/types";

type View = "overview" | "products" | "add-product" | "stock" | "vehicles" | "contract";

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
  const [query, setQuery] = useState("");

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
      setSnapshot(await mutateInventory(...args));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Inventory update failed.");
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    const timer = window.setTimeout(() => void refreshInventory(), 0);
    return () => window.clearTimeout(timer);
  }, []);

  const variants = useMemo(() => flattenVariants(snapshot?.products ?? []), [snapshot]);
  const filteredVariants = useMemo(
    () => variants.filter((variant) => matchesVariant(variant, query)),
    [query, variants],
  );
  const issues = useMemo(() => auditContract(snapshot?.products ?? []), [snapshot]);
  const stats = useMemo(() => getStats(variants, issues), [issues, variants]);

  const activeScreen = snapshot ? (
    <InventoryScreen
      busy={busy}
      issues={issues}
      products={snapshot.products}
      query={query}
      stats={stats}
      variants={filteredVariants}
      vehicles={snapshot.vehicles}
      view={activeView}
      onCreateProductWithVariant={(draft) =>
        void applyMutation({ type: "create-product-with-variant", draft })
      }
      onCreateVariant={(productId, draft) =>
        void applyMutation({ type: "create-variant", productId, draft })
      }
      onOpenAddProduct={() => setActiveView("add-product")}
      onUpdateProductDetails={(productId, draft) =>
        void applyMutation({ type: "update-product-details", productId, draft })
      }
      onUpdateVariantDetails={(variantId, draft) =>
        void applyMutation({ type: "update-variant-details", variantId, draft })
      }
      onQueryChange={setQuery}
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
                status={snapshot?.source === "api" ? "Medusa API" : "Demo data"}
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
          <div className="page-transition mx-auto flex min-h-0 w-full max-w-5xl flex-col gap-4 md:gap-5">
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
  issues,
  products,
  query,
  stats,
  variants,
  vehicles,
  view,
  onAssignVehicle,
  onCreateProductWithVariant,
  onCreateVariant,
  onOpenAddProduct,
  onUpdateProductDetails,
  onUpdateVariantDetails,
  onQueryChange,
  onSetState,
  onUpdateQuantity,
}: {
  busy: boolean;
  issues: ContractIssue[];
  products: InventoryProduct[];
  query: string;
  stats: ReturnType<typeof getStats>;
  variants: InventoryVariant[];
  vehicles: DeliveryVehicle[];
  view: View;
  onAssignVehicle: (variantId: string, vehicleId: string) => void;
  onCreateProductWithVariant: (draft: ProductWithVariantDraft) => void;
  onCreateVariant: (productId: string, draft: VariantDraft) => void;
  onOpenAddProduct: () => void;
  onUpdateProductDetails: (productId: string, draft: ProductUpdateDraft) => void;
  onUpdateVariantDetails: (variantId: string, draft: VariantUpdateDraft) => void;
  onQueryChange: (query: string) => void;
  onSetState: (variantId: string, state: InventoryState) => void;
  onUpdateQuantity: (variantId: string, quantity: number) => void;
}) {
  if (view === "products") {
    return (
      <ProductsView
        busy={busy}
        products={products}
        vehicles={vehicles}
        onAssignVehicle={onAssignVehicle}
        onCreateVariant={onCreateVariant}
        onOpenAddProduct={onOpenAddProduct}
        onSetState={onSetState}
        onUpdateProductDetails={onUpdateProductDetails}
        onUpdateProductImage={onUpdateProductImage}
        onUpdateQuantity={onUpdateQuantity}
        onUpdateVariantDetails={onUpdateVariantDetails}
      />
    );
  }

  if (view === "add-product") {
    return (
      <AddProductFlow
        busy={busy}
        vehicles={vehicles}
        onCreateProductWithVariant={onCreateProductWithVariant}
      />
    );
  }

  if (view === "stock") {
    return (
      <StockView
        busy={busy}
        query={query}
        variants={variants}
        vehicles={vehicles}
        onAssignVehicle={onAssignVehicle}
        onQueryChange={onQueryChange}
        onSetState={onSetState}
        onUpdateVariantDetails={onUpdateVariantDetails}
        onUpdateQuantity={onUpdateQuantity}
      />
    );
  }

  if (view === "vehicles") {
    return <VehiclesView variants={variants} vehicles={vehicles} onAssignVehicle={onAssignVehicle} />;
  }

  if (view === "contract") {
    return <ContractView issues={issues} products={products} />;
  }

  return (
    <OverviewView
      busy={busy}
      issues={issues}
      stats={stats}
      variants={variants}
      vehicles={vehicles}
      onAssignVehicle={onAssignVehicle}
      onUpdateQuantity={onUpdateQuantity}
    />
  );
}

function OverviewView({
  busy,
  issues,
  stats,
  variants,
  vehicles,
  onAssignVehicle,
  onUpdateQuantity,
}: {
  busy: boolean;
  issues: ContractIssue[];
  stats: ReturnType<typeof getStats>;
  variants: InventoryVariant[];
  vehicles: DeliveryVehicle[];
  onAssignVehicle: (variantId: string, vehicleId: string) => void;
  onUpdateQuantity: (variantId: string, quantity: number) => void;
}) {
  const lowStock = variants.filter((variant) => variant.metadata.availableQuantity <= 5);

  return (
    <>
      <PageHeader
        eyebrow="Inventory command"
        icon={<Boxes size={24} aria-hidden="true" />}
        title="Stockroom control"
      />
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard icon={<Boxes size={16} />} label="Sellable variants" value={stats.variantCount} />
        <MetricCard icon={<Warehouse size={16} />} label="Warehouse units" value={stats.warehouseUnits} />
        <MetricCard icon={<Truck size={16} />} label="Vehicle units" value={stats.vehicleUnits} />
        <MetricCard icon={<ShieldCheck size={16} />} label="Contract issues" value={stats.issueCount} />
      </div>
      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_340px]">
        <Card elevated>
          <SectionHeader title="Fast stock moves" subtitle="Use this for routine count corrections." />
          <div className="mt-4 space-y-3">
            {variants.slice(0, 5).map((variant) => (
              <VariantStockRow
                busy={busy}
                key={`${variant.id}-${variant.updatedAt}-${variant.metadata.availableQuantity}`}
                variant={variant}
                vehicles={vehicles}
                onAssignVehicle={onAssignVehicle}
                onUpdateQuantity={onUpdateQuantity}
              />
            ))}
          </div>
        </Card>
        <Card className="p-3 md:p-5">
          <SectionHeader title="Needs attention" subtitle="Low stock and metadata problems." />
          <div className="mt-4 space-y-3">
            {lowStock.length === 0 && issues.length === 0 ? (
              <InlineNotice tone="success">All tracked variants look ready for storefront, driver, and routing workflows.</InlineNotice>
            ) : null}
            {lowStock.slice(0, 3).map((variant) => (
              <AttentionItem key={variant.id} tone="warning" title={variant.title}>
                {variant.productTitle} has {variant.metadata.availableQuantity} units available.
              </AttentionItem>
            ))}
            {issues.slice(0, 3).map((issue) => (
              <AttentionItem key={issue.id} tone={issue.severity} title={issue.variantTitle}>
                {issue.message}
              </AttentionItem>
            ))}
          </div>
        </Card>
      </div>
    </>
  );
}

function ProductsView({
  busy,
  products,
  vehicles,
  onAssignVehicle,
  onCreateVariant,
  onOpenAddProduct,
  onSetState,
  onUpdateProductDetails,
  onUpdateQuantity,
  onUpdateVariantDetails,
}: {
  busy: boolean;
  products: InventoryProduct[];
  vehicles: DeliveryVehicle[];
  onAssignVehicle: (variantId: string, vehicleId: string) => void;
  onCreateVariant: (productId: string, draft: VariantDraft) => void;
  onOpenAddProduct: () => void;
  onSetState: (variantId: string, state: InventoryState) => void;
  onUpdateProductDetails: (productId: string, draft: ProductUpdateDraft) => void;
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
          product={editingProduct}
          categoryOptions={categoryOptions}
          vehicles={vehicles}
          onAssignVehicle={onAssignVehicle}
          onClose={() => setEditingProductId(null)}
          onCreateVariant={onCreateVariant}
          onSetState={onSetState}
          onUpdateProductDetails={onUpdateProductDetails}
          onUpdateProductImage={onUpdateProductImage}
          onUpdateQuantity={onUpdateQuantity}
          onUpdateVariantDetails={onUpdateVariantDetails}
        />
      ) : null}
    </>
  );
}

function StockView({
  busy,
  query,
  variants,
  vehicles,
  onAssignVehicle,
  onQueryChange,
  onSetState,
  onUpdateVariantDetails,
  onUpdateQuantity,
}: {
  busy: boolean;
  query: string;
  variants: InventoryVariant[];
  vehicles: DeliveryVehicle[];
  onAssignVehicle: (variantId: string, vehicleId: string) => void;
  onQueryChange: (query: string) => void;
  onSetState: (variantId: string, state: InventoryState) => void;
  onUpdateVariantDetails: (variantId: string, draft: VariantUpdateDraft) => void;
  onUpdateQuantity: (variantId: string, quantity: number) => void;
}) {
  return (
    <>
      <PageHeader
        eyebrow="Scanner"
        icon={<Barcode size={24} aria-hidden="true" />}
        title="Stock updates"
      />
      <Card>
        <Input
          icon={<Search size={18} aria-hidden="true" />}
          label="Find variant"
          onChange={(event) => onQueryChange(event.target.value)}
          placeholder="Scan or type barcode, SKU, brand, flavor..."
          value={query}
        />
      </Card>
      <div className="space-y-3">
        {variants.length === 0 ? (
          <EmptyState icon={<Barcode size={22} aria-hidden="true" />} title="No variants found">
            Try another barcode, SKU, brand, or product name.
          </EmptyState>
        ) : (
          variants.map((variant) => (
            <VariantContractCard
              busy={busy}
              key={`${variant.id}-${variant.updatedAt}-${variant.metadata.availableQuantity}`}
              variant={variant}
              vehicles={vehicles}
              onAssignVehicle={onAssignVehicle}
              onSetState={onSetState}
              onUpdateVariantDetails={onUpdateVariantDetails}
              onUpdateQuantity={onUpdateQuantity}
            />
          ))
        )}
      </div>
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
                      assigned.map((variant) => (
                        <div
                          key={variant.id}
                          className="grid gap-3 rounded-2xl bg-[var(--bb-surface-warm)] p-3 sm:flex sm:items-center sm:justify-between"
                        >
                          <div className="min-w-0">
                            <p className="truncate text-sm font-black text-[var(--bb-charcoal)]">
                              {variant.productTitle}
                            </p>
                            <p className="truncate text-xs font-bold text-[var(--bb-muted)]">
                              {variant.title} - {variant.sku}
                            </p>
                          </div>
                          <div className="flex shrink-0 items-center justify-between gap-2 sm:justify-start">
                            <Badge tone="brand">{variant.metadata.availableQuantity} units</Badge>
                            <Button
                              aria-label={`Move ${variant.title} to warehouse`}
                              onClick={() => onAssignVehicle(variant.id, "warehouse")}
                              size="icon"
                              title="Move to warehouse"
                              variant="secondary"
                            >
                              <Warehouse size={17} aria-hidden="true" />
                            </Button>
                          </div>
                        </div>
                      ))
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

function ContractView({ issues, products }: { issues: ContractIssue[]; products: InventoryProduct[] }) {
  const variants = flattenVariants(products);

  return (
    <>
      <PageHeader
        eyebrow="Metadata"
        icon={<ClipboardCheck size={24} aria-hidden="true" />}
        title="Contract audit"
      />
      <Card tone={issues.length ? "warm" : "default"} elevated>
        <div className="flex items-start gap-3">
          <span className="grid size-10 shrink-0 place-items-center rounded-2xl bg-white text-[var(--bb-charcoal)] md:size-12">
            {issues.length ? <AlertTriangle size={23} aria-hidden="true" /> : <CheckCircle2 size={23} aria-hidden="true" />}
          </span>
          <div>
            <h2 className="text-xl font-black leading-tight text-[var(--bb-charcoal)] md:text-2xl">
              {issues.length ? `${issues.length} contract checks need attention` : "Metadata contract is clean"}
            </h2>
            <p className="mt-2 text-sm font-semibold leading-6 text-[var(--bb-muted)]">
              Required variant metadata: inventoryState, availableQuantity, assignedVehicleId for vehicle stock, barcode when available, and brand.
            </p>
          </div>
        </div>
      </Card>
      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_340px]">
        <Card>
          <SectionHeader title="Audit results" subtitle={`${variants.length} variants checked`} />
          <div className="mt-4 space-y-3">
            {issues.length === 0 ? (
              <EmptyState icon={<ShieldCheck size={22} aria-hidden="true" />} title="No issues found">
                Product variants are ready for BayBlaze clients.
              </EmptyState>
            ) : (
              issues.map((issue) => (
                <AttentionItem key={issue.id} tone={issue.severity} title={issue.variantTitle}>
                  {issue.productTitle}: {issue.message}
                </AttentionItem>
              ))
            )}
          </div>
        </Card>
        <Card>
          <SectionHeader title="Variant metadata" subtitle="Current required fields" />
          <div className="mt-4 space-y-3 text-sm font-semibold text-[var(--bb-muted)]">
            <MetadataRule label="inventoryState" value="ON_VEHICLE or IN_WAREHOUSE" />
            <MetadataRule label="availableQuantity" value="Integer >= 0" />
            <MetadataRule label="assignedVehicleId" value="Required for ON_VEHICLE" />
            <MetadataRule label="barcode" value="Recommended for scan speed" />
            <MetadataRule label="brand" value="Recommended for filters and matching" />
          </div>
        </Card>
      </div>
    </>
  );
}

function ProductCard({
  product,
  onSelect,
}: {
  product: InventoryProduct;
  onSelect: () => void;
}) {
  const units = product.variants.reduce((sum, variant) => sum + variant.metadata.availableQuantity, 0);
  const brand = product.variants.find((variant) => variant.metadata.brand)?.metadata.brand;
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
  product,
  categoryOptions,
  vehicles,
  onAssignVehicle,
  onClose,
  onCreateVariant,
  onSetState,
  onUpdateProductDetails,
  onUpdateQuantity,
  onUpdateVariantDetails,
}: {
  busy: boolean;
  product: InventoryProduct;
  categoryOptions: string[];
  vehicles: DeliveryVehicle[];
  onAssignVehicle: (variantId: string, vehicleId: string) => void;
  onClose: () => void;
  onCreateVariant: (productId: string, draft: VariantDraft) => void;
  onSetState: (variantId: string, state: InventoryState) => void;
  onUpdateProductDetails: (productId: string, draft: ProductUpdateDraft) => void;
  onUpdateQuantity: (variantId: string, quantity: number) => void;
  onUpdateVariantDetails: (variantId: string, draft: VariantUpdateDraft) => void;
}) {
  return (
    <div className="fixed inset-0 z-50 bg-black/45 p-2 md:p-6" role="dialog" aria-modal="true">
      <div className="mx-auto flex max-h-[calc(100svh-1rem)] w-full max-w-4xl flex-col overflow-hidden rounded-[22px] bg-white shadow-[var(--bb-shadow-shell)] md:max-h-[calc(100svh-3rem)] md:rounded-[var(--bb-radius-shell)]">
        <header className="flex items-start justify-between gap-3 border-b border-[var(--bb-line)] px-4 py-3 md:px-5 md:py-4">
          <div className="flex min-w-0 items-start gap-3">
            <ProductThumbnail product={product} />
            <div className="min-w-0">
              <p className="text-xs font-black uppercase text-[var(--bb-blaze)]">
                Product editor
              </p>
              <h2 className="truncate text-xl font-black text-[var(--bb-charcoal)] md:text-2xl">
                {product.title}
              </h2>
              <p className="mt-1 text-sm font-bold text-[var(--bb-muted)]">
                {product.variants.length} variant{product.variants.length === 1 ? "" : "s"}
              </p>
            </div>
          </div>
          <Button aria-label="Close product editor" onClick={onClose} size="icon" title="Close product editor" variant="secondary">
            <X size={18} aria-hidden="true" />
          </Button>
        </header>
        <div className="min-h-0 flex-1 overflow-y-auto px-3 py-4 md:px-5 md:py-5">
          <div className="grid gap-5 lg:grid-cols-[320px_minmax(0,1fr)]">
            <div className="space-y-5">
              <ProductDetailsCard
                busy={busy}
                product={product}
                categoryOptions={categoryOptions}
                onUpdateProductDetails={onUpdateProductDetails}
                onUpdateProductImage={onUpdateProductImage}
              />
              <CreateVariantCard
                busy={busy}
                productId={product.id}
                products={[product]}
                vehicles={vehicles}
                onCreateVariant={onCreateVariant}
                onProductChange={() => undefined}
              />
            </div>
            <div className="space-y-3">
              <SectionHeader title="Variants" subtitle="Edit sellable units and contract data." />
              {product.variants.length === 0 ? (
                <EmptyState title="No variants yet">
                  Add the first sellable variant for this product.
                </EmptyState>
              ) : (
                product.variants.map((variant) => (
                  <VariantContractCard
                    busy={busy}
                    key={`${variant.id}-${variant.updatedAt}-${variant.metadata.availableQuantity}`}
                    variant={variant}
                    vehicles={vehicles}
                    onAssignVehicle={onAssignVehicle}
                    onSetState={onSetState}
                    onUpdateQuantity={onUpdateQuantity}
                    onUpdateVariantDetails={onUpdateVariantDetails}
                  />
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function AddProductFlow({
  busy,
  vehicles,
  onCreateProductWithVariant,
}: {
  busy: boolean;
  vehicles: DeliveryVehicle[];
  onCreateProductWithVariant: (draft: ProductWithVariantDraft) => void;
}) {
  const [brand, setBrand] = useState("");
  const [title, setTitle] = useState("");
  const [handle, setHandle] = useState("");
  const [category, setCategory] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [variantTitle, setVariantTitle] = useState("");
  const [sku, setSku] = useState("");
  const [barcode, setBarcode] = useState("");
  const [price, setPrice] = useState("");
  const [inventoryState, setInventoryState] = useState<InventoryState>("IN_WAREHOUSE");
  const [availableQuantity, setAvailableQuantity] = useState(0);
  const [vehicleId, setVehicleId] = useState("");

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!title.trim() || !handle.trim() || !category.trim() || !variantTitle.trim() || !sku.trim()) {
      return;
    }

    onCreateProductWithVariant({
      title: title.trim(),
      handle: handle.trim(),
      category: category.trim(),
      imageUrl: imageUrl.trim() || undefined,
      variant: {
        barcode: barcode.trim() || undefined,
        brand: brand.trim() || undefined,
        inventoryState,
        priceCents: dollarsToCents(price),
        quantity: availableQuantity,
        sku: sku.trim(),
        title: variantTitle.trim(),
        vehicleId: inventoryState === "ON_VEHICLE" ? vehicleId || undefined : undefined,
      },
    });
  }

  return (
    <>
      <PageHeader
        icon={<Plus size={24} aria-hidden="true" />}
        title="Add a Product"
      />
      <form className="space-y-5" onSubmit={submit}>
        <Card elevated>
          <StepHeading
            step="1"
            title="Product image"
          />
          <div className="mt-4 grid gap-3 md:grid-cols-[220px_minmax(0,1fr)]">
            <div className="overflow-hidden rounded-2xl border border-[var(--bb-line)] bg-[var(--bb-surface-warm)]">
              {imageUrl.trim() ? (
                <img alt="" className="aspect-[4/3] w-full object-cover" src={imageUrl.trim()} />
              ) : (
                <div className="grid aspect-[4/3] place-items-center text-[var(--bb-muted)]">
                  <Image size={32} aria-hidden="true" />
                </div>
              )}
            </div>
            <Input
              icon={<Image size={18} aria-hidden="true" />}
              label="Product image URL"
              onChange={(event) => setImageUrl(event.target.value)}
              placeholder="https://..."
              type="url"
              value={imageUrl}
            />
          </div>
        </Card>

        <Card elevated>
          <StepHeading
            step="2"
            title="Product identity"
          />
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <Input label="Product name" onChange={(event) => setTitle(event.target.value)} placeholder="RAZ TN9000" value={title} />
            <Input label="Brand" onChange={(event) => setBrand(event.target.value)} placeholder="RAZ" value={brand} />
            <Input label="Category" onChange={(event) => setCategory(event.target.value)} placeholder="Vapes" value={category} />
            <Input label="Product handle" onChange={(event) => setHandle(event.target.value)} placeholder="raz-tn9000" value={handle} />
          </div>
        </Card>

        <Card elevated>
          <StepHeading
            step="3"
            title="First variant"
          />
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <Input label="Variant name" onChange={(event) => setVariantTitle(event.target.value)} placeholder="Blue Razz Ice" value={variantTitle} />
            <Input label="SKU" onChange={(event) => setSku(event.target.value)} placeholder="RAZ-TN9000-BRI" value={sku} />
            <Input label="Barcode" onChange={(event) => setBarcode(event.target.value)} value={barcode} />
            <Input label="Price" min={0} onChange={(event) => setPrice(event.target.value)} placeholder="24.99" step="0.01" type="number" value={price} />
          </div>
        </Card>

        <Card elevated>
          <StepHeading
            step="4"
            title="Quantity and location"
          />
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <Input label="Available quantity" min={0} onChange={(event) => setAvailableQuantity(Number(event.target.value))} type="number" value={availableQuantity} />
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
            ) : null}
          </div>
          <div className="mt-5">
            <Button fullWidth loading={busy} type="submit">
              <Plus size={18} aria-hidden="true" />
              Create product and first variant
            </Button>
          </div>
        </Card>
      </form>
    </>
  );
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

function ProductDetailsCard({
  busy,
  product,
  categoryOptions,
  onUpdateProductDetails,
}: {
  busy: boolean;
  product: InventoryProduct;
  categoryOptions: string[];
  onUpdateProductDetails: (productId: string, draft: ProductUpdateDraft) => void;
}) {
  const [title, setTitle] = useState(product.title);
  const [handle, setHandle] = useState(product.handle);
  const [category, setCategory] = useState(product.category);
  const [newCategory, setNewCategory] = useState("");
  const [isAddingCategory, setIsAddingCategory] = useState(false);
  const [imageUrl, setImageUrl] = useState(product.thumbnail ?? "");
  const visibleCategoryOptions =
    category && !categoryOptions.includes(category) ? [...categoryOptions, category] : categoryOptions;

  function useNewCategory() {
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

    onUpdateProductDetails(product.id, {
      category: category.trim(),
      handle: handle.trim(),
      imageUrl: nextImageUrl || undefined,
      title: title.trim(),
    });

  }

  return (
    <Card>
      <SectionHeader title="Product details" subtitle="Edit catalog fields and photo." />
      <div className="mt-4 overflow-hidden rounded-2xl border border-[var(--bb-line)] bg-[var(--bb-surface-warm)]">
        {imageUrl.trim() ? (
          <img alt="" className="aspect-[4/3] w-full object-cover" src={imageUrl.trim()} />
        ) : (
          <div className="grid aspect-[4/3] place-items-center text-[var(--bb-muted)]">
            <Image size={32} aria-hidden="true" />
          </div>
        )}
      </div>
      <form className="mt-4 space-y-3" onSubmit={submit}>
        <Input label="Product name" onChange={(event) => setTitle(event.target.value)} value={title} />
        <Input label="Product handle" onChange={(event) => setHandle(event.target.value)} value={handle} />
        <div className="space-y-2">
          <Select label="Category" onChange={(event) => setCategory(event.target.value)} value={category}>
            <option value="">Choose category</option>
            {visibleCategoryOptions.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </Select>
          <div className="grid gap-2 sm:grid-cols-[auto_minmax(0,1fr)_auto]">
            <Button
              onClick={() => setIsAddingCategory((current) => !current)}
              type="button"
              variant="secondary"
            >
              {isAddingCategory ? "Cancel" : "Add category"}
            </Button>
            {isAddingCategory ? (
              <>
                <Input
                  label="New category"
                  onChange={(event) => setNewCategory(event.target.value)}
                  placeholder="Accessories"
                  value={newCategory}
                />
                <Button onClick={useNewCategory} type="button">
                  Use category
                </Button>
              </>
            ) : null}
          </div>
        </div>
        <Input icon={<Image size={18} aria-hidden="true" />} label="Image URL" onChange={(event) => setImageUrl(event.target.value)} placeholder="https://..." type="url" value={imageUrl} />
        <Button fullWidth loading={busy} type="submit">
          Save product
        </Button>
      </form>
    </Card>
  );
}

function ProductThumbnail({ product }: { product: InventoryProduct }) {
  return (
    <span className="grid size-14 shrink-0 overflow-hidden rounded-2xl bg-[var(--bb-surface-warm)] text-[var(--bb-muted)] md:size-16">
      {product.thumbnail ? (
        <img alt="" className="size-full object-cover" src={product.thumbnail} />
      ) : (
        <span className="grid place-items-center">
          <Image size={22} aria-hidden="true" />
        </span>
      )}
    </span>
  );
}

function CreateVariantCard({
  busy,
  productId,
  products,
  vehicles,
  onCreateVariant,
  onProductChange,
}: {
  busy: boolean;
  productId: string;
  products: InventoryProduct[];
  vehicles: DeliveryVehicle[];
  onCreateVariant: (productId: string, draft: VariantDraft) => void;
  onProductChange: (productId: string) => void;
}) {
  const [draft, setDraft] = useState<VariantDraft>({
    inventoryState: "IN_WAREHOUSE",
    priceCents: 0,
    quantity: 0,
    sku: "",
    title: "",
  });
  const [price, setPrice] = useState("");

  function update<K extends keyof VariantDraft>(key: K, value: VariantDraft[K]) {
    setDraft((current) => ({ ...current, [key]: value }));
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!productId || !draft.title.trim() || !draft.sku.trim()) {
      return;
    }

    onCreateVariant(productId, {
      ...draft,
      barcode: draft.barcode?.trim() || undefined,
      brand: draft.brand?.trim() || undefined,
      priceCents: dollarsToCents(price),
      sku: draft.sku.trim(),
      title: draft.title.trim(),
      vehicleId: draft.inventoryState === "ON_VEHICLE" ? draft.vehicleId : undefined,
    });
    setDraft({
      inventoryState: "IN_WAREHOUSE",
      priceCents: 0,
      quantity: 0,
      sku: "",
      title: "",
    });
    setPrice("");
  }

  return (
    <Card>
      <SectionHeader title="Create variant" subtitle="Every sellable unit lives here." />
      <form className="mt-4 space-y-3" onSubmit={submit}>
        <Select label="Product" onChange={(event) => onProductChange(event.target.value)} value={productId}>
          {products.map((product) => (
            <option key={product.id} value={product.id}>
              {product.title}
            </option>
          ))}
        </Select>
        <Input label="Variant" onChange={(event) => update("title", event.target.value)} placeholder="Blue Razz Ice" value={draft.title} />
        <Input label="SKU" onChange={(event) => update("sku", event.target.value)} value={draft.sku} />
        <div className="grid gap-3 sm:grid-cols-2">
          <Input label="Brand" onChange={(event) => update("brand", event.target.value)} value={draft.brand ?? ""} />
          <Input label="Barcode" onChange={(event) => update("barcode", event.target.value)} value={draft.barcode ?? ""} />
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <Input
            label="Price"
            min={0}
            onChange={(event) => setPrice(event.target.value)}
            placeholder="24.99"
            step="0.01"
            type="number"
            value={price}
          />
          <Input
            label="Quantity"
            min={0}
            onChange={(event) => update("quantity", Number(event.target.value))}
            type="number"
            value={draft.quantity}
          />
        </div>
        <Select
          label="Inventory state"
          onChange={(event) => update("inventoryState", event.target.value as InventoryState)}
          value={draft.inventoryState}
        >
          <option value="IN_WAREHOUSE">In warehouse</option>
          <option value="ON_VEHICLE">On vehicle</option>
        </Select>
        {draft.inventoryState === "ON_VEHICLE" ? (
          <Select label="Vehicle" onChange={(event) => update("vehicleId", event.target.value)} value={draft.vehicleId ?? ""}>
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
        <Button fullWidth loading={busy} type="submit">
          <Plus size={18} aria-hidden="true" />
          Add variant
        </Button>
      </form>
    </Card>
  );
}

function VariantStockRow({
  busy,
  showStateControl = false,
  variant,
  vehicles,
  onAssignVehicle,
  onSetState,
  onUpdateQuantity,
}: {
  busy: boolean;
  showStateControl?: boolean;
  variant: InventoryVariant;
  vehicles: DeliveryVehicle[];
  onAssignVehicle: (variantId: string, vehicleId: string) => void;
  onSetState?: (variantId: string, state: InventoryState) => void;
  onUpdateQuantity: (variantId: string, quantity: number) => void;
}) {
  const [quantity, setQuantity] = useState(variant.metadata.availableQuantity);

  return (
    <Card as="article" className="p-4">
      <div className="grid gap-4">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <p className="truncate text-base font-black text-[var(--bb-charcoal)]">
              {variant.productTitle}
            </p>
            <StatusBadge
              status={variant.metadata.inventoryState === "ON_VEHICLE" ? "Vehicle" : "Warehouse"}
              tone={variant.metadata.inventoryState === "ON_VEHICLE" ? "brand" : "info"}
            />
          </div>
          <p className="mt-1 truncate text-sm font-bold text-[var(--bb-muted)]">
            {variant.title} - {variant.sku}
          </p>
          <div className="mt-3 grid gap-2 sm:grid-cols-3 xl:grid-cols-3">
            <MetricCard label="Barcode" value={variant.metadata.barcode ?? "Missing"} />
            <MetricCard label="Brand" value={variant.metadata.brand ?? "Missing"} />
            <MetricCard label="Price" value={formatMoney(variant.priceCents)} />
          </div>
        </div>
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Button
              aria-label={`Decrease ${variant.title} quantity`}
              disabled={busy || quantity <= 0}
              onClick={() => setQuantity((current) => Math.max(0, current - 1))}
              size="icon"
              title="Decrease quantity"
              variant="secondary"
            >
              -
            </Button>
            <Input
              aria-label={`${variant.title} quantity`}
              className="min-w-0 flex-1"
              min={0}
              onChange={(event) => setQuantity(Number(event.target.value))}
              type="number"
              value={quantity}
            />
            <Button
              aria-label={`Increase ${variant.title} quantity`}
              disabled={busy}
              onClick={() => setQuantity((current) => current + 1)}
              size="icon"
              title="Increase quantity"
              variant="secondary"
            >
              +
            </Button>
          </div>
          <ActionBar>
            <Button
              disabled={busy || quantity === variant.metadata.availableQuantity}
              fullWidth
              onClick={() => onUpdateQuantity(variant.id, quantity)}
              size="sm"
            >
              Save count
            </Button>
            <Select
              aria-label={`Assign ${variant.title}`}
              onChange={(event) => onAssignVehicle(variant.id, event.target.value)}
              value={variant.metadata.assignedVehicleId ?? "warehouse"}
            >
              <option value="warehouse">Warehouse</option>
              {vehicles
                .filter((vehicle) => vehicle.id !== "warehouse")
                .map((vehicle) => (
                  <option key={vehicle.id} value={vehicle.id}>
                    {vehicle.label}
                  </option>
                ))}
            </Select>
          </ActionBar>
          {showStateControl && onSetState ? (
            <div className="grid grid-cols-2 gap-2">
              <Button
                fullWidth
                onClick={() => onSetState(variant.id, "IN_WAREHOUSE")}
                size="sm"
                variant={variant.metadata.inventoryState === "IN_WAREHOUSE" ? "primary" : "secondary"}
              >
                Warehouse
              </Button>
              <Button
                fullWidth
                onClick={() => onSetState(variant.id, "ON_VEHICLE")}
                size="sm"
                variant={variant.metadata.inventoryState === "ON_VEHICLE" ? "primary" : "secondary"}
              >
                Vehicle
              </Button>
            </div>
          ) : null}
        </div>
      </div>
    </Card>
  );
}

function VariantContractCard({
  busy,
  variant,
  vehicles,
  onAssignVehicle,
  onSetState,
  onUpdateQuantity,
  onUpdateVariantDetails,
}: {
  busy: boolean;
  variant: InventoryVariant;
  vehicles: DeliveryVehicle[];
  onAssignVehicle: (variantId: string, vehicleId: string) => void;
  onSetState: (variantId: string, state: InventoryState) => void;
  onUpdateQuantity: (variantId: string, quantity: number) => void;
  onUpdateVariantDetails: (variantId: string, draft: VariantUpdateDraft) => void;
}) {
  const [title, setTitle] = useState(variant.title);
  const [sku, setSku] = useState(variant.sku);
  const [brand, setBrand] = useState(variant.metadata.brand ?? "");
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
      brand: brand.trim() || undefined,
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
          <Input label="Brand" onChange={(event) => setBrand(event.target.value)} value={brand} />
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

function AttentionItem({
  children,
  title,
  tone,
}: {
  children: ReactNode;
  title: string;
  tone: "danger" | "warning";
}) {
  return (
    <div className="rounded-2xl border border-[var(--bb-line)] bg-white p-3">
      <div className="flex items-center justify-between gap-2">
        <p className="truncate text-sm font-black text-[var(--bb-charcoal)]">{title}</p>
        <StatusBadge status={tone === "danger" ? "Fix" : "Check"} tone={tone} />
      </div>
      <p className="mt-1 text-sm font-semibold leading-6 text-[var(--bb-muted)]">{children}</p>
    </div>
  );
}

function MetadataRule({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-[var(--bb-surface-warm)] p-3">
      <p className="text-xs font-black uppercase text-[var(--bb-blaze)]">{label}</p>
      <p className="mt-1 text-sm font-black text-[var(--bb-charcoal)]">{value}</p>
    </div>
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

function flattenVariants(products: InventoryProduct[]) {
  return products.flatMap((product) => product.variants);
}

function matchesVariant(variant: InventoryVariant, query: string) {
  const normalizedQuery = query.trim().toLowerCase();
  if (!normalizedQuery) {
    return true;
  }

  return [
    variant.productTitle,
    variant.title,
    variant.sku,
    variant.metadata.barcode,
    variant.metadata.brand,
  ]
    .filter(Boolean)
    .some((value) => value!.toLowerCase().includes(normalizedQuery));
}

function getStats(variants: InventoryVariant[], issues: ContractIssue[]) {
  return {
    issueCount: issues.length,
    variantCount: variants.length,
    vehicleUnits: variants
      .filter((variant) => variant.metadata.inventoryState === "ON_VEHICLE")
      .reduce((sum, variant) => sum + variant.metadata.availableQuantity, 0),
    warehouseUnits: variants
      .filter((variant) => variant.metadata.inventoryState === "IN_WAREHOUSE")
      .reduce((sum, variant) => sum + variant.metadata.availableQuantity, 0),
  };
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
