import { getFirebaseIdToken, getFunctionsBaseUrl } from "@/lib/functionsClient";

export type PaymentOrder = {
  id: string;
  amount: number;
  currency: string;
  status: string;
  receipt?: string | null;
  razorpay_order_id?: string | null;
  razorpay_payment_id?: string | null;
  notes?: Record<string, unknown> | null;
  created_at?: string | null;
  paid_at?: string | null;
};

export async function getMyPaymentOrders(limit = 10): Promise<PaymentOrder[]> {
  const token = await getFirebaseIdToken();
  const url = new URL(`${getFunctionsBaseUrl()}/payments-my-orders`);
  url.searchParams.set("limit", String(limit));

  const res = await fetch(url.toString(), {
    method: "GET",
    headers: {
      "Content-Type": "application/json",
      "x-firebase-token": token,
    },
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const detailsText = data?.error ? `: ${String(data.error)}` : "";
    throw new Error(`Failed to load payments${detailsText}`);
  }

  return Array.isArray(data?.items) ? (data.items as PaymentOrder[]) : [];
}
