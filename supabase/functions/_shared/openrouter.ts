// Shared helper for Supabase Edge Functions (Deno runtime)
// Uses OpenRouter Chat Completions API.

declare const Deno: any;

type OpenRouterRole = "system" | "user" | "assistant";

export type OpenRouterMessage = {
  role: OpenRouterRole;
  content: string;
};

type OpenRouterChatCompletionParams = {
  apiKey: string;
  model: string;
  messages: OpenRouterMessage[];
  temperature?: number;
  maxTokens?: number;
};

function coerceNumber(value: unknown, fallback: number): number {
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? n : fallback;
}

export async function openRouterChatCompletion(params: OpenRouterChatCompletionParams): Promise<string> {
  const apiKey = String(params.apiKey || "").trim();
  if (!apiKey) throw new Error("Missing OPENROUTER_API_KEY");

  const model = String(params.model || "").trim();
  if (!model) throw new Error("Missing OpenRouter model");

  const messages = Array.isArray(params.messages) ? params.messages : [];
  if (!messages.length) throw new Error("Missing messages");

  const temperature = Math.max(0, Math.min(2, coerceNumber(params.temperature, 0.7)));
  const maxTokens = Math.max(1, Math.min(1024, Math.round(coerceNumber(params.maxTokens, 128))));

  const siteUrl = String(Deno?.env?.get?.("OPENROUTER_SITE_URL") || "").trim();
  const appName = String(Deno?.env?.get?.("OPENROUTER_APP_NAME") || "GigFlow").trim();

  const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
      ...(siteUrl ? { "HTTP-Referer": siteUrl } : {}),
      ...(appName ? { "X-Title": appName } : {}),
    },
    body: JSON.stringify({
      model,
      messages,
      temperature,
      max_tokens: maxTokens,
    }),
  });

  const json = await res.json().catch(() => ({} as any));
  if (!res.ok) {
    const msg = String(json?.error?.message || json?.message || "OpenRouter request failed");
    throw new Error(msg);
  }

  const content = json?.choices?.[0]?.message?.content;
  if (typeof content !== "string") {
    throw new Error("OpenRouter did not return message content");
  }

  return content;
}
