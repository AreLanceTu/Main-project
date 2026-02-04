import { withCors } from "../_shared/cors.ts";
import { verifyFirebaseIdToken } from "../_shared/firebaseAuth.ts";
import { openRouterChatCompletion } from "../_shared/openrouter.ts";

// VS Code / TS tooling in this repo isn't configured with Deno types.
// The Supabase Edge runtime provides Deno at execution time.
declare const Deno: any;

type GenerateTitleBody = {
  category?: string;
  subcategory?: string;
  description?: string;
  keyword?: string;
  existingTitle?: string;
  tags?: string | string[];
  deliveryTimeDays?: number;
  revisions?: number;
  generateDescription?: boolean;
};

function stripHtmlToText(html: string): string {
  return String(html || "")
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function sanitizeTitle(title: string): string {
  let t = String(title || "").trim();

  // Remove surrounding quotes/backticks and collapse whitespace.
  t = t.replace(/^["'`]+|["'`]+$/g, "").replace(/\s+/g, " ").trim();

  // Remove common list prefixes (e.g., "1. ", "- ").
  t = t.replace(/^(?:\d+[\.)\-:]+\s+|[-*•]+\s+)/, "").trim();

  // Remove emoji/pictographs (best-effort).
  try {
    t = t.replace(/[\p{Extended_Pictographic}]/gu, "");
  } catch {
    // ignore if runtime doesn't support Unicode properties
  }

  // Disallow obvious pricing/currency symbols.
  t = t.replace(/[₹$€£]/g, "").trim();

  // Enforce max length.
  if (t.length > 100) t = t.slice(0, 100).trim();

  return t;
}

function looksInvalid(title: string): string | null {
  if (!title) return "Empty title";
  if (title.length > 100) return "Title too long";

  const lowered = title.toLowerCase();
  const banned = [
    "guaranteed",
    "best",
    "#1",
    "number one",
    "top rated",
    "cheapest",
    "lowest price",
    "100%",
  ];

  if (banned.some((w) => lowered.includes(w))) return "Title contains exaggerated claims";
  if (/[₹$€£]/.test(title)) return "Title contains pricing";

  return null;
}


async function callOpenRouter(params: {
  apiKey: string;
  model: string;
  category: string;
  description: string;
}): Promise<string> {
  const prompt = [
    "You write high-converting gig titles for a freelance marketplace.",
    "Generate 5 different title candidates for the gig.",
    "Output format:",
    "- Return ONLY the 5 titles, one per line.",
    "- No numbering, no bullets, no quotes, no extra text.",
    "Constraints for EACH title:",
    "- Max 100 characters.",
    "- No emojis.",
    "- No pricing or currency symbols.",
    "- No exaggerated claims (e.g., best, guaranteed, #1, 100%).",
    "- Prefer marketplace-style wording starting with 'I will'.",
    "Quality rules:",
    "- Be specific (deliverable + who/what it's for).",
    "- Use at least one concrete keyword from the description.",
    "- Avoid generic filler like 'professional', 'high quality', 'modern' unless essential.",
    "",
    `Category: ${params.category}`,
    `Service description: ${params.description}`,
  ].join("\n");

  return await openRouterChatCompletion({
    apiKey: params.apiKey,
    model: params.model,
    messages: [
      { role: "system", content: "You are an expert gig title generator." },
      { role: "user", content: prompt },
    ],
    temperature: 0.7,
    maxTokens: 160,
  });
}

function sanitizeHtmlDescription(html: string): string {
  let s = String(html || "").trim();
  if (!s) return "";

  // Remove scripts/styles/iframes and event handlers.
  s = s.replace(/<\s*script[^>]*>[\s\S]*?<\s*\/\s*script\s*>/gi, "");
  s = s.replace(/<\s*style[^>]*>[\s\S]*?<\s*\/\s*style\s*>/gi, "");
  s = s.replace(/<\s*(iframe|object|embed)[^>]*>[\s\S]*?<\s*\/\s*(iframe|object|embed)\s*>/gi, "");
  s = s.replace(/\s+on[a-z]+\s*=\s*"[^"]*"/gi, "");
  s = s.replace(/\s+on[a-z]+\s*=\s*'[^']*'/gi, "");
  s = s.replace(/\s+style\s*=\s*"[^"]*"/gi, "");
  s = s.replace(/\s+style\s*=\s*'[^']*'/gi, "");

  // Allow only a small set of tags.
  s = s.replace(/<\/?(?!p\b|ul\b|ol\b|li\b|strong\b|em\b|br\b)[a-z0-9-]+\b[^>]*>/gi, "");

  // Collapse whitespace.
  s = s.replace(/\s+/g, " ").trim();

  // Re-introduce some spacing for readability.
  s = s.replace(/\s*<\s*br\s*\/?\s*>\s*/gi, "<br/>");

  if (s.length > 4000) s = s.slice(0, 4000).trim();
  return s;
}

async function generateDescriptionHtml(params: {
  apiKey: string;
  model: string;
  title: string;
  category: string;
  context: string;
}): Promise<string> {
  const prompt = [
    "Write a gig description for a freelance marketplace.",
    "Output format:",
    "- Return ONLY HTML.",
    "- Use only these tags: <p>, <ul>, <ol>, <li>, <strong>, <em>, <br>.",
    "- No markdown.",
    "Constraints:",
    "- 120 to 220 words.",
    "- No emojis.",
    "- No pricing/currency symbols.",
    "- No exaggerated claims (best, guaranteed, #1, 100%).",
    "Content guidance:",
    "- 1 short intro paragraph.",
    "- Bullet list of what's included.",
    "- Bullet list of what you need from the buyer (requirements).",
    "",
    `Gig title: ${params.title}`,
    `Category: ${params.category}`,
    `Context: ${params.context}`,
  ].join("\n");

  const raw = await openRouterChatCompletion({
    apiKey: params.apiKey,
    model: params.model,
    messages: [
      { role: "system", content: "You are an expert gig description writer." },
      { role: "user", content: prompt },
    ],
    temperature: 0.6,
    maxTokens: 380,
  });

  return sanitizeHtmlDescription(raw);
}

function splitCandidateLines(text: string): string[] {
  return String(text || "")
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
}

function tokenizeKeywords(value: string): string[] {
  const raw = String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  const stop = new Set([
    "i",
    "will",
    "the",
    "a",
    "an",
    "and",
    "or",
    "for",
    "to",
    "of",
    "in",
    "on",
    "with",
    "your",
    "you",
    "my",
    "is",
    "are",
    "be",
    "by",
    "from",
    "this",
    "that",
    "it",
  ]);

  return raw
    .split(" ")
    .map((w) => w.trim())
    .filter((w) => w.length >= 4 && !stop.has(w));
}

function scoreTitle(title: string, preferredKeywords: string[]): number {
  const t = title.toLowerCase();
  let score = 0;

  if (t.startsWith("i will")) score += 3;
  if (title.length >= 45 && title.length <= 75) score += 2;
  if (title.length >= 30 && title.length < 45) score += 1;

  const matches = preferredKeywords.reduce((acc, kw) => (t.includes(kw) ? acc + 1 : acc), 0);
  score += Math.min(matches, 4);

  // Penalize generic fluff.
  const fluff = ["professional", "high quality", "top", "best", "modern", "amazing"];
  if (fluff.some((w) => t.includes(w))) score -= 2;

  return score;
}

let cachedGeminiModel: string | null = null;

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
    const openrouterApiKey = Deno.env.get("OPENROUTER_API_KEY");
    const openrouterModel = String(Deno.env.get("OPENROUTER_MODEL") || "openai/gpt-4o-mini").trim();

    if (!firebaseProjectId) throw new Error("Missing FIREBASE_PROJECT_ID");
    if (!openrouterApiKey) throw new Error("Missing OPENROUTER_API_KEY");

    // Keep consistent with the rest of the app: Firebase auth required.
    const token = req.headers.get("x-firebase-token") || req.headers.get("authorization");
    await verifyFirebaseIdToken(token, firebaseProjectId);

    const body = (await req.json().catch(() => null)) as GenerateTitleBody | null;
    if (!body) throw new Error("Invalid JSON body");

    const category = String(body.category || "").trim();
    const description = stripHtmlToText(String(body.description || ""));
    const keyword = stripHtmlToText(String(body.keyword || "")).trim();
    const subcategory = String(body.subcategory || "").trim();
    const existingTitle = sanitizeTitle(String(body.existingTitle || ""));
    const wantDescription = Boolean(body.generateDescription);

    const rawTags = Array.isArray(body.tags) ? body.tags.join(",") : String(body.tags || "");
    const tags = rawTags
      .split(",")
      .map((t) => String(t).trim())
      .filter(Boolean)
      .slice(0, 8);

    if (!category) {
      return new Response(JSON.stringify({ error: "Missing category" }), {
        status: 400,
        headers: withCors({ "Content-Type": "application/json" }),
      });
    }

    if (!description && !keyword) {
      return new Response(JSON.stringify({ error: "Missing description or keyword" }), {
        status: 400,
        headers: withCors({ "Content-Type": "application/json" }),
      });
    }

    const contextHeaderLines: string[] = [];
    if (keyword) contextHeaderLines.push(`Seed keyword: ${keyword}`);
    if (existingTitle) contextHeaderLines.push(`Current title draft: ${existingTitle}`);
    if (subcategory) contextHeaderLines.push(`Subcategory: ${subcategory}`);
    if (tags.length) contextHeaderLines.push(`Tags: ${tags.join(", ")}`);
    if (typeof body.deliveryTimeDays === "number" && Number.isFinite(body.deliveryTimeDays)) {
      contextHeaderLines.push(`Delivery: ${Math.max(1, Math.round(body.deliveryTimeDays))} days`);
    }
    if (typeof body.revisions === "number" && Number.isFinite(body.revisions)) {
      contextHeaderLines.push(`Revisions: ${Math.max(0, Math.round(body.revisions))}`);
    }

    const baseDescription = description || keyword;

    const stitchedDescription =
      contextHeaderLines.length > 0
        ? `${contextHeaderLines.join("\n")}\n\n${baseDescription}`
        : baseDescription;

    const raw = await callOpenRouter({
      apiKey: String(openrouterApiKey),
      model: openrouterModel,
      category,
      description: stitchedDescription,
    });

    const preferredKeywords = [
      ...tokenizeKeywords(keyword),
      ...tokenizeKeywords(existingTitle),
      ...tokenizeKeywords(category),
      ...tokenizeKeywords(subcategory),
      ...tags.flatMap(tokenizeKeywords),
      ...tokenizeKeywords(baseDescription).slice(0, 12),
    ];

    const candidates = splitCandidateLines(raw)
      .map(sanitizeTitle)
      .map((t) => t.trim())
      .filter(Boolean);

    const unique = Array.from(new Set(candidates));
    const valid = unique.filter((t) => !looksInvalid(t));
    const best = valid.sort((a, b) => scoreTitle(b, preferredKeywords) - scoreTitle(a, preferredKeywords))[0];

    const title = best || sanitizeTitle(raw);

    const invalid = looksInvalid(title);
    if (invalid) {
      return new Response(JSON.stringify({ error: invalid }), {
        status: 422,
        headers: withCors({ "Content-Type": "application/json" }),
      });
    }

    let descriptionHtml = "";
    if (wantDescription) {
      try {
        descriptionHtml = await generateDescriptionHtml({
          apiKey: String(openrouterApiKey),
          model: openrouterModel,
          title,
          category,
          context: stitchedDescription,
        });
      } catch {
        // If description generation fails, still return the title.
        descriptionHtml = "";
      }
    }

    return new Response(JSON.stringify({ title, descriptionHtml }), {
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
