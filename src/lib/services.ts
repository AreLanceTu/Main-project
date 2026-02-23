import { Timestamp, collection, doc, getDoc, serverTimestamp, setDoc } from "firebase/firestore";
import type { Firestore } from "firebase/firestore";

type ServiceInput = {
  service_id: string;
  name?: string;
  price?: number;
};

type UpsertServicesParams = {
  db: Firestore;
  freelancerId: string;
  gigTitle: string;
  gigDescription?: string;
  category: string;
  services: ServiceInput[];
};

function safeString(value: unknown): string {
  return String(value ?? "").trim();
}

function safeNumber(value: unknown): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

/**
 * Creates/updates Firestore documents in `services` (one per service tier).
 * This is used to match the report-required Services Collection schema.
 */
export async function upsertFirestoreServices(params: UpsertServicesParams): Promise<void> {
  const freelancerId = safeString(params.freelancerId);
  if (!freelancerId) throw new Error("Missing freelancerId");

  const category = safeString(params.category) || "Uncategorized";
  const gigTitle = safeString(params.gigTitle) || "Service";
  const description = safeString(params.gigDescription || "");

  const services = Array.isArray(params.services) ? params.services : [];
  if (!services.length) return;

  for (const svc of services) {
    const serviceId = safeString(svc?.service_id);
    if (!serviceId) continue;

    const serviceRef = doc(collection(params.db, "services"), serviceId);

    // Preserve createdAt across updates.
    // Use a real Timestamp for new documents so rules like `createdAt is timestamp` pass.
    let createdAt: any = Timestamp.now();
    try {
      const existing = await getDoc(serviceRef);
      if (existing.exists()) {
        const data = existing.data() as any;
        if (data?.createdAt) createdAt = data.createdAt;
      }
    } catch {
      // ignore read failures; still attempt a write
    }

    const tierName = safeString(svc?.name) || serviceId.split(":").pop() || "";
    const title = tierName ? `${gigTitle} (${tierName})` : gigTitle;

    await setDoc(
      serviceRef,
      {
        serviceId,
        freelancerId,
        title,
        description,
        category,
        price: safeNumber(svc?.price),
        createdAt,
        updatedAt: serverTimestamp(),
      },
      { merge: true },
    );
  }
}
