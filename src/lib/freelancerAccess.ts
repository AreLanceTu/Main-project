export function isFreelancerDocRegistered(data: any, uid: string): boolean {
  if (!uid) return false;
  if (!data || typeof data !== "object") return false;

  const status = String((data as any).status || "").trim().toLowerCase();
  const storedUid = String((data as any).uid || "").trim();
  const profile = (data as any).profile;

  const fullName = String(profile?.fullName || "").trim();
  const phone = String(profile?.phone || "").trim();
  const title = String(profile?.title || "").trim();
  const bio = String(profile?.bio || "").trim();
  const city = String(profile?.city || "").trim();
  const state = String(profile?.state || "").trim();

  return (
    status === "active" &&
    storedUid === uid &&
    Boolean(fullName) &&
    Boolean(phone) &&
    Boolean(title) &&
    bio.length >= 30 &&
    Boolean(city) &&
    Boolean(state)
  );
}
