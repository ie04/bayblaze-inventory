import type { IncomingMessage } from "node:http";

import Busboy from "busboy";

type VercelRequest = IncomingMessage & {
  body?: unknown;
  method?: string;
};

type VercelResponse = {
  end: (body?: unknown) => void;
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

const bayblazeApiUrl = (process.env.BAYBLAZE_API_URL || "https://api.bayblaze.net").replace(/\/$/, "");
const bayblazeApiToken = process.env.BAYBLAZE_API_SERVICE_TOKEN;

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader("Cache-Control", "no-store");

  if (!bayblazeApiUrl || !bayblazeApiToken) {
    return res.status(503).json({
      message: "BayBlaze API inventory image bridge is not configured.",
    });
  }

  if (req.method !== "GET" && req.method !== "POST" && req.method !== "DELETE") {
    return res.status(405).json({ message: "Method not allowed." });
  }

  const authResult = await verifyInventoryAccount(req);

  if (!authResult.ok) {
    return res.status(authResult.status).json({
      message: authResult.message,
      ...(authResult.status === 401 ? { code: "INVENTORY_SESSION_INVALID" } : {}),
    });
  }

  let upstreamResponse: Response;

  try {
    if (req.method === "GET") {
      upstreamResponse = await forwardImageRead(req);
    } else if (req.method === "POST") {
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

  if (req.method === "GET") {
    return sendImageResponse(res, upstreamResponse);
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

async function verifyInventoryAccount(req: VercelRequest) {
  const token = readBearerToken(req.headers.authorization);

  if (!token) {
    return {
      ok: false as const,
      message: "BayBlaze inventory sign-in is required.",
      status: 401,
    };
  }

  const response = await fetch(`${bayblazeApiUrl}/v1/auth/me`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  }).catch(() => null);

  if (!response) {
    return {
      ok: false as const,
      message: "BayBlaze account could not be verified.",
      status: 502,
    };
  }

  const payload = (await response.json().catch(() => ({}))) as {
    account?: {
      disabled?: boolean;
      roles?: string[];
    };
    message?: string;
  };

  if (!response.ok) {
    return {
      ok: false as const,
      message: payload.message || "BayBlaze account session is not valid.",
      status: response.status,
    };
  }

  if (!payload.account || payload.account.disabled || !payload.account.roles?.includes("inventory")) {
    return {
      ok: false as const,
      message: "Inventory access is required.",
      status: 403,
    };
  }

  return { ok: true as const };
}

function readBearerToken(value: string | string[] | undefined) {
  const header = Array.isArray(value) ? value[0] : value;

  if (!header?.toLowerCase().startsWith("bearer ")) {
    return "";
  }

  return header.slice("bearer ".length).trim();
}

async function forwardImageRead(req: VercelRequest) {
  const filename = readInventoryImageFilename(req);

  return fetch(`${getInventoryImageUpstreamUrl()}/${encodeURIComponent(filename)}`, {
    headers: getInventoryImageUpstreamHeaders(false),
    method: "GET",
  });
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

async function sendImageResponse(res: VercelResponse, upstreamResponse: Response) {
  const contentType = upstreamResponse.headers.get("content-type");
  const cacheControl = upstreamResponse.headers.get("cache-control");

  if (contentType) {
    res.setHeader("Content-Type", contentType);
  }

  res.setHeader("Cache-Control", cacheControl || "public, max-age=300");

  const bytes = Buffer.from(await upstreamResponse.arrayBuffer());
  return res.status(upstreamResponse.status).end(bytes);
}

function readInventoryImageFilename(req: VercelRequest) {
  const url = new URL(req.url || "", "http://inventory.local");
  const filename = url.searchParams.get("filename") || "";

  if (!/^[a-zA-Z0-9._-]+\.(jpg|jpeg|png|webp|gif)$/i.test(filename)) {
    throw new Error("Inventory image filename is invalid.");
  }

  return filename;
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
