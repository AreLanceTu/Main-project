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
    const limit = Math.min(Math.max(Number(url.searchParams.get("limit") || 30), 1), 100);

    const supabase = createClient(supabaseUrl, serviceRoleKey);

    // We store deterministic pairs (uid_a, uid_b) sorted, and conversation id = `${uid_a}_${uid_b}`.
    const { data, error } = await supabase
      .from("chat_conversations")
      .select("id, uid_a, uid_b, last_message, last_message_at")
      .or(`uid_a.eq.${uid},uid_b.eq.${uid}`)
      .order("last_message_at", { ascending: false, nullsFirst: false })
      .order("updated_at", { ascending: false })
      .limit(limit);

    if (error) throw error;

    const chats = (data || []).map((row: any) => ({
      chatId: row.id,
      participants: [row.uid_a, row.uid_b],
      lastMessage: row.last_message || "",
      lastUpdatedISO: row.last_message_at || null,
      // Frontend expects unreadCount shape; we don't implement unread tracking in v1.
      unreadCount: {},
    }));

    return new Response(JSON.stringify({ chats }), {
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
