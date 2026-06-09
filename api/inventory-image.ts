import type { IncomingMessage } from "node:http";

import Busboy from "busboy";

type VercelRequest = IncomingMessage & {
  body?: unknown;
  method?: string;
};

type VercelResponse = {
  status: (code: number) => VercelResponse;
  json: (body: unknown) => void;
  setHeader: (name: string, value: string) => void;
};

type ParsedUpload = {
  buffer: Buffer;
  fileName: string;
  mimeType: string;
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

  let medusaResponse: Response;

  try {
    if (req.method === "POST") {
      medusaResponse = await forwardImageUpload(req);
    } else {
      medusaResponse = await forwardImageCleanup(req);
    }
  } catch (caught) {
    console.error("Medusa inventory image request failed.", caught);

    return res.status(502).json({
      message: caught instanceof Error ? caught.message : "Medusa inventory image API could not be reached.",
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

async function forwardImageUpload(req: VercelRequest) {
  const contentType = readHeader(req.headers["content-type"]);

  if (contentType.includes("multipart/form-data")) {
    const upload = await readMultipartImageUpload(req);
    const formData = new FormData();
    const bytes = new Uint8Array(upload.buffer);

    formData.append(
      "image",
      new Blob([bytes], { type: upload.mimeType }),
      upload.fileName,
    );

    return fetch(`${backendUrl}/admin/bayblaze/inventory-images`, {
      body: formData,
      headers: {
        Authorization: `Bearer ${serviceToken}`,
        "x-bayblaze-service-token": serviceToken,
      },
      method: "POST",
    });
  }

  const rawBody = await readRawBody(req);

  return fetch(`${backendUrl}/admin/bayblaze/inventory-images`, {
    body: rawBody,
    headers: {
      Authorization: `Bearer ${serviceToken}`,
      "Content-Type": contentType || "application/json",
      "x-bayblaze-service-token": serviceToken,
    },
    method: "POST",
  });
}

async function forwardImageCleanup(req: VercelRequest) {
  const rawBody = await readRawBody(req);

  return fetch(`${backendUrl}/admin/bayblaze/inventory-images`, {
    body: rawBody || "{}",
    headers: {
      Authorization: `Bearer ${serviceToken}`,
      "Content-Type": "application/json",
      "x-bayblaze-service-token": serviceToken,
    },
    method: "DELETE",
  });
}

function readMultipartImageUpload(req: VercelRequest) {
  return new Promise<ParsedUpload>((resolve, reject) => {
    const contentType = readHeader(req.headers["content-type"]);

    if (!contentType.includes("multipart/form-data")) {
      reject(new Error("Inventory image upload must be multipart/form-data."));
      return;
    }

    const parser = Busboy({
      headers: {
        "content-type": contentType,
      },
      limits: {
        files: 1,
        fileSize: 2 * 1024 * 1024,
      },
    });

    const chunks: Buffer[] = [];
    let fileName = "product-photo.jpg";
    let mimeType = "image/jpeg";
    let sawImage = false;
    let settled = false;

    function fail(error: Error) {
      if (settled) {
        return;
      }

      settled = true;
      reject(error);
    }

    parser.on("file", (fieldName, file, info) => {
      if (fieldName !== "image") {
        file.resume();
        return;
      }

      sawImage = true;
      fileName = info.filename || fileName;
      mimeType = info.mimeType || mimeType;

      file.on("data", (chunk: Buffer) => {
        chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
      });

      file.on("limit", () => {
        fail(new Error("Product image is too large."));
      });

      file.on("error", (error) => {
        fail(error instanceof Error ? error : new Error("Product image stream failed."));
      });
    });

    parser.on("error", (error) => {
      fail(error instanceof Error ? error : new Error("Product image upload parsing failed."));
    });

    parser.on("finish", () => {
      if (settled) {
        return;
      }

      if (!sawImage || chunks.length === 0) {
        fail(new Error("Product image upload is required."));
        return;
      }

      settled = true;
      resolve({
        buffer: Buffer.concat(chunks),
        fileName,
        mimeType,
      });
    });

    req.pipe(parser);
  });
}

function readRawBody(req: IncomingMessage) {
  return new Promise<string>((resolve, reject) => {
    const chunks: Buffer[] = [];

    req.on("data", (chunk: Buffer) => {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    });

    req.on("error", (error) => {
      reject(error instanceof Error ? error : new Error("Unable to read request body."));
    });

    req.on("end", () => {
      resolve(Buffer.concat(chunks).toString("utf8"));
    });
  });
}

function readHeader(value: unknown) {
  if (Array.isArray(value)) {
    return value[0] ?? "";
  }

  return typeof value === "string" ? value : "";
}
