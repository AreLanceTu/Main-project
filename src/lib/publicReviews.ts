import {
  collection,
  limit,
  onSnapshot,
  query,
  type Firestore,
  where,
} from "firebase/firestore";

export type PublicOrderReviewDoc = {
  orderId: string;
  sellerId: string;
  rating: number; // 1..5
  comment: string;
  createdAt?: any;
};

export type SellerRatingStats = {
  avgRating: number | null;
  ratingCount: number;
};

function normalizeRating(value: any): number | null {
  const n = Number(value);
  if (!Number.isFinite(n)) return null;
  if (n < 1 || n > 5) return null;
  return n;
}

export function listenSellerRatingStats(
  db: Firestore,
  sellerId: string,
  cb: (stats: SellerRatingStats) => void,
  opts?: { max?: number },
): () => void {
  const safeSellerId = String(sellerId || "").trim();
  if (!safeSellerId) {
    cb({ avgRating: null, ratingCount: 0 });
    return () => {};
  }

  const max = Math.max(1, Math.min(500, Number(opts?.max ?? 200)));
  const q = query(
    collection(db, "public_order_reviews"),
    where("sellerId", "==", safeSellerId),
    limit(max),
  );

  return onSnapshot(
    q,
    (snap) => {
      let sum = 0;
      let count = 0;
      for (const d of snap.docs) {
        const rating = normalizeRating((d.data() as any)?.rating);
        if (rating == null) continue;
        sum += rating;
        count += 1;
      }

      const avgRating = count ? Number((sum / count).toFixed(2)) : null;
      cb({ avgRating, ratingCount: count });
    },
    () => cb({ avgRating: null, ratingCount: 0 }),
  );
}
