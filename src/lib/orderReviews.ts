import { doc, getDoc, serverTimestamp, setDoc } from "firebase/firestore";

import { db } from "@/firebase";

export type OrderReviewDoc = {
  orderId: string;
  gigId: string; // can be "" for legacy orders
  serviceId: string;
  sellerId: string;
  buyerId: string;
  rating: number; // 1..5
  comment: string;
  createdAt?: any;
};

export async function getOrderReview(orderId: string): Promise<OrderReviewDoc | null> {
  const id = String(orderId || "").trim();
  if (!id) return null;
  const snap = await getDoc(doc(db, "order_reviews", id));
  if (!snap.exists()) return null;
  return snap.data() as OrderReviewDoc;
}

export async function createOrderReview(params: {
  orderId: string;
  gigId?: string;
  serviceId: string;
  sellerId: string;
  buyerId: string;
  rating: number;
  comment?: string;
}): Promise<void> {
  const orderId = String(params.orderId || "").trim();
  if (!orderId) throw new Error("Missing orderId");

  const rating = Number(params.rating);
  if (!Number.isFinite(rating) || rating < 1 || rating > 5) {
    throw new Error("Rating must be between 1 and 5");
  }

  const payload: Omit<OrderReviewDoc, "createdAt"> & { createdAt: any } = {
    orderId,
    gigId: String(params.gigId || "").trim(),
    serviceId: String(params.serviceId || "").trim(),
    sellerId: String(params.sellerId || "").trim(),
    buyerId: String(params.buyerId || "").trim(),
    rating,
    comment: String(params.comment || "").trim(),
    createdAt: serverTimestamp(),
  };

  if (!payload.serviceId) throw new Error("Missing serviceId");
  if (!payload.sellerId) throw new Error("Missing sellerId");
  if (!payload.buyerId) throw new Error("Missing buyerId");

  await setDoc(doc(db, "order_reviews", orderId), payload, { merge: false });
}
