import { getStoredGig, upsertStoredGig } from "@/lib/gigStore";

export const DEMO_GIG_IDS = ["1", "2", "3", "4", "5", "6"];

export function migrateStoredDemoGigsToSellerUid(targetSellerUid: string) {
  const safeTarget = String(targetSellerUid || "").trim();
  if (!safeTarget) return;

  for (const gigId of DEMO_GIG_IDS) {
    const existing = getStoredGig(gigId);
    if (!existing) continue;
    if (String(existing?.seller_id || "") === safeTarget) continue;

    upsertStoredGig({
      ...existing,
      seller_id: safeTarget,
    });
  }
}
