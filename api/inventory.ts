import { cert, getApps, initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

type VercelRequest = {
  body?: unknown;
  method?: string;
};

type VercelResponse = {
  status: (code: number) => VercelResponse;
  json: (body: unknown) => void;
  setHeader: (name: string, value: string) => void;
};

const bayblazeApiUrl = (process.env.BAYBLAZE_API_URL || "https://api.bayblaze.net").replace(/\/$/, "");
const bayblazeApiToken =
  process.env.BAYBLAZE_API_SERVICE_TOKEN ||
  process.env.BAYBLAZE_INVENTORY_APP_TO_API_TOKEN;

type DeliveryVehicle = {
  id: string;
  label: string;
  plate?: string;
  active: boolean;
};

type InventorySnapshot = {
  products?: unknown[];
  vehicles?: DeliveryVehicle[];
  lastSyncedAt?: string;
  source?: string;
  warnings?: string[];
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader("Cache-Control", "no-store");

  if (!bayblazeApiUrl || !bayblazeApiToken) {
    return res.status(503).json({
      message: "BayBlaze API inventory bridge is not configured.",
    });
  }

  if (req.method !== "GET" && req.method !== "POST") {
    return res.status(405).json({ message: "Method not allowed." });
  }

  let upstreamResponse: Response;

  try {
    upstreamResponse = await fetchInventoryUpstream(req);
  } catch (caught) {
    console.error("BayBlaze inventory API request failed.", caught);

    return res.status(502).json({
      message: "BayBlaze inventory API could not be reached.",
    });
  }

  const responseText = await upstreamResponse.text();
  let responseBody: unknown;

  try {
    responseBody = responseText ? JSON.parse(responseText) : {};
  } catch {
    responseBody = {
      message: responseText || "BayBlaze inventory API returned a non-JSON response.",
    };
  }

  if (upstreamResponse.ok && isInventorySnapshot(responseBody)) {
    responseBody = await mergeFirestoreVehicles(responseBody);
  }

  return res.status(upstreamResponse.status).json(responseBody);
}

function fetchInventoryUpstream(req: VercelRequest) {
  return fetch(`${bayblazeApiUrl}/v1/inventory`, {
    body: req.method === "POST" ? JSON.stringify(req.body ?? {}) : undefined,
    headers: {
      Authorization: `Bearer ${bayblazeApiToken}`,
      "Content-Type": "application/json",
    },
    method: req.method,
  });
}

async function mergeFirestoreVehicles(snapshot: InventorySnapshot) {
  let firestoreVehicles: DeliveryVehicle[];

  try {
    firestoreVehicles = await listFirestoreVehicles();
  } catch (caught) {
    console.warn("Firestore vehicle sync failed.", caught);

    return {
      ...snapshot,
      warnings: [
        ...(snapshot.warnings ?? []),
        "Driver vehicles could not be synced from Firestore. Medusa inventory is still loaded.",
      ],
    };
  }

  if (firestoreVehicles.length === 0) {
    return snapshot;
  }

  const vehiclesById = new Map<string, DeliveryVehicle>();

  for (const vehicle of snapshot.vehicles ?? []) {
    vehiclesById.set(vehicle.id, vehicle);
  }

  for (const vehicle of firestoreVehicles) {
    vehiclesById.set(vehicle.id, {
      ...vehiclesById.get(vehicle.id),
      ...vehicle,
    });
  }

  return {
    ...snapshot,
    vehicles: [
      vehiclesById.get("warehouse") ?? {
        id: "warehouse",
        label: "Warehouse",
        active: true,
      },
      ...Array.from(vehiclesById.values())
        .filter((vehicle) => vehicle.id !== "warehouse")
        .sort((first, second) => first.label.localeCompare(second.label)),
    ],
  };
}

async function listFirestoreVehicles(): Promise<DeliveryVehicle[]> {
  const app = getFirebaseAdminApp();

  if (!app) {
    return [];
  }

  const snapshot = await getFirestore(app)
    .collection("vehicles")
    .where("active", "==", true)
    .get();

  return snapshot.docs.flatMap((vehicleDoc) => {
    const data = vehicleDoc.data();
    const id = readString(data.vehicleId, vehicleDoc.id);

    if (!id) {
      return [];
    }

    return [
      {
        id,
        label: readString(data.label, id),
        plate: readString(data.plateNumber, data.plate) || undefined,
        active: data.active !== false,
      },
    ];
  });
}

function getFirebaseAdminApp() {
  const existingApp = getApps()[0];

  if (existingApp) {
    return existingApp;
  }

  const serviceAccountJson = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;

  if (serviceAccountJson) {
    try {
      return initializeApp({
        credential: cert(JSON.parse(serviceAccountJson)),
      });
    } catch {
      return undefined;
    }
  }

  const projectId = process.env.FIREBASE_PROJECT_ID || process.env.GOOGLE_CLOUD_PROJECT;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n");

  if (!projectId || !clientEmail || !privateKey) {
    return undefined;
  }

  try {
    return initializeApp({
      credential: cert({
        clientEmail,
        privateKey,
        projectId,
      }),
    });
  } catch {
    return undefined;
  }
}

function isInventorySnapshot(value: unknown): value is InventorySnapshot {
  return Boolean(value && typeof value === "object" && "products" in value);
}

function readString(...values: unknown[]) {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }
  }

  return "";
}
