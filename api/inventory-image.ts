import type { IncomingMessage } from "node:http";

type VercelRequest = IncomingMessage & {
  body?: unknown;
  method?: string;
};

type VercelResponse = {
  status: (code: number) => VercelResponse;
  json: (body: unknown) => void;
  setHeader: (name: string, value: string) => void;
};

export const config = {
  api: {
    bodyParser: false,
  },
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

  const contentType = readHeader(req.headers["content-type"]);

  let medusaResponse: Response;

  try {
    const fetchOptions: RequestInit & { duplex?: "half" } = {
      body: req as unknown as BodyInit,
      duplex: "half",
      headers: {
        Authorization: `Bearer ${serviceToken}`,
        ...(contentType ? { "Content-Type": contentType } : {}),
        "x-bayblaze-service-token": serviceToken,
      },
      method: req.method,
    };

    medusaResponse = await fetch(
      `${backendUrl}/admin/bayblaze/inventory-images`,
      fetchOptions,
    );
  } catch (caught) {
    console.error("Medusa inventory image request failed.", caught);

    return res.status(502).json({
      message: "Medusa inventory image API could not be reached.",
    });
  }

  const responseText = await medusaResponse.text();
  let responseBody: { message?: unknown } | Record<string, unknown>;

  try {
    responseBody = responseText ? JSON.parse(responseText) : {};
  } catch {
    responseBody = {
      message: responseText || "Medusa inventory image API returned a non-JSON response.",
    };
  }

  if (!medusaResponse.ok && typeof responseBody.message !== "string") {
    responseBody = {
      ...responseBody,
      message: `Medusa inventory image API failed with HTTP ${medusaResponse.status}.`,
    };
  }

  return res.status(medusaResponse.status).json(responseBody);
}

function readHeader(value: unknown) {
  if (Array.isArray(value)) {
    return value[0] ?? "";
  }

  return typeof value === "string" ? value : "";
}
