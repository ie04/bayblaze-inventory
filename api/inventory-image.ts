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

  if (req.method !== "POST" && req.method !== "DELETE") {
    return res.status(405).json({ message: "Method not allowed." });
  }

  let medusaResponse: Response;

  try {
    medusaResponse = await fetch(`${backendUrl}/admin/bayblaze/inventory-images`, {
      body: JSON.stringify(req.body ?? {}),
      headers: {
        Authorization: `Bearer ${serviceToken}`,
        "Content-Type": "application/json",
        "x-bayblaze-service-token": serviceToken,
      },
      method: req.method,
    });
  } catch (caught) {
    console.error("Medusa inventory image request failed.", caught);

    return res.status(502).json({
      message: "Medusa inventory image API could not be reached.",
    });
  }

  const responseText = await medusaResponse.text();
  let responseBody: unknown;

  try {
    responseBody = responseText ? JSON.parse(responseText) : {};
  } catch {
    responseBody = {
      message: responseText || "Medusa inventory image API returned a non-JSON response.",
    };
  }

  return res.status(medusaResponse.status).json(responseBody);
}
