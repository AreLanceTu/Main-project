import { withCors } from "../_shared/cors.ts";
import { verifyFirebaseIdToken } from "../_shared/firebaseAuth.ts";
import { openRouterChatCompletion, type OpenRouterMessage } from "../_shared/openrouter.ts";

// VS Code / TS tooling in this repo isn't configured with Deno types.
// The Supabase Edge runtime provides Deno at execution time.
declare const Deno: any;

type ChatBody = {
  // Preferred: chat-completions style messages.
  messages?: Array<{ role?: string; content?: string }>;

  // Convenience for simple UIs.
  prompt?: string;
  system?: string;

  // Optional overrides.
  model?: string;
  temperature?: number;
  maxTokens?: number;
};

function normalizeRole(role: unknown): "system" | "user" | "assistant" {
  const r = String(role || "").trim().toLowerCase();
  if (r === "system") return "system";
  if (r === "assistant") return "assistant";
  return "user";
}

function clampText(text: unknown, maxLen: number): string {
  const s = String(text ?? "").trim();
  if (!s) return "";
  return s.length > maxLen ? s.slice(0, maxLen) : s;
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

    const firebaseProjectId = Deno.env.get("FIREBASE_PROJECT_ID");
    if (!firebaseProjectId) throw new Error("Missing FIREBASE_PROJECT_ID");

    const token = req.headers.get("x-firebase-token") || req.headers.get("authorization");
    await verifyFirebaseIdToken(token, firebaseProjectId);

    const body = (await req.json().catch(() => null)) as ChatBody | null;
    if (!body) throw new Error("Invalid JSON body");

    const openrouterApiKey = String(Deno.env.get("OPENROUTER_API_KEY") || "").trim();
    if (!openrouterApiKey) throw new Error("Missing OPENROUTER_API_KEY");

    const model = String(body.model || Deno.env.get("OPENROUTER_MODEL") || "openai/gpt-4o-mini").trim();

    let messages: OpenRouterMessage[] = [];

    const system = clampText(
      body.system || "You are a helpful assistant for a freelance marketplace app.",
      2000,
    );

    if (Array.isArray(body.messages) && body.messages.length) {
      messages = body.messages
        .slice(-20)
        .map((m) => ({
          role: normalizeRole(m?.role),
          content: clampText(m?.content, 6000),
        }))
        .filter((m) => Boolean(m.content));

      // Ensure there's at least one user message.
      if (!messages.some((m) => m.role === "user")) {
        const prompt = clampText(body.prompt, 6000);
        if (prompt) messages.push({ role: "user", content: prompt });
      }

      // Prepend system if caller didn't include it.
      if (system && !messages.some((m) => m.role === "system")) {
        messages.unshift({ role: "system", content: system });
      }
    } else {
      const prompt = clampText(body.prompt, 6000);
      if (!prompt) {
        return new Response(JSON.stringify({ error: "Missing prompt or messages" }), {
          status: 400,
          headers: withCors({ "Content-Type": "application/json" }),
        });
      }

      messages = [
        ...(system ? ([{ role: "system", content: system }] as OpenRouterMessage[]) : []),
        { role: "user", content: prompt },
      ];
    }

    const reply = await openRouterChatCompletion({
      apiKey: openrouterApiKey,
      model,
      messages,
      temperature: body.temperature,
      maxTokens: body.maxTokens,
    });

    return new Response(JSON.stringify({ reply }), {
      headers: withCors({ "Content-Type": "application/json" }),
    });
  } catch (e) {
    const message = (e as any)?.message || "Unknown error";
    return new Response(JSON.stringify({ error: message }), {
      status: 400,
      headers: withCors({ "Content-Type": "application/json" }),
    });
  }
});
