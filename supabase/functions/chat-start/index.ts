// @ts-nocheck
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { withCors } from "../_shared/cors.ts";
import { verifyFirebaseIdToken } from "../_shared/firebaseAuth.ts";

declare const Deno: any;

type Body = { otherUid?: string };

function requireEnv(name: string): string {
  const v = String(Deno.env.get(name) || "").trim();
  if (!v) throw new Error(`Missing ${name}`);
  return v;
}

function normalizeUid(value: unknown): string {
  return String(value || "").trim();
}

function chatIdForUsers(uidA: string, uidB: string): { id: string; uid_a: string; uid_b: string } {
  const a = normalizeUid(uidA);
  const b = normalizeUid(uidB);
  if (!a || !b) throw new Error("Missing UIDs");
  const [uid_a, uid_b] = [a, b].sort();
  return { id: `${uid_a}_${uid_b}`, uid_a, uid_b };
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: withCors() });
  }

  try {
    if (req.method !== "POST") {
      return new Response(JSON.stringify({ error: "Method not allowed" }), {
        status: 405,
        headers: withCors({ "Content-Type": "application/json" }),
      });
    }

    const supabaseUrl = requireEnv("SUPABASE_URL");
    const serviceRoleKey = requireEnv("SUPABASE_SERVICE_ROLE_KEY");
    const firebaseProjectId = requireEnv("FIREBASE_PROJECT_ID");

    const token = req.headers.get("x-firebase-token") || req.headers.get("authorization");
    const { uid } = await verifyFirebaseIdToken(token, firebaseProjectId);

    const body = (await req.json().catch(() => null)) as Body | null;
    const otherUid = normalizeUid(body?.otherUid);
    if (!otherUid) {
      return new Response(JSON.stringify({ error: "Missing otherUid" }), {
        status: 400,
        headers: withCors({ "Content-Type": "application/json" }),
      });
    }
    if (otherUid === uid) {
      return new Response(JSON.stringify({ error: "Cannot start chat with self" }), {
        status: 400,
        headers: withCors({ "Content-Type": "application/json" }),
      });
    }

    const convo = chatIdForUsers(uid, otherUid);

    const supabase = createClient(supabaseUrl, serviceRoleKey);
    const { error } = await supabase
      .from("chat_conversations")
      .upsert(
        {
          id: convo.id,
          uid_a: convo.uid_a,
          uid_b: convo.uid_b,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "id" },
      );

    if (error) throw error;

    return new Response(
      JSON.stringify({ chatId: convo.id, participants: [convo.uid_a, convo.uid_b] }),
      { headers: withCors({ "Content-Type": "application/json" }) },
    );
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return new Response(JSON.stringify({ error: message || "Unknown error" }), {
      status: 400,
      headers: withCors({ "Content-Type": "application/json" }),
    });
  }
});
