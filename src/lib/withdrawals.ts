import { getFirebaseIdToken, getFunctionsBaseUrl } from "@/lib/functionsClient";

const WITHDRAWALS_API_URL_OVERRIDE_KEY = "gigflow.withdrawalsApiUrl";
const WITHDRAWALS_SUPABASE_DEMO_OVERRIDE_KEY = "gigflow.withdrawalsUseSupabaseDemo";

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
  const override = getWithdrawalsApiUrlOverride();
  if (override) return override.replace(/\/+$/, "");

  const configured = String(import.meta.env.VITE_WITHDRAWALS_API_URL || "").trim();
  if (configured) return configured.replace(/\/+$/, "");
  return "";
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
