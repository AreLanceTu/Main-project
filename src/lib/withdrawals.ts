import { getFirebaseIdToken, getFunctionsBaseUrl } from "@/lib/functionsClient";

const WITHDRAWALS_API_URL_OVERRIDE_KEY = "gigflow.withdrawalsApiUrl";
const WITHDRAWALS_SUPABASE_DEMO_OVERRIDE_KEY = "gigflow.withdrawalsUseSupabaseDemo";

// If the legacy localhost demo server is configured but unreachable, browsers will still log
// net::ERR_CONNECTION_REFUSED even if we catch the exception and fall back.
// To avoid spamming console/network logs (withdrawals poll frequently), disable demo-server
// attempts for the remainder of the session after the first network failure.
let demoServerDisabledForSession = false;

export function getWithdrawalsApiUrlOverride(): string | null {
  try {
    const raw = window?.localStorage?.getItem(WITHDRAWALS_API_URL_OVERRIDE_KEY);
    const value = String(raw || "").trim();
    return value ? value : null;
  } catch {
    return null;
  }
}

export function setWithdrawalsApiUrlOverride(url: string | null): void {
  try {
    if (!url || !String(url).trim()) {
      window?.localStorage?.removeItem(WITHDRAWALS_API_URL_OVERRIDE_KEY);
      return;
    }

    const normalized = String(url).trim().replace(/\/+$/, "");
    window?.localStorage?.setItem(WITHDRAWALS_API_URL_OVERRIDE_KEY, normalized);
  } catch {
    // ignore
  }
}

export function getWithdrawalsUseSupabaseDemoOverride(): boolean {
  try {
    const raw = window?.localStorage?.getItem(WITHDRAWALS_SUPABASE_DEMO_OVERRIDE_KEY);
    return raw === "1" || raw === "true";
  } catch {
    return false;
  }
}

export function setWithdrawalsUseSupabaseDemoOverride(enabled: boolean): void {
  try {
    if (!enabled) {
      window?.localStorage?.removeItem(WITHDRAWALS_SUPABASE_DEMO_OVERRIDE_KEY);
      return;
    }

    window?.localStorage?.setItem(WITHDRAWALS_SUPABASE_DEMO_OVERRIDE_KEY, "1");
  } catch {
    // ignore
  }
}

function getWithdrawalsApiBaseUrl(): string {
  if (demoServerDisabledForSession) return "";

  const override = getWithdrawalsApiUrlOverride();
  if (override) {
    const normalized = override.replace(/\/+$/, "");
    // Never use localhost demo URLs in production or non-localhost environments.
    // This also protects against stale localStorage overrides on deployed sites.
    try {
      const u = new URL(normalized);
      const isLocalHost = u.hostname === "localhost" || u.hostname === "127.0.0.1";
      const isSameHostLocal = typeof window !== "undefined" && window.location?.hostname === "localhost";
      if (isLocalHost && !import.meta.env.DEV && !isSameHostLocal) return "";
    } catch {
      // If it's not a valid absolute URL, ignore.
      return "";
    }
    return normalized;
  }

  const configured = String(import.meta.env.VITE_WITHDRAWALS_API_URL || "").trim();
  if (configured) {
    const normalized = configured.replace(/\/+$/, "");
    try {
      const u = new URL(normalized);
      const isLocalHost = u.hostname === "localhost" || u.hostname === "127.0.0.1";
      const isSameHostLocal = typeof window !== "undefined" && window.location?.hostname === "localhost";
      if (isLocalHost && !import.meta.env.DEV && !isSameHostLocal) return "";
    } catch {
      return "";
    }
    return normalized;
  }
  return "";
}

function isNetworkFetchError(err: unknown): boolean {
  // In browsers, failed fetches commonly throw TypeError.
  // In some environments, message contains e.g. ERR_CONNECTION_REFUSED / Failed to fetch.
  if (err instanceof TypeError) return true;
  const msg = String((err as any)?.message || err || "").toLowerCase();
  return msg.includes("failed to fetch") || msg.includes("connection refused") || msg.includes("err_connection_refused");
}

