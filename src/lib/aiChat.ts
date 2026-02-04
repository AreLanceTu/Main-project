import { getFirebaseIdToken, getFunctionsBaseUrl } from "@/lib/functionsClient";

export type AiChatMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

export async function aiChat(params: {
  messages?: AiChatMessage[];
  prompt?: string;
  system?: string;
}): Promise<string> {
  const token = await getFirebaseIdToken();

  const res = await fetch(`${getFunctionsBaseUrl()}/ai-chat`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-firebase-token": token,
    },
    body: JSON.stringify({
      messages: params.messages,
      prompt: params.prompt,
      system: params.system,
    }),
  });

  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(String(json?.error || "AI chat failed"));
  }

  const reply = String(json?.reply || "").trim();
  if (!reply) throw new Error("AI did not return a reply");
  return reply;
}
