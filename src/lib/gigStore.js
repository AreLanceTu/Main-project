const STORAGE_KEY = "gigflow:gigs:v1";

function safeJsonParse(value, fallback) {
  try {
    if (!value) return fallback;
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

export function listStoredGigs() {
  if (typeof window === "undefined") return [];
  const raw = window.localStorage.getItem(STORAGE_KEY);
  const parsed = safeJsonParse(raw, []);
  return Array.isArray(parsed) ? parsed : [];
}

export function getStoredGig(gigId) {
  if (!gigId) return null;
  const gigs = listStoredGigs();
  return gigs.find((g) => String(g?.gig_id) === String(gigId)) || null;
}

export function upsertStoredGig(gig) {
  if (typeof window === "undefined") return gig;
  if (!gig || !gig.gig_id) return gig;

  const prev = listStoredGigs();
  const next = [gig, ...prev.filter((g) => String(g?.gig_id) !== String(gig.gig_id))];
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  return gig;
}

export function removeStoredGig(gigId) {
  if (typeof window === "undefined") return;
  const prev = listStoredGigs();
  const next = prev.filter((g) => String(g?.gig_id) !== String(gigId));
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
}
