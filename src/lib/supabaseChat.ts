import { getFirebaseIdToken, getFunctionsBaseUrl } from "@/lib/functionsClient";

export type SupabaseChatListItem = {
  chatId: string;
  participants: string[];
  lastMessage: string;
  lastUpdated: Date | null;
  unreadCount: Record<string, number>;
};

export type SupabaseChatMessage = {
  id: string;
  senderId: string;
  receiverId: string;
  text: string;
  createdAt: Date | null;
  read: boolean;
};

async function fetchJson(url: string, init: RequestInit): Promise<any> {
  const res = await fetch(url, init);

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

function toDate(value: any): Date | null {
  if (!value) return null;
  const d = new Date(String(value));
  return Number.isFinite(d.getTime()) ? d : null;
}

export async function supabaseChatList(limit = 30): Promise<SupabaseChatListItem[]> {
  const token = await getFirebaseIdToken();
  const url = new URL(`${getFunctionsBaseUrl()}/chat-list`);
  url.searchParams.set("limit", String(limit));

  const data = await fetchJson(url.toString(), {
    method: "GET",
    headers: {
      "x-firebase-token": token,
    },
  });

  const chats = Array.isArray(data?.chats) ? data.chats : [];
  return chats.map((c: any) => ({
    chatId: String(c.chatId || ""),
    participants: Array.isArray(c.participants) ? c.participants.map(String) : [],
    lastMessage: String(c.lastMessage || ""),
    lastUpdated: toDate(c.lastUpdatedISO),
    unreadCount: c.unreadCount && typeof c.unreadCount === "object" ? c.unreadCount : {},
  })).filter((c: SupabaseChatListItem) => Boolean(c.chatId));
}

export async function supabaseChatStart(otherUid: string): Promise<{ chatId: string; participants: string[] }> {
  const token = await getFirebaseIdToken();
  const data = await fetchJson(`${getFunctionsBaseUrl()}/chat-start`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-firebase-token": token,
    },
    body: JSON.stringify({ otherUid }),
  });

  return {
    chatId: String(data?.chatId || ""),
    participants: Array.isArray(data?.participants) ? data.participants.map(String) : [],
  };
}

export async function supabaseChatMessages(chatId: string, limit = 200): Promise<SupabaseChatMessage[]> {
  const token = await getFirebaseIdToken();
  const url = new URL(`${getFunctionsBaseUrl()}/chat-messages`);
  url.searchParams.set("chatId", chatId);
  url.searchParams.set("limit", String(limit));

  const data = await fetchJson(url.toString(), {
    method: "GET",
    headers: {
      "x-firebase-token": token,
    },
  });

  const messages = Array.isArray(data?.messages) ? data.messages : [];
  return messages.map((m: any) => ({
    id: String(m.id || ""),
    senderId: String(m.senderId || ""),
    receiverId: String(m.receiverId || ""),
    text: String(m.text || ""),
    createdAt: toDate(m.createdAtISO),
    read: Boolean(m.read),
  })).filter((m: SupabaseChatMessage) => Boolean(m.id));
}

export async function supabaseChatSend(otherUid: string, text: string): Promise<SupabaseChatMessage> {
  const token = await getFirebaseIdToken();
  const data = await fetchJson(`${getFunctionsBaseUrl()}/chat-send`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-firebase-token": token,
    },
    body: JSON.stringify({ otherUid, text }),
  });

  const m = data?.message || {};
  return {
    id: String(m.id || ""),
    senderId: String(m.senderId || ""),
    receiverId: String(m.receiverId || ""),
    text: String(m.text || ""),
    createdAt: toDate(m.createdAtISO),
    read: Boolean(m.read),
  };
}
