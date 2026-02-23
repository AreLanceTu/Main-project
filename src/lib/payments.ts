import { getFunctionsBaseUrl } from "@/lib/functionsClient";
import { getFirebaseIdToken } from "@/lib/functionsClient";

type CreateOrderResponse = {
  orderId: string;
  amount: number; // paise
  currency: string;
  razorpayKeyId: string;
  receipt?: string;
};

type VerifyResponse = { ok: boolean; status?: string; error?: string };

export async function createRazorpayOrder(params: {
  amountRupees: number;
  purpose?: string;
  notes?: Record<string, unknown>;
}): Promise<CreateOrderResponse> {
  let token: string | null = null;
  try {
    token = await getFirebaseIdToken();
  } catch {
    token = null;
  }

  const res = await fetch(`${getFunctionsBaseUrl()}/payments-create-order`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { "x-firebase-token": token } : {}),
    },
    body: JSON.stringify({
      amount: params.amountRupees,
      currency: "INR",
      purpose: params.purpose || "",
      notes: params.notes || {},
    }),
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const details = (data as any)?.details;
    const detailsText = details ? ` Details: ${JSON.stringify(details)}` : "";
    throw new Error(`${(data as any)?.error || "Failed to create order"}${detailsText}`);
  }

  return data as CreateOrderResponse;
}

export async function verifyRazorpayPayment(params: {
  orderId: string;
  paymentId: string;
  signature: string;
}): Promise<VerifyResponse> {
  let token: string | null = null;
  try {
    token = await getFirebaseIdToken();
  } catch {
    token = null;
  }

  const res = await fetch(`${getFunctionsBaseUrl()}/payments-verify`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { "x-firebase-token": token } : {}),
    },
    body: JSON.stringify({
      razorpay_order_id: params.orderId,
      razorpay_payment_id: params.paymentId,
      razorpay_signature: params.signature,
    }),
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const details = (data as any)?.details;
    const detailsText = details ? ` Details: ${JSON.stringify(details)}` : "";
    throw new Error(`${(data as any)?.error || "Payment verification failed"}${detailsText}`);
  }

  return data as VerifyResponse;
}

let razorpayScriptPromise: Promise<void> | null = null;

export function ensureRazorpayScriptLoaded(): Promise<void> {
  if (razorpayScriptPromise) return razorpayScriptPromise;

  razorpayScriptPromise = new Promise<void>((resolve, reject) => {
    if (typeof window === "undefined") return reject(new Error("No window"));
    if ((window as any).Razorpay) return resolve();

    const existing = document.querySelector('script[src="https://checkout.razorpay.com/v1/checkout.js"]');
    if (existing) {
      existing.addEventListener("load", () => resolve());
      existing.addEventListener("error", () => reject(new Error("Failed to load Razorpay")));
      return;
    }

    const script = document.createElement("script");
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Failed to load Razorpay"));
    document.body.appendChild(script);
  });

  return razorpayScriptPromise;
}

export async function openRazorpayCheckout(params: {
  amountRupees: number;
  purpose: string;
  prefill?: { name?: string; email?: string };
  notes?: Record<string, unknown>;
}): Promise<{ orderId: string; paymentId: string; signature: string }> {
  await ensureRazorpayScriptLoaded();

  const order = await createRazorpayOrder({
    amountRupees: params.amountRupees,
    purpose: params.purpose,
    notes: params.notes,
  });

  return await new Promise((resolve, reject) => {
    const RazorpayCtor = (window as any).Razorpay;
    if (!RazorpayCtor) return reject(new Error("Razorpay not available"));

    const rzp = new RazorpayCtor({
      key: order.razorpayKeyId,
      amount: order.amount,
      currency: order.currency,
      order_id: order.orderId,
      name: "GigFlow",
      description: params.purpose,
      method: {
        card: true,
        netbanking: true,
      },
      prefill: {
        name: params.prefill?.name,
        email: params.prefill?.email,
      },
      notes: params.notes || {},
      handler: (resp: any) => {
        resolve({
          orderId: String(resp?.razorpay_order_id || ""),
          paymentId: String(resp?.razorpay_payment_id || ""),
          signature: String(resp?.razorpay_signature || ""),
        });
      },
      modal: {
        ondismiss: () => reject(new Error("Payment cancelled")),
      },
    });

    rzp.open();
  });
}
