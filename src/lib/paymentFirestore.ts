import { auth, db } from "@/firebase";
import { doc, serverTimestamp, setDoc } from "firebase/firestore";

export type FirestorePaymentRecord = {
  paymentId: string;
  userId: string;
  razorpayOrderId: string;
  amountRupees: number;
  currency: string;
  purpose: string;
  status: "Paid" | "Failed" | string;
  quantityTotal: number;
  quantityUsed: number;
  used: boolean;
  createdAt: unknown;
  updatedAt: unknown;
  notes?: Record<string, unknown>;
  related?: Record<string, unknown>;
  source?: string;
};

export async function storePaymentInFirestore(params: {
  paymentId: string;
  orderId: string;
  amountRupees: number;
  currency?: string;
  purpose?: string;
  status?: string;
  quantityTotal?: number;
  quantityUsed?: number;
  notes?: Record<string, unknown>;
  related?: Record<string, unknown>;
  source?: string;
}): Promise<void> {
  const user = auth.currentUser;
  if (!user?.uid) {
    throw new Error("Not signed in");
  }

  const quantityTotal = Math.max(1, Number(params.quantityTotal ?? 1) || 1);
  const quantityUsed = Math.max(0, Number(params.quantityUsed ?? 0) || 0);
  const used = quantityUsed >= quantityTotal;

  const payload: Omit<FirestorePaymentRecord, "createdAt" | "updatedAt"> & {
    createdAt: any;
    updatedAt: any;
  } = {
    paymentId: String(params.paymentId || ""),
    userId: user.uid,
    razorpayOrderId: String(params.orderId || ""),
    amountRupees: Number(params.amountRupees || 0),
    currency: String(params.currency || "INR"),
    purpose: String(params.purpose || ""),
    status: String(params.status || "Paid"),
    quantityTotal,
    quantityUsed,
    used,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    notes: params.notes || {},
    related: params.related || {},
    source: String(params.source || "razorpay"),
  };

  if (!payload.paymentId) throw new Error("Missing paymentId");
  if (!payload.razorpayOrderId) throw new Error("Missing orderId");

  const ref = doc(db, "payments", payload.paymentId);
  await setDoc(ref, payload, { merge: true });
}
