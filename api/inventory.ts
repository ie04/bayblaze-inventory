type VercelRequest = {
  body?: unknown;
  method?: string;
};

type VercelResponse = {
  status: (code: number) => VercelResponse;
  json: (body: unknown) => void;
  setHeader: (name: string, value: string) => void;
};

const backendUrl = process.env.MEDUSA_BACKEND_URL?.replace(/\/$/, "");
const serviceToken =
  process.env.BAYBLAZE_INVENTORY_SERVICE_TOKEN ||
  process.env.BAYBLAZE_DRIVER_SERVICE_TOKEN;

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader("Cache-Control", "no-store");

  if (!backendUrl || !serviceToken) {
    return res.status(503).json({
      message: "Inventory API is not configured.",
    });
  }

  if (req.method !== "GET" && req.method !== "POST") {
    return res.status(405).json({ message: "Method not allowed." });
  }

  const medusaResponse = await fetch(`${backendUrl}/admin/bayblaze/inventory`, {
    body: req.method === "POST" ? JSON.stringify(req.body ?? {}) : undefined,
    headers: {
      Authorization: `Bearer ${serviceToken}`,
      "Content-Type": "application/json",
      "x-bayblaze-service-token": serviceToken,
    },
    method: req.method,
  });

  const responseText = await medusaResponse.text();
  let responseBody: unknown;

  try {
    responseBody = responseText ? JSON.parse(responseText) : {};
  } catch {
    responseBody = {
      message: responseText || "Medusa inventory API returned a non-JSON response.",
    };
  }

  return res.status(medusaResponse.status).json(responseBody);
}
