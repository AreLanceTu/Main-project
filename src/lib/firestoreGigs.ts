import {
  Timestamp,
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
} from "firebase/firestore";
import type { Firestore } from "firebase/firestore";

export type FirestoreGigService = {
  service_id: string;
  name?: string;
  price?: number;
  delivery_time_days?: number;
  features?: string[];
};

export type FirestoreGig = {
  gig_id: string;
  title: string;
  category?: string;
  subcategory?: string;
  revisions?: number;
  tags?: string;

  cover_image_url?: string;
  cover_bucket?: string;
  cover_path?: string;

  seller_id: string;
  description_html?: string;
  services?: FirestoreGigService[];

  promoted?: boolean;
  promoted_at?: string;

  createdAt?: any;
  updatedAt?: any;
};

function safeString(value: unknown): string {
  return String(value ?? "").trim();
}

function safeNumber(value: unknown): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function coerceGig(raw: any, gigId: string): FirestoreGig {
  const services = Array.isArray(raw?.services) ? raw.services : [];

  return {
    gig_id: safeString(raw?.gig_id || gigId),
    title: safeString(raw?.title),
    category: safeString(raw?.category),
    subcategory: safeString(raw?.subcategory),
    revisions: safeNumber(raw?.revisions),
    tags: safeString(raw?.tags),

    cover_image_url: safeString(raw?.cover_image_url),
    cover_bucket: safeString(raw?.cover_bucket),
    cover_path: safeString(raw?.cover_path),

    seller_id: safeString(raw?.seller_id),
    description_html: safeString(raw?.description_html),

    services: services
      .map((s: any) => ({
        service_id: safeString(s?.service_id),
        name: safeString(s?.name),
        price: safeNumber(s?.price),
        delivery_time_days: safeNumber(s?.delivery_time_days),
        features: Array.isArray(s?.features) ? s.features.map((f: any) => safeString(f)).filter(Boolean) : undefined,
      }))
      .filter((s: any) => Boolean(s?.service_id)),

    promoted: Boolean(raw?.promoted),
    promoted_at: safeString(raw?.promoted_at),

    createdAt: raw?.createdAt,
    updatedAt: raw?.updatedAt,
  };
}

export async function getFirestoreGig(db: Firestore, gigId: string): Promise<FirestoreGig | null> {
  const id = safeString(gigId);
  if (!id) return null;

  const ref = doc(collection(db, "gigs"), id);
  const snap = await getDoc(ref);
  if (!snap.exists()) return null;
  return coerceGig(snap.data(), id);
}

export async function listFirestoreGigs(
  db: Firestore,
  opts?: { limitCount?: number },
): Promise<FirestoreGig[]> {
  const limitCount = Math.max(1, Math.min(200, Number(opts?.limitCount ?? 50)));

  const q = query(collection(db, "gigs"), orderBy("createdAt", "desc"), limit(limitCount));
  const snaps = await getDocs(q);

  const items: FirestoreGig[] = [];
  snaps.forEach((s) => {
    items.push(coerceGig(s.data(), s.id));
  });
  return items;
}

export async function upsertFirestoreGig(db: Firestore, gig: FirestoreGig): Promise<void> {
  const gigId = safeString(gig?.gig_id);
  if (!gigId) throw new Error("Missing gig_id");

  const sellerId = safeString(gig?.seller_id);
  if (!sellerId) throw new Error("Missing seller_id");

  const ref = doc(collection(db, "gigs"), gigId);

  // Preserve createdAt across updates.
  // Use a real Timestamp for new documents so rules like `createdAt is timestamp` pass.
  let createdAt: any = Timestamp.now();
  try {
    const existing = await getDoc(ref);
    if (existing.exists()) {
      const data = existing.data() as any;
      if (data?.createdAt) createdAt = data.createdAt;
    }
  } catch {
    // ignore read failures; still attempt a write
  }

  const payload: any = {
    gig_id: gigId,
    title: safeString(gig?.title),
    category: safeString(gig?.category),
    subcategory: safeString(gig?.subcategory),
    revisions: safeNumber(gig?.revisions),
    tags: safeString(gig?.tags),

    cover_image_url: safeString(gig?.cover_image_url),
    cover_bucket: safeString(gig?.cover_bucket),
    cover_path: safeString(gig?.cover_path),

    seller_id: sellerId,
    description_html: safeString(gig?.description_html),

    services: Array.isArray(gig?.services) ? gig.services : [],

    promoted: Boolean(gig?.promoted),
    promoted_at: safeString(gig?.promoted_at),

    createdAt,
    updatedAt: serverTimestamp(),
  };

  // Avoid storing empty optional strings as required fields.
  if (!payload.category) delete payload.category;
  if (!payload.subcategory) delete payload.subcategory;
  if (!payload.tags) delete payload.tags;
  if (!payload.cover_image_url) delete payload.cover_image_url;
  if (!payload.cover_bucket) delete payload.cover_bucket;
  if (!payload.cover_path) delete payload.cover_path;
  if (!payload.description_html) delete payload.description_html;
  if (!payload.promoted) delete payload.promoted;
  if (!payload.promoted_at) delete payload.promoted_at;

  await setDoc(ref, payload, { merge: true });
}
