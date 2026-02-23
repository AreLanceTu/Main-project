export function getDemoSellerUid(): string | null {
  // Vite exposes env vars at build time via import.meta.env.
  const raw = (import.meta as any)?.env?.VITE_DEMO_SELLER_UID;
  const value = String(raw || "").trim();
  return value ? value : null;
}

export function getDemoSellerIdForGigId(gigId: string): string {
  return getDemoSellerUid() ?? `demo_seller_${String(gigId || "")}`;
}
