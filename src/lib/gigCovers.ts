import { supabaseSignedDownloadUrl } from "@/lib/supabaseStorage";

export type StoredGigWithCover = {
  cover_image_url?: string;
  cover_bucket?: string;
  cover_path?: string;
};

export async function resolveGigCoverUrl(gig: StoredGigWithCover): Promise<string | null> {
  const direct = String(gig?.cover_image_url || "").trim();
  if (direct) return direct;

  const bucket = String(gig?.cover_bucket || "").trim();
  const path = String(gig?.cover_path || "").trim();
  if (!bucket || !path) return null;

  const signed = await supabaseSignedDownloadUrl({
    bucket,
    path,
    // Keep URLs valid long enough for typical browsing sessions.
    expiresInSeconds: 60 * 60 * 6,
  });

  return signed?.signedUrl ? String(signed.signedUrl) : null;
}
