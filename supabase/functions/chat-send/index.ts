// @ts-nocheck
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { withCors } from "../_shared/cors.ts";
import { verifyFirebaseIdToken } from "../_shared/firebaseAuth.ts";

declare const Deno: any;

type Body = { otherUid?: string; text?: string };

function requireEnv(name: string): string {
  const v = String(Deno.env.get(name) || "").trim();
  if (!v) throw new Error(`Missing ${name}`);
  return v;
}

function normalizeUid(value: unknown): string {
  return String(value || "").trim();
}

function clampText(value: unknown, maxLen: number): string {
  const s = String(value ?? "").trim();
  if (!s) return "";
  return s.length > maxLen ? s.slice(0, maxLen) : s;
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
    const text = clampText(body?.text, 4000);

    if (!otherUid) {
      return new Response(JSON.stringify({ error: "Missing otherUid" }), {
        status: 400,
        headers: withCors({ "Content-Type": "application/json" }),
      });
    }
    if (otherUid === uid) {
      return new Response(JSON.stringify({ error: "Cannot message self" }), {
        status: 400,
        headers: withCors({ "Content-Type": "application/json" }),
      });
    }
    if (!text) {
      return new Response(JSON.stringify({ error: "Missing text" }), {
        status: 400,
        headers: withCors({ "Content-Type": "application/json" }),
      });
    }

    const convo = chatIdForUsers(uid, otherUid);
    const nowIso = new Date().toISOString();

    const supabase = createClient(supabaseUrl, serviceRoleKey);

    // Ensure conversation exists (idempotent).
    const { error: convoErr } = await supabase
      .from("chat_conversations")
      .upsert(
        {
          id: convo.id,
          uid_a: convo.uid_a,
          uid_b: convo.uid_b,
          last_message: text,
          last_message_at: nowIso,
          updated_at: nowIso,
        },
        { onConflict: "id" },
      );
    if (convoErr) throw convoErr;

    const { data: msg, error: msgErr } = await supabase
      .from("chat_messages")
      .insert({
        conversation_id: convo.id,
        sender_uid: uid,
        receiver_uid: otherUid,
        body: text,
        created_at: nowIso,
      })
      .select("id, conversation_id, sender_uid, receiver_uid, body, created_at, read_at")
      .single();

    if (msgErr) throw msgErr;

    return new Response(
      JSON.stringify({
        chatId: convo.id,
        message: {
          id: msg.id,
          senderId: msg.sender_uid,
          receiverId: msg.receiver_uid,
          text: msg.body,
          createdAtISO: msg.created_at,
          read: Boolean(msg.read_at),
        },
      }),
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
