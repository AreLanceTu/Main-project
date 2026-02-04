// @ts-nocheck
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { withCors } from "../_shared/cors.ts";
import { verifyFirebaseIdToken } from "../_shared/firebaseAuth.ts";

declare const Deno: any;

function requireEnv(name: string): string {
  const v = String(Deno.env.get(name) || "").trim();
  if (!v) throw new Error(`Missing ${name}`);
  return v;
}

function normalizeId(value: unknown): string {
  return String(value || "").trim();
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: withCors() });
  }

  try {
    if (req.method !== "GET") {
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

    const url = new URL(req.url);
    const chatId = normalizeId(url.searchParams.get("chatId"));
    const limit = Math.min(Math.max(Number(url.searchParams.get("limit") || 200), 1), 500);

    if (!chatId) {
      return new Response(JSON.stringify({ error: "Missing chatId" }), {
        status: 400,
        headers: withCors({ "Content-Type": "application/json" }),
      });
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey);

    // Validate membership.
    const { data: convo, error: convoErr } = await supabase
      .from("chat_conversations")
      .select("id, uid_a, uid_b")
      .eq("id", chatId)
      .maybeSingle();

    if (convoErr) throw convoErr;
    if (!convo) {
      return new Response(JSON.stringify({ error: "Chat not found" }), {
        status: 404,
        headers: withCors({ "Content-Type": "application/json" }),
      });
    }

    const isParticipant = convo.uid_a === uid || convo.uid_b === uid;
    if (!isParticipant) {
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403,
        headers: withCors({ "Content-Type": "application/json" }),
      });
    }

    const { data: rows, error } = await supabase
      .from("chat_messages")
      .select("id, sender_uid, receiver_uid, body, created_at, read_at")
      .eq("conversation_id", chatId)
      .order("created_at", { ascending: true })
      .limit(limit);

    if (error) throw error;

    const messages = (rows || []).map((m: any) => ({
      id: m.id,
      senderId: m.sender_uid,
      receiverId: m.receiver_uid,
      text: m.body || "",
      createdAtISO: m.created_at,
      read: Boolean(m.read_at),
    }));

    return new Response(JSON.stringify({ messages }), {
      headers: withCors({ "Content-Type": "application/json" }),
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return new Response(JSON.stringify({ error: message || "Unknown error" }), {
      status: 400,
      headers: withCors({ "Content-Type": "application/json" }),
    });
  }
});
