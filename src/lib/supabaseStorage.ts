import { getFirebaseIdToken, getFunctionsBaseUrl } from "@/lib/functionsClient";

type SignedUploadResponse = {
  bucket: string;
  path: string;
  token: string | null;
  signedUrl: string | null;
};

async function ensureFunctionExists(functionName: string): Promise<void> {
  // Important: use a simple cross-origin request (no custom headers) so we can
  // detect "function not found" without triggering a CORS preflight.
  const base = String(getFunctionsBaseUrl() || "").replace(/\/+$/, "");
  const url = `${base}/${functionName}`;

  let res: Response;
  try {
    res = await fetch(url, { method: "GET", headers: { Accept: "application/json" } });
  } catch {
    // If we can't even GET, we'll let the caller do the real request and surface its error.
    return;
  }

  if (res.status !== 404) return;

  let message = "Requested function was not found";
  try {
    const data = await res.json();
    if (typeof data?.message === "string" && data.message.trim()) message = data.message.trim();
  } catch {
    // ignore
  }

  throw new Error(
    `Supabase Edge Function '${functionName}' is not deployed (HTTP 404). ${message}. ` +
      `Deploy it (and set required secrets) before uploading attachments.`,
  );
}

async function fetchJson(url: string, init: RequestInit): Promise<any> {
  let res: Response;
  try {
    res = await fetch(url, init);
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    throw new Error(
      `Network error calling ${url}: ${message}. This is commonly caused by CORS (failed preflight), a wrong functions URL, or an undeployed Edge Function.`,
    );
  }

  let data: any = {};
  try {
    data = await res.json();
  } catch {
    const text = await res.text().catch(() => "");
    if (!res.ok) {
      throw new Error(text ? `Request failed (HTTP ${res.status}): ${text}` : `Request failed (HTTP ${res.status})`);
    }
    return {};
  }

  if (!res.ok) {
    throw new Error(data?.error || `Request failed (HTTP ${res.status})`);
  }

  return data;
}

export async function supabaseSignedUploadUrl(args: {
  bucket: string;
  path: string;
  contentType?: string;
}): Promise<SignedUploadResponse> {
  await ensureFunctionExists("storage-signed-upload");
  const token = await getFirebaseIdToken();

  const data = await fetchJson(`${getFunctionsBaseUrl()}/storage-signed-upload`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-firebase-token": token,
    },
    body: JSON.stringify({
      bucket: args.bucket,
      path: args.path,
      contentType: args.contentType || "application/octet-stream",
    }),
  });

  return {
    bucket: String(data?.bucket || ""),
    path: String(data?.path || ""),
    token: data?.token ? String(data.token) : null,
    signedUrl: data?.signedUrl ? String(data.signedUrl) : null,
  };
}

export async function supabaseUploadViaFunction(args: {
  bucket: string;
  path: string;
  file: File;
}): Promise<{ bucket: string; path: string; publicUrl: string | null }> {
  await ensureFunctionExists("storage-upload");
  const token = await getFirebaseIdToken();

  const url = new URL(`${getFunctionsBaseUrl()}/storage-upload`);
  url.searchParams.set("bucket", args.bucket);
  url.searchParams.set("path", args.path);

  const data = await fetchJson(url.toString(), {
    method: "POST",
    headers: {
      "x-firebase-token": token,
      "x-file-name": args.file?.name || "file",
      "Content-Type": args.file?.type || "application/octet-stream",
    },
    body: args.file,
  });

  return {
    bucket: String(data?.bucket || args.bucket),
    path: String(data?.path || args.path),
    publicUrl: data?.publicUrl ? String(data.publicUrl) : null,
  };
}
