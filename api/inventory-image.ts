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

const bayblazeApiUrl = process.env.BAYBLAZE_API_URL?.replace(/\/$/, "");
const bayblazeApiToken =
  process.env.BAYBLAZE_API_SERVICE_TOKEN ||
  process.env.BAYBLAZE_INVENTORY_APP_TO_API_TOKEN;

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader("Cache-Control", "no-store");

  if (!bayblazeApiUrl || !bayblazeApiToken) {
    return res.status(503).json({
      message: "BayBlaze API inventory image bridge is not configured.",
    });
  }

  if (req.method !== "POST" && req.method !== "DELETE") {
    return res.status(405).json({ message: "Method not allowed." });
  }

  let upstreamResponse: Response;

  try {
    if (req.method === "POST") {
      upstreamResponse = await forwardImageUpload(req);
    } else {
      upstreamResponse = await forwardImageCleanup(req);
    }
  } catch (caught) {
    console.error("BayBlaze inventory image request failed.", caught);

    return res.status(502).json({
      message: caught instanceof Error ? caught.message : "BayBlaze inventory image API could not be reached.",
    });
  }

  const responseText = await upstreamResponse.text();
  let responseBody: { message?: unknown } | Record<string, unknown>;

  try {
    responseBody = responseText ? JSON.parse(responseText) : {};
  } catch {
    responseBody = {
      message: responseText || "BayBlaze inventory image API returned a non-JSON response.",
    };
  }

  if (!upstreamResponse.ok && typeof responseBody.message !== "string") {
    responseBody = {
      ...responseBody,
      message: `BayBlaze inventory image API failed with HTTP ${upstreamResponse.status}.`,
    };
  }

  return res.status(upstreamResponse.status).json(responseBody);
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

    return fetch(`${getInventoryImageUpstreamUrl()}`, {
      body: formData,
      headers: getInventoryImageUpstreamHeaders(false),
      method: "POST",
    });
  }

  const rawBody = await readRawBody(req);

  return fetch(`${getInventoryImageUpstreamUrl()}`, {
    body: rawBody,
    headers: getInventoryImageUpstreamHeaders(true, contentType || "application/json"),
    method: "POST",
  });
}

async function forwardImageCleanup(req: VercelRequest) {
  const rawBody = await readRawBody(req);

  return fetch(`${getInventoryImageUpstreamUrl()}`, {
    body: rawBody || "{}",
    headers: getInventoryImageUpstreamHeaders(true, "application/json"),
    method: "DELETE",
  });
}

function getInventoryImageUpstreamUrl() {
  return `${bayblazeApiUrl}/v1/inventory/images`;
}

function getInventoryImageUpstreamHeaders(hasContentType: boolean, contentType = "application/json") {
  return removeUndefinedHeaders({
    Authorization: `Bearer ${bayblazeApiToken}`,
    "Content-Type": hasContentType ? contentType : undefined,
  });
}

function removeUndefinedHeaders(headers: Record<string, string | undefined>) {
  return Object.fromEntries(
    Object.entries(headers).filter(([, value]) => value !== undefined),
  ) as Record<string, string>;
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
