type VercelRequest = {
  body?: unknown;
  headers?: Record<string, string | string[] | undefined>;
  method?: string;
};

type VercelResponse = {
  status: (code: number) => VercelResponse;
  json: (body: unknown) => void;
  setHeader: (name: string, value: string) => void;
};

const bayblazeApiUrl = (process.env.BAYBLAZE_API_URL || "https://api.bayblaze.net").replace(/\/$/, "");
const bayblazeApiToken = process.env.BAYBLAZE_API_SERVICE_TOKEN;

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

  const authResult = await verifyInventoryAccount(req);

  if (!authResult.ok) {
    return res.status(authResult.status).json({
      message: authResult.message,
      ...(authResult.status === 401 ? { code: "INVENTORY_SESSION_INVALID" } : {}),
    });
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

  return res.status(upstreamResponse.status).json(responseBody);
}

async function verifyInventoryAccount(req: VercelRequest) {
  const token = readBearerToken(req.headers?.authorization);

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
