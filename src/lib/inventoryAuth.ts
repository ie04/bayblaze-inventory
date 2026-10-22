export type InventorySession = {
  email: string;
  token: string;
  uid: string;
};

type AccountRole = "admin" | "driver" | "inventory";

type AccountAuthResponse = {
  account: {
    disabled: boolean;
    roles: AccountRole[];
  };
  session: InventorySession;
};

type GoogleOAuthStartResponse = {
  authorizationUrl: string;
};

const apiBaseUrl = (import.meta.env.VITE_BAYBLAZE_API_URL || "https://api.bayblaze.net").replace(/\/$/, "");
const sessionStorageKey = "bayblaze-inventory-session";

let currentSession = readStoredSession();

export function getInventorySession() {
  return currentSession;
}

export function getInventorySessionToken() {
  return currentSession?.token ?? "";
}

export function setInventorySession(session: InventorySession) {
  currentSession = session;
  window.localStorage.setItem(sessionStorageKey, JSON.stringify(session));
}

export function clearInventorySession() {
  currentSession = null;
  window.localStorage.removeItem(sessionStorageKey);
}

export async function loginInventory(email: string, password: string) {
  const result = await publicApiPost<AccountAuthResponse>("/v1/auth/login", {
    email: email.trim().toLowerCase(),
    password,
  });
  assertInventoryAccount(result.account);
  setInventorySession(result.session);
  return result.session;
}

export async function startInventoryGoogleLogin() {
  const result = await publicApiPost<GoogleOAuthStartResponse>("/v1/auth/google/start", {
    callbackUrl: getGoogleCallbackUrl(),
    redirectTo: "/",
  });

  window.location.assign(result.authorizationUrl);
}

export async function completeInventoryGoogleLogin(searchParams: URLSearchParams) {
  const code = searchParams.get("code");
  const state = searchParams.get("state");

  if (!code || !state) {
    throw new Error("Google did not return a complete sign-in response.");
  }

  const result = await publicApiPost<AccountAuthResponse>("/v1/auth/google/callback", {
    callbackUrl: getGoogleCallbackUrl(),
    code,
    state,
  });
  assertInventoryAccount(result.account);
  setInventorySession(result.session);
  return result.session;
}

async function publicApiPost<T>(path: string, body: unknown) {
  const response = await fetch(new URL(path, apiBaseUrl), {
    body: JSON.stringify(body),
    headers: {
      accept: "application/json",
      "content-type": "application/json",
    },
    method: "POST",
  });
  const text = await response.text();
  const payload = text ? JSON.parse(text) : {};

  if (!response.ok) {
    throw new Error(readErrorMessage(payload, response.status));
  }

  return payload as T;
}

function assertInventoryAccount(account: AccountAuthResponse["account"]) {
  if (account.disabled || !account.roles.includes("inventory")) {
    throw new Error("This BayBlaze account does not have inventory access.");
  }
}

function getGoogleCallbackUrl() {
  return `${window.location.origin}/auth/google/callback`;
}

function readStoredSession() {
  try {
    const raw = window.localStorage.getItem(sessionStorageKey);
    if (!raw) return null;

    const session = JSON.parse(raw) as Partial<InventorySession>;
    return session.email && session.token && session.uid
      ? {
          email: session.email,
          token: session.token,
          uid: session.uid,
        }
      : null;
  } catch {
    return null;
  }
}

function readErrorMessage(payload: unknown, status: number) {
  if (typeof payload === "object" && payload && "message" in payload && typeof payload.message === "string") {
    return payload.message;
  }

  return `BayBlaze API request failed with HTTP ${status}.`;
}
