import { getFirebaseIdToken, getFunctionsBaseUrl } from "@/lib/functionsClient";

export type SubscriptionStatus = {
  ok: boolean;
  active: boolean;
  plan: string | null;
  currentPeriodEnd: string | null;
};

export async function getMySubscriptionStatus(): Promise<SubscriptionStatus> {
  const token = await getFirebaseIdToken();

  const res = await fetch(`${getFunctionsBaseUrl()}/subscriptions-status`, {
    method: "GET",
    headers: {
      "Content-Type": "application/json",
      "x-firebase-token": token,
    },
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const detailsText = data?.error ? `: ${String(data.error)}` : "";
    throw new Error(`Failed to fetch subscription status${detailsText}`);
  }

  return data as SubscriptionStatus;
}
