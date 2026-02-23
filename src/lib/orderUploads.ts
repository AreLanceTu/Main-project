import { supabaseUploadViaFunction } from "@/lib/supabaseStorage";

export type UploadedFile = {
  name: string;
  url: string;
  path: string;
  size: number;
  contentType: string;
};

function safeFilename(name: string): string {
  return String(name || "file")
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/-+/g, "-")
    .slice(0, 120);
}

export async function uploadOrderFiles(params: {
  orderId: string;
  userId: string;
  kind: "requirements" | "chat" | "delivery";
  files: File[];
}): Promise<UploadedFile[]> {
  const orderId = String(params.orderId || "");
  const userId = String(params.userId || "");
  if (!orderId) throw new Error("Missing orderId");
  if (!userId) throw new Error("Missing userId");

  const list = Array.isArray(params.files) ? params.files : [];
  if (!list.length) return [];

  const uploaded: UploadedFile[] = [];
  for (const f of list) {
    const id = typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : String(Date.now());
    const fileName = `${id}-${safeFilename(f.name)}`;
    const path = `orders/${orderId}/${userId}/${params.kind}/${fileName}`;

    // Supabase Storage upload (via Edge Function, authenticated with Firebase token).
    // Requires: Supabase bucket named 'orders' and Edge Function 'storage-upload' deployed.
    const result = await supabaseUploadViaFunction({
      bucket: "orders",
      path,
      file: f,
    });

    const url = result.publicUrl || "";
    uploaded.push({
      name: f.name,
      url,
      path,
      size: Number(f.size || 0),
      contentType: f.type || "application/octet-stream",
    });
  }

  return uploaded;
}