export type WithdrawalCreateInput =
  | {
      amount: number;
      method: "upi";
      accountHolderName: string;
      upiId: string;
    }
  | {
      amount: number;
      method: "bank";
      accountHolderName: string;
      bankAccountNumber: string;
      ifsc: string;
    };

export type WithdrawalListItem = {
  id: string;
  amount: number;
  status: string;
  createdAtISO?: string;
  updatedAtISO?: string;
  destinationSummary?: string;
};

export async function createWithdrawal(input: WithdrawalCreateInput): Promise<{ id: string; status: string }> {
  const token = await getFirebaseIdToken();

  const demoBaseUrl = getWithdrawalsApiBaseUrl();
  if (demoBaseUrl) {
    try {
      const res = await fetch(`${demoBaseUrl}/api/withdrawals`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(input),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data?.error || `Withdrawal request failed (HTTP ${res.status})`);
      }

      return { id: String(data?.id || ""), status: String(data?.status || "pending") };
    } catch (e) {
      // If the demo server is down/unreachable, fall back to Edge Functions.
      if (!isNetworkFetchError(e)) throw e;
      demoServerDisabledForSession = true;
    }
  }

  const functionName = getWithdrawalsUseSupabaseDemoOverride() ? "withdrawals-demo-create" : "withdrawals-create";
  const res = await fetch(`${getFunctionsBaseUrl()}/${functionName}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-firebase-token": token,
    },
    body: JSON.stringify(input),
  });

  let data: any = {};
  try {
    data = await res.json();
  } catch {
    const text = await res.text().catch(() => "");
    if (!res.ok) {
      throw new Error(text ? `Withdrawal request failed (HTTP ${res.status}): ${text}` : `Withdrawal request failed (HTTP ${res.status})`);
    }
  }
  if (!res.ok) {
    throw new Error(data?.error || `Withdrawal request failed (HTTP ${res.status})`);
  }

  return { id: String(data?.id || ""), status: String(data?.status || "pending") };
}

export async function listWithdrawals(limit = 25): Promise<WithdrawalListItem[]> {
  const token = await getFirebaseIdToken();

  const demoBaseUrl = getWithdrawalsApiBaseUrl();
  if (demoBaseUrl) {
    try {
      const url = new URL(`${demoBaseUrl}/api/withdrawals`);
      url.searchParams.set("limit", String(limit));

      const res = await fetch(url.toString(), {
        method: "GET",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data?.error || `Failed to load withdrawals (HTTP ${res.status})`);
      }

      return Array.isArray(data?.withdrawals) ? (data.withdrawals as WithdrawalListItem[]) : [];
    } catch (e) {
      if (!isNetworkFetchError(e)) throw e;
      // Demo server unreachable => fall back to Edge Functions.
      demoServerDisabledForSession = true;
    }
  }

  const functionName = getWithdrawalsUseSupabaseDemoOverride() ? "withdrawals-demo-list" : "withdrawals-list";
  const url = new URL(`${getFunctionsBaseUrl()}/${functionName}`);
  url.searchParams.set("limit", String(limit));

  const res = await fetch(url.toString(), {
    method: "GET",
    headers: {
      "x-firebase-token": token,
    },
  });

  let data: any = {};
  try {
    data = await res.json();
  } catch {
    const text = await res.text().catch(() => "");
    if (!res.ok) {
      throw new Error(text ? `Failed to load withdrawals (HTTP ${res.status}): ${text}` : `Failed to load withdrawals (HTTP ${res.status})`);
    }
  }
  if (!res.ok) {
    throw new Error(data?.error || `Failed to load withdrawals (HTTP ${res.status})`);
  }

  return Array.isArray(data?.withdrawals) ? (data.withdrawals as WithdrawalListItem[]) : [];
}
