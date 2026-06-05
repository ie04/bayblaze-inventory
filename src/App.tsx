import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from "react";
import {
  AlertTriangle,
  Barcode,
  Boxes,
  CheckCircle2,
  ClipboardCheck,
  Image,
  LayoutDashboard,
  PackagePlus,
  Plus,
  RefreshCw,
  Search,
  ShieldCheck,
  Truck,
  Warehouse,
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
  ProductDraft,
  VariantDraft,
} from "./lib/types";

type View = "overview" | "products" | "stock" | "vehicles" | "contract";

const views: Array<{ id: View; icon: ReactNode; label: string }> = [
  { id: "overview", icon: <LayoutDashboard size={18} aria-hidden="true" />, label: "Overview" },
  { id: "products", icon: <PackagePlus size={18} aria-hidden="true" />, label: "Products" },
  { id: "stock", icon: <Barcode size={18} aria-hidden="true" />, label: "Stock" },
  { id: "vehicles", icon: <Truck size={18} aria-hidden="true" />, label: "Vehicles" },
  { id: "contract", icon: <ClipboardCheck size={18} aria-hidden="true" />, label: "Contract" },
];

function App() {
  const [snapshot, setSnapshot] = useState<InventorySnapshot | null>(null);
  const [activeView, setActiveView] = useState<View>("overview");
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
      onCreateProduct={(draft) => void applyMutation({ type: "create-product", draft })}
      onCreateVariant={(productId, draft) =>
        void applyMutation({ type: "create-variant", productId, draft })
      }
      onUpdateProductImage={(productId, imageUrl) =>
        void applyMutation({ type: "update-product-image", productId, imageUrl })
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
        <header className="border-b border-[var(--bb-line)] bg-white/95 px-5 py-4 backdrop-blur md:px-7">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-xs font-black uppercase text-[var(--bb-blaze)]">BayBlaze</p>
              <h1 className="text-2xl font-black uppercase leading-tight text-[var(--bb-charcoal)]">
                Inventory
              </h1>
            </div>
            <div className="flex items-center gap-2">
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
        <footer className="border-t border-[var(--bb-line)] bg-white/95 px-3 py-3 backdrop-blur md:hidden">
          <nav className="grid grid-cols-5 gap-1" aria-label="Inventory navigation">
            {views.map((item) => (
              <button
                key={item.id}
                aria-label={item.label}
                className={`grid min-h-14 place-items-center rounded-2xl text-[11px] font-black transition ${
                  activeView === item.id
                    ? "bg-[var(--bb-blaze-soft)] text-[var(--bb-charcoal)]"
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
      <div className="flex min-h-0 flex-1 flex-col md:grid md:grid-cols-[220px_minmax(0,1fr)]">
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
        <section className="min-h-0 flex-1 overflow-y-auto px-5 py-5 md:px-7">
          <div className="page-transition mx-auto flex min-h-0 w-full max-w-5xl flex-col gap-5">
            {error ? <ErrorState>{error}</ErrorState> : null}
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
  onCreateProduct,
  onCreateVariant,
  onUpdateProductImage,
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
  onCreateProduct: (draft: ProductDraft) => void;
  onCreateVariant: (productId: string, draft: VariantDraft) => void;
  onUpdateProductImage: (productId: string, imageUrl: string) => void;
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
        onCreateProduct={onCreateProduct}
        onCreateVariant={onCreateVariant}
        onUpdateProductImage={onUpdateProductImage}
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
        subtitle="Add products, keep variant metadata complete, and move inventory between the warehouse and delivery vehicles."
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
        <Card>
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
  onCreateProduct,
  onCreateVariant,
  onUpdateProductImage,
}: {
  busy: boolean;
  products: InventoryProduct[];
  vehicles: DeliveryVehicle[];
  onCreateProduct: (draft: ProductDraft) => void;
  onCreateVariant: (productId: string, draft: VariantDraft) => void;
  onUpdateProductImage: (productId: string, imageUrl: string) => void;
}) {
  const [selectedProductId, setSelectedProductId] = useState(products[0]?.id ?? "");
  const effectiveSelectedProductId = selectedProductId || products[0]?.id || "";
  const selectedProduct = products.find((product) => product.id === effectiveSelectedProductId);

  return (
    <>
      <PageHeader
        eyebrow="Catalog"
        icon={<PackagePlus size={24} aria-hidden="true" />}
        title="Products and variants"
        subtitle="Create product shells, then define every sellable unit at the variant level."
      />
      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_360px]">
        <div className="space-y-3">
          {products.map((product) => (
            <ProductCard
              key={product.id}
              product={product}
              selected={effectiveSelectedProductId === product.id}
              onSelect={() => setSelectedProductId(product.id)}
            />
          ))}
        </div>
        <div className="space-y-5">
          <CreateProductCard busy={busy} onCreateProduct={onCreateProduct} />
          {selectedProduct ? (
            <ProductImageCard
              busy={busy}
              key={selectedProduct.id}
              product={selectedProduct}
              onUpdateProductImage={onUpdateProductImage}
            />
          ) : null}
          <CreateVariantCard
            busy={busy}
            productId={effectiveSelectedProductId}
            products={products}
            vehicles={vehicles}
            onCreateVariant={onCreateVariant}
            onProductChange={setSelectedProductId}
          />
        </div>
      </div>
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
  onUpdateQuantity,
}: {
  busy: boolean;
  query: string;
  variants: InventoryVariant[];
  vehicles: DeliveryVehicle[];
  onAssignVehicle: (variantId: string, vehicleId: string) => void;
  onQueryChange: (query: string) => void;
  onSetState: (variantId: string, state: InventoryState) => void;
  onUpdateQuantity: (variantId: string, quantity: number) => void;
}) {
  return (
    <>
      <PageHeader
        eyebrow="Scanner"
        icon={<Barcode size={24} aria-hidden="true" />}
        title="Stock updates"
        subtitle="Search by product, SKU, barcode, brand, or flavor before changing quantity or location."
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
            <VariantStockRow
              busy={busy}
              key={`${variant.id}-${variant.updatedAt}-${variant.metadata.availableQuantity}`}
              showStateControl
              variant={variant}
              vehicles={vehicles}
              onAssignVehicle={onAssignVehicle}
              onSetState={onSetState}
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
  return (
    <>
      <PageHeader
        eyebrow="Dispatch inventory"
        icon={<Truck size={24} aria-hidden="true" />}
        title="Vehicle assignments"
        subtitle="Move sellable variants onto vehicles without changing Medusa into a separate dispatch database."
      />
      <div className="grid gap-5 lg:grid-cols-2">
        {vehicles
          .filter((vehicle) => vehicle.id !== "warehouse")
          .map((vehicle) => {
            const assigned = variants.filter(
              (variant) => variant.metadata.assignedVehicleId === vehicle.id,
            );

            return (
              <Card key={vehicle.id} elevated>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-xs font-black uppercase text-[var(--bb-blaze)]">
                      {vehicle.plate ?? "No plate"}
                    </p>
                    <h2 className="mt-1 text-2xl font-black text-[var(--bb-charcoal)]">
                      {vehicle.label}
                    </h2>
                  </div>
                  <StatusBadge status={vehicle.active ? "Active" : "Inactive"} tone={vehicle.active ? "success" : "neutral"} />
                </div>
                <div className="mt-4 space-y-3">
                  {assigned.length === 0 ? (
                    <InlineNotice tone="warning">No variants are assigned to this vehicle.</InlineNotice>
                  ) : (
                    assigned.map((variant) => (
                      <div
                        key={variant.id}
                        className="flex items-center justify-between gap-3 rounded-2xl bg-[var(--bb-surface-warm)] p-3"
                      >
                        <div className="min-w-0">
                          <p className="truncate text-sm font-black text-[var(--bb-charcoal)]">
                            {variant.productTitle}
                          </p>
                          <p className="truncate text-xs font-bold text-[var(--bb-muted)]">
                            {variant.title} - {variant.sku}
                          </p>
                        </div>
                        <div className="flex shrink-0 items-center gap-2">
                          <Badge tone="brand">{variant.metadata.availableQuantity}</Badge>
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
              </Card>
            );
          })}
      </div>
    </>
  );
}

function ContractView({ issues, products }: { issues: ContractIssue[]; products: InventoryProduct[] }) {
  const variants = flattenVariants(products);

  return (
    <>
      <PageHeader
        eyebrow="Metadata"
        icon={<ClipboardCheck size={24} aria-hidden="true" />}
        title="Contract audit"
        subtitle="Every sellable unit must have variant-level metadata that storefront, driver, and IsoChronos can trust."
      />
      <Card tone={issues.length ? "warm" : "default"} elevated>
        <div className="flex items-start gap-3">
          <span className="grid size-12 shrink-0 place-items-center rounded-2xl bg-white text-[var(--bb-charcoal)]">
            {issues.length ? <AlertTriangle size={23} aria-hidden="true" /> : <CheckCircle2 size={23} aria-hidden="true" />}
          </span>
          <div>
            <h2 className="text-2xl font-black text-[var(--bb-charcoal)]">
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
  selected,
  onSelect,
}: {
  product: InventoryProduct;
  selected: boolean;
  onSelect: () => void;
}) {
  const units = product.variants.reduce((sum, variant) => sum + variant.metadata.availableQuantity, 0);

  return (
    <button className="w-full text-left" onClick={onSelect} type="button">
      <Card className={selected ? "border-[var(--bb-blaze)]" : ""} interactive>
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 items-start gap-3">
            <ProductThumbnail product={product} />
            <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="truncate text-xl font-black text-[var(--bb-charcoal)]">{product.title}</h2>
              <StatusBadge status={product.status} tone={product.status === "published" ? "success" : "warning"} />
            </div>
            <p className="mt-1 text-sm font-bold text-[var(--bb-muted)]">
              {product.category} - /{product.handle}
            </p>
            </div>
          </div>
          <Badge tone="brand">{units} units</Badge>
        </div>
        <div className="mt-4 grid gap-2 sm:grid-cols-2">
          {product.variants.map((variant) => (
            <MetricCard
              key={variant.id}
              label={variant.sku}
              value={`${variant.title} - ${variant.metadata.availableQuantity}`}
            />
          ))}
          {product.variants.length === 0 ? <MetricCard label="Variants" value="None yet" /> : null}
        </div>
      </Card>
    </button>
  );
}

function CreateProductCard({
  busy,
  onCreateProduct,
}: {
  busy: boolean;
  onCreateProduct: (draft: ProductDraft) => void;
}) {
  const [title, setTitle] = useState("");
  const [handle, setHandle] = useState("");
  const [category, setCategory] = useState("");
  const [imageUrl, setImageUrl] = useState("");

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!title.trim() || !handle.trim() || !category.trim()) {
      return;
    }

    onCreateProduct({
      title: title.trim(),
      handle: handle.trim(),
      category: category.trim(),
      imageUrl: imageUrl.trim() || undefined,
    });
    setTitle("");
    setHandle("");
    setCategory("");
    setImageUrl("");
  }

  return (
    <Card>
      <SectionHeader title="Add product" subtitle="Create the Medusa product shell first." />
      <form className="mt-4 space-y-3" onSubmit={submit}>
        <Input label="Product name" onChange={(event) => setTitle(event.target.value)} value={title} />
        <Input label="Handle" onChange={(event) => setHandle(event.target.value)} placeholder="raz-tn9000" value={handle} />
        <Input label="Category" onChange={(event) => setCategory(event.target.value)} placeholder="Vapes" value={category} />
        <Input
          icon={<Image size={18} aria-hidden="true" />}
          label="Product image URL"
          onChange={(event) => setImageUrl(event.target.value)}
          placeholder="https://..."
          type="url"
          value={imageUrl}
        />
        <Button fullWidth loading={busy} type="submit">
          <Plus size={18} aria-hidden="true" />
          Add product
        </Button>
      </form>
    </Card>
  );
}

function ProductImageCard({
  busy,
  product,
  onUpdateProductImage,
}: {
  busy: boolean;
  product: InventoryProduct;
  onUpdateProductImage: (productId: string, imageUrl: string) => void;
}) {
  const [imageUrl, setImageUrl] = useState(product.thumbnail ?? "");

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const nextImageUrl = imageUrl.trim();

    if (!nextImageUrl) {
      return;
    }

    onUpdateProductImage(product.id, nextImageUrl);
  }

  return (
    <Card>
      <SectionHeader title="Product photo" subtitle={product.title} />
      <div className="mt-4 overflow-hidden rounded-2xl border border-[var(--bb-line)] bg-[var(--bb-surface-warm)]">
        {imageUrl.trim() ? (
          <img
            alt=""
            className="aspect-[4/3] w-full object-cover"
            src={imageUrl.trim()}
          />
        ) : (
          <div className="grid aspect-[4/3] place-items-center text-[var(--bb-muted)]">
            <Image size={32} aria-hidden="true" />
          </div>
        )}
      </div>
      <form className="mt-4 space-y-3" onSubmit={submit}>
        <Input
          icon={<Image size={18} aria-hidden="true" />}
          label="Image URL"
          onChange={(event) => setImageUrl(event.target.value)}
          placeholder="https://..."
          type="url"
          value={imageUrl}
        />
        <Button fullWidth loading={busy} type="submit">
          Save photo
        </Button>
      </form>
    </Card>
  );
}

function ProductThumbnail({ product }: { product: InventoryProduct }) {
  return (
    <span className="grid size-16 shrink-0 overflow-hidden rounded-2xl bg-[var(--bb-surface-warm)] text-[var(--bb-muted)]">
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
            label="Price cents"
            min={0}
            onChange={(event) => update("priceCents", Number(event.target.value))}
            type="number"
            value={draft.priceCents}
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

export default App;
