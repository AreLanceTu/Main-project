import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";

import {
  collection,
  doc,
  documentId,
  getDoc,
  getDocs,
  limit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  startAt,
  updateDoc,
  endAt,
  where,
  writeBatch,
} from "firebase/firestore";

import { db } from "@/firebase";
import {
  chatIdForUsers,
  ensureChatExists,
  hideChatForUser,
  purgeChatForEveryone,
  sendChatMessage,
} from "@/lib/chat";
import { normalizeUsername } from "@/lib/userProfile";
import { supabaseChatList, supabaseChatMessages, supabaseChatSend, supabaseChatStart } from "@/lib/supabaseChat";
import { subscribePresence } from "@/lib/presence";

import { useIsMobile } from "@/hooks/use-mobile";

import ChatList from "@/components/messages/ChatList";
import ChatWindow from "@/components/messages/ChatWindow";

import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Search, UserRoundSearch } from "lucide-react";

function initials(name) {
  const s = String(name || "").trim();
  if (!s) return "?";
  const parts = s.split(/\s+/).slice(0, 2);
  return parts.map((p) => p[0]?.toUpperCase()).join("");
}

/**
 * MessagesPage: two-panel real-time chat.
 * - Left: conversation list (chats)
 * - Right: active chat messages
 *
 * Notes:
 * - One-to-one chats use deterministic chatId from the two UIDs.
 * - Real-time updates via onSnapshot.
 * - Unread indicators backed by chats.unreadCount[uid] + messages.read.
 */
export default function MessagesPage({ currentUid }) {
  const useSupabaseChats = String(import.meta.env.VITE_CHAT_BACKEND || "").toLowerCase() === "supabase";

  const supabaseHiddenKey = currentUid ? `gigflow:hiddenChats:${currentUid}` : null;
  const [supabaseHiddenChats, setSupabaseHiddenChats] = useState(() => {
    if (!supabaseHiddenKey) return [];
    try {
      const raw = window.localStorage.getItem(supabaseHiddenKey);
      const parsed = raw ? JSON.parse(raw) : [];
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  });

  useEffect(() => {
    if (!supabaseHiddenKey) {
      setSupabaseHiddenChats([]);
      return;
    }
    try {
      const raw = window.localStorage.getItem(supabaseHiddenKey);
      const parsed = raw ? JSON.parse(raw) : [];
      setSupabaseHiddenChats(Array.isArray(parsed) ? parsed : []);
    } catch {
      setSupabaseHiddenChats([]);
    }
  }, [supabaseHiddenKey]);

  useEffect(() => {
    if (!supabaseHiddenKey) {
      setSupabaseHiddenChats([]);
      return;
    }
    try {
      window.localStorage.setItem(supabaseHiddenKey, JSON.stringify(supabaseHiddenChats));
    } catch {
      // ignore
    }
  }, [supabaseHiddenChats, supabaseHiddenKey]);

  const supabasePurgedKey = currentUid ? `gigflow:purgedChats:${currentUid}` : null;
  const [supabasePurgedChats, setSupabasePurgedChats] = useState(() => {
    if (!supabasePurgedKey) return {};
    try {
      const raw = window.localStorage.getItem(supabasePurgedKey);
      const parsed = raw ? JSON.parse(raw) : {};
      return parsed && typeof parsed === "object" ? parsed : {};
    } catch {
      return {};
    }
  });

  useEffect(() => {
    if (!supabasePurgedKey) {
      setSupabasePurgedChats({});
      return;
    }
    try {
      const raw = window.localStorage.getItem(supabasePurgedKey);
      const parsed = raw ? JSON.parse(raw) : {};
      setSupabasePurgedChats(parsed && typeof parsed === "object" ? parsed : {});
    } catch {
      setSupabasePurgedChats({});
    }
  }, [supabasePurgedKey]);

  useEffect(() => {
    if (!supabasePurgedKey) return;
    try {
      window.localStorage.setItem(supabasePurgedKey, JSON.stringify(supabasePurgedChats));
    } catch {
      // ignore
    }
  }, [supabasePurgedChats, supabasePurgedKey]);

  const isMobile = useIsMobile();
  const [mobileView, setMobileView] = useState("inbox"); // inbox | chat
  const [userSheetOpen, setUserSheetOpen] = useState(false);

  const [searchParams] = useSearchParams();
  const [chats, setChats] = useState([]);
  const [activeChatId, setActiveChatId] = useState(null);
  const [activeChat, setActiveChat] = useState(null);
  const [messages, setMessages] = useState([]);
  const [profilesByUid, setProfilesByUid] = useState({});
  const [sendingDisabled, setSendingDisabled] = useState(false);
  const [chatsError, setChatsError] = useState(null);
  const [messagesError, setMessagesError] = useState(null);

  const [conversationSearch, setConversationSearch] = useState("");
  const [userSearch, setUserSearch] = useState("");
  const [userResults, setUserResults] = useState([]);
  const [userSearchError, setUserSearchError] = useState(null);
  const [userSearching, setUserSearching] = useState(false);

  const [myUsername, setMyUsername] = useState(null);

  const unsubMessagesRef = useRef(null);

  // Keep my username visible (so you know what others can search).
  useEffect(() => {
    if (!currentUid) {
      setMyUsername(null);
      return undefined;
    }

    const unsub = onSnapshot(
      doc(db, "users", currentUid),
      (snap) => {
        const data = snap.data() || {};
        setMyUsername(data.username || data.usernameLower || null);
      },
      (err) => {
        console.error("Failed to load my profile", err);
        setMyUsername(null);
      },
    );

    return unsub;
  }, [currentUid]);

  // Search users (prefix match).
  // Firestore doesn't support substring contains; this uses prefix search via startAt/endAt.
  useEffect(() => {
    if (!currentUid) {
      setUserResults([]);
      setUserSearchError(null);
      return;
    }

    const rawTerm = userSearch.trim();
    if (rawTerm.length < 2) {
      setUserResults([]);
      setUserSearchError(null);
      return;
    }

    setUserSearching(true);
    setUserSearchError(null);

    const handle = setTimeout(async () => {
      try {
        const usersRef = collection(db, "users");
        const usernamePrefix = normalizeUsername(rawTerm);
        const namePrefix = rawTerm.toLowerCase();

        const queries = [];

        // Username search (supports input like "@akash" by normalizing).
        if (usernamePrefix.length >= 2) {
          queries.push(
            query(
              usersRef,
              orderBy("usernameLower"),
              startAt(usernamePrefix),
              endAt(`${usernamePrefix}\uf8ff`),
              limit(10),
            ),
          );
        }

        // Name search.
        if (namePrefix.length >= 2) {
          queries.push(
            query(
              usersRef,
              orderBy("nameLower"),
              startAt(namePrefix),
              endAt(`${namePrefix}\uf8ff`),
              limit(10),
            ),
          );
        }

        if (!queries.length) {
          setUserResults([]);
          setUserSearchError(null);
          return;
        }

        const settled = await Promise.allSettled(queries.map((q) => getDocs(q)));
        const snaps = settled
          .filter((r) => r.status === "fulfilled")
          .map((r) => r.value);

        const failures = settled
          .filter((r) => r.status === "rejected")
          .map((r) => r.reason);

        if (!snaps.length && failures.length) {
          throw failures[0];
        }

        const byUid = new Map();
        for (const s of snaps) {
          if (!s) continue;
          for (const d of s.docs) {
            const data = d.data() || {};
            byUid.set(d.id, {
              uid: d.id,
              name: data.name || d.id,
              username: data.username || data.usernameLower || "",
              role: data.role || "",
              photoURL: data.photoURL || "",
              isMe: d.id === currentUid,
            });
          }
        }

        const next = Array.from(byUid.values()).slice(0, 10);

        setUserResults(next);
        setUserSearchError(null);
      } catch (e) {
        console.error("User search failed", e);
        setUserResults([]);
        setUserSearchError(e);
      } finally {
        setUserSearching(false);
      }
    }, 300);

    return () => clearTimeout(handle);
  }, [currentUid, userSearch]);

  const startChatWith = async (otherUid) => {
    if (!currentUid || !otherUid) return;
    try {
      if (useSupabaseChats) {
        const started = await supabaseChatStart(otherUid);
        setActiveChatId(started.chatId);
        setSupabaseHiddenChats((prev) => prev.filter((id) => id !== started.chatId));
      } else {
        const { chatId } = await ensureChatExists(db, {
          clientUid: currentUid,
          freelancerUid: otherUid,
        });
        setActiveChatId(chatId);
      }

      if (isMobile) {
        setMobileView("chat");
        setUserSheetOpen(false);
      }
      setUserSearch("");
      setUserResults([]);
    } catch (e) {
      console.error("Failed to create/open chat", e);
      setUserSearchError(e);
    }
  };

  useEffect(() => {
    if (!isMobile) return;
    if (!activeChatId) setMobileView("inbox");
  }, [isMobile, activeChatId]);

  // If someone links to /client-dashboard?with=<uid>, auto-open (and create) the chat.
  useEffect(() => {
    if (!currentUid) return;
    const withUid = searchParams.get("with");
    if (!withUid) return;

    const chatId = chatIdForUsers(currentUid, withUid);
    if (!chatId) return;

    (async () => {
      try {
        if (useSupabaseChats) {
          const started = await supabaseChatStart(withUid);
          setActiveChatId(started.chatId);
        } else {
          // We don't know role here; it's still a 1:1 chat.
          await ensureChatExists(db, { clientUid: currentUid, freelancerUid: withUid });
          setActiveChatId(chatId);
        }

        if (isMobile) {
          setMobileView("chat");
        }
      } catch (e) {
        console.error("Failed to start chat", e);
      }
    })();
  }, [currentUid, searchParams, useSupabaseChats, isMobile]);

  // Listen to chats where the logged-in user is a participant.
  useEffect(() => {
    if (!currentUid) {
      setChats([]);
      setChatsError(null);
      return undefined;
    }

    if (useSupabaseChats) {
      let cancelled = false;
      let interval = null;

      const load = async () => {
        try {
          const list = await supabaseChatList(30);
          if (cancelled) return;

          const next = list
            .map((c) => ({
              chatId: c.chatId,
              participants: c.participants,
              lastMessage: c.lastMessage,
              lastUpdated: c.lastUpdated,
              unreadCount: c.unreadCount,
            }))
            .filter((c) => !supabaseHiddenChats.includes(c.chatId));

          setChats(next);
          setChatsError(null);

          setActiveChatId((prev) => {
            if (!prev) return next[0]?.chatId ?? null;
            if (next.some((x) => x.chatId === prev)) return prev;
            return next[0]?.chatId ?? null;
          });
        } catch (e) {
          if (cancelled) return;
          console.error("Failed to load chats (Supabase)", e);
          setChats([]);
          setChatsError(e);
        }
      };

      load();
      interval = window.setInterval(load, 3000);

      return () => {
        cancelled = true;
        if (interval) window.clearInterval(interval);
      };
    }

    const q = query(
      collection(db, "chats"),
      where("participants", "array-contains", currentUid),
      orderBy("lastUpdated", "desc"),
    );

    const unsub = onSnapshot(
      q,
      (snap) => {
      const next = snap.docs
        .map((d) => {
          const data = d.data({ serverTimestamps: "estimate" }) || {};
          return {
            chatId: d.id,
            participants: data.participants || [],
            lastMessage: data.lastMessage || "",
            lastUpdated: data.lastUpdated || null,
            unreadCount: data.unreadCount || {},
            hiddenFor: data.hiddenFor || {},
            purgedAt: data.purgedAt || null,
            purgedBy: data.purgedBy || null,
          };
        })
        .filter((c) => !Boolean(c.hiddenFor?.[currentUid]));

      setChats(next);
      setChatsError(null);

      // Keep current selection if possible; otherwise pick the first chat.
      setActiveChatId((prev) => {
        if (!prev) return next[0]?.chatId ?? null;
        if (next.some((c) => c.chatId === prev)) return prev;
        return next[0]?.chatId ?? null;
      });
      },
      (err) => {
        console.error("Chats onSnapshot error", err);
        setChats([]);
        setChatsError(err);
      },
    );

    return unsub;
  }, [currentUid, useSupabaseChats, supabaseHiddenChats]);

  const onDeleteChat = async (chatId, scope = "me") => {
    if (!currentUid || !chatId) return;
    try {
      if (scope === "everyone") {
        if (useSupabaseChats) {
          // Best-effort for Supabase mode (local-only): hide + purge for this user.
          setSupabaseHiddenChats((prev) => (prev.includes(chatId) ? prev : [...prev, chatId]));
          setSupabasePurgedChats((prev) => ({ ...prev, [chatId]: Date.now() }));
          setChats((prev) => (prev || []).filter((c) => c.chatId !== chatId));
        } else {
          const participants = activeChat?.participants || [];
          await purgeChatForEveryone(db, { chatId, byUid: currentUid, participants });
        }
      } else {
        if (useSupabaseChats) {
          setSupabaseHiddenChats((prev) => (prev.includes(chatId) ? prev : [...prev, chatId]));
          setChats((prev) => (prev || []).filter((c) => c.chatId !== chatId));
        } else {
          await hideChatForUser(db, { chatId, uid: currentUid });
        }
      }

      if (activeChatId === chatId) {
        const remaining = (chats || []).filter((c) => c.chatId !== chatId);
        setActiveChatId(remaining[0]?.chatId ?? null);
        if (isMobile) setMobileView("inbox");
      }
    } catch (e) {
      console.error("Failed to delete chat", e);
    }
  };

  // Maintain activeChat object.
  useEffect(() => {
    const found = chats.find((c) => c.chatId === activeChatId) || null;
    setActiveChat(found);
  }, [chats, activeChatId]);

  // Fetch user profiles for chat counterparts (cached).
  useEffect(() => {
    if (!currentUid) {
      setProfilesByUid({});
      return undefined;
    }

    const otherUids = Array.from(
      new Set(
        (chats || [])
          .map((c) => (c.participants || []).find((p) => p !== currentUid))
          .filter(Boolean),
      ),
    );

    if (!otherUids.length) return undefined;

    const toMs = (ts) => {
      try {
        const d = ts?.toDate ? ts.toDate() : ts instanceof Date ? ts : ts ? new Date(ts) : null;
        return d && !Number.isNaN(d.getTime()) ? d.getTime() : null;
      } catch {
        return null;
      }
    };

    const computeOnline = (data) => {
      const onlineFlag = typeof data?.online === "boolean" ? data.online : null;
      const lastSeen = data?.lastSeen || null;
      const lastSeenMs = toMs(lastSeen);
      const fresh = typeof lastSeenMs === "number" ? Date.now() - lastSeenMs < 70_000 : null;

      if (onlineFlag === true) return fresh === null ? true : fresh;
      if (onlineFlag === false) return false;
      if (fresh === true) return true;
      if (fresh === false) return false;
      return null;
    };

    const chunk = (arr, size) => {
      const out = [];
      for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
      return out;
    };

    const unsubs = chunk(otherUids, 10).map((uids) => {
      const q = query(collection(db, "users"), where(documentId(), "in", uids));
      return onSnapshot(
        q,
        (snap) => {
          setProfilesByUid((prev) => {
            const next = { ...prev };
            snap.docs.forEach((s) => {
              const data = s.data() || {};
              next[s.id] = {
                uid: s.id,
                name: data.name || "",
                username: data.username || data.usernameLower || "",
                role: data.role || "",
                photoURL: data.photoURL || "",
                online: computeOnline(data),
                lastSeen: data.lastSeen || null,
              };
            });
            return next;
          });
        },
        (err) => {
          console.error("Failed to subscribe user profiles", err);
        },
      );
    });

    return () => {
      unsubs.forEach((u) => {
        try {
          u();
        } catch {
          // ignore
        }
      });
    };
  }, [chats, currentUid]);

  // Listen to messages for the active chat.
  useEffect(() => {
    // Cleanup previous listener.
    if (unsubMessagesRef.current) {
      unsubMessagesRef.current();
      unsubMessagesRef.current = null;
    }

    if (!currentUid || !activeChatId) {
      setMessages([]);
      setMessagesError(null);
      return;
    }

    if (useSupabaseChats) {
      let cancelled = false;
      let interval = null;

      const load = async () => {
        try {
          const msgs = await supabaseChatMessages(activeChatId, 200);
          if (cancelled) return;

          const cutoff = supabasePurgedChats?.[activeChatId];
          const cutoffMs = typeof cutoff === "number" ? cutoff : null;

          const mapped = msgs.map((m) => ({
            id: m.id,
            senderId: m.senderId,
            receiverId: m.receiverId,
            text: m.text,
            createdAt: m.createdAt,
            read: m.read,
            deleted: Boolean(m.deleted),
            deletedAt: m.deletedAt || null,
            deletedBy: m.deletedBy || null,
          }));

          setMessages(
            cutoffMs
              ? mapped.filter((m) => {
                  const raw = m?.createdAt;
                  const d = raw?.toDate ? raw.toDate() : raw instanceof Date ? raw : raw ? new Date(raw) : null;
                  const ms = d && !Number.isNaN(d.getTime()) ? d.getTime() : 0;
                  return ms >= cutoffMs;
                })
              : mapped,
          );
          setMessagesError(null);
        } catch (e) {
          if (cancelled) return;
          console.error("Failed to load messages (Supabase)", e);
          setMessages([]);
          setMessagesError(e);
        }
      };

      load();
      interval = window.setInterval(load, 2500);

      return () => {
        cancelled = true;
        if (interval) window.clearInterval(interval);
      };
    }

    const messagesRef = collection(db, "chats", activeChatId, "messages");
    const q = query(messagesRef, orderBy("createdAt", "asc"));

    const unsub = onSnapshot(
      q,
      (snap) => {
      const next = snap.docs.map((d) => {
        const data = d.data({ serverTimestamps: "estimate" }) || {};
        return {
          id: d.id,
          senderId: data.senderId,
          receiverId: data.receiverId,
          text: data.text || "",
          createdAt: data.createdAt || null,
          read: Boolean(data.read),
          deleted: Boolean(data.deleted),
          deletedAt: data.deletedAt || null,
          deletedBy: data.deletedBy || null,
        };
      });

      const rawCutoff = activeChat?.purgedAt;
      const cutoffDate = rawCutoff?.toDate
        ? rawCutoff.toDate()
        : rawCutoff instanceof Date
          ? rawCutoff
          : rawCutoff
            ? new Date(rawCutoff)
            : null;
      const cutoffMs = cutoffDate && !Number.isNaN(cutoffDate.getTime()) ? cutoffDate.getTime() : null;

      setMessages(
        cutoffMs
          ? next.filter((m) => {
              const raw = m?.createdAt;
              const d = raw?.toDate ? raw.toDate() : raw instanceof Date ? raw : raw ? new Date(raw) : null;
              const ms = d && !Number.isNaN(d.getTime()) ? d.getTime() : 0;
              return ms >= cutoffMs;
            })
          : next,
      );
      setMessagesError(null);
      },
      (err) => {
        console.error("Messages onSnapshot error", err);
        setMessages([]);
        setMessagesError(err);
      },
    );

    unsubMessagesRef.current = unsub;

    return () => {
      if (unsubMessagesRef.current) {
        unsubMessagesRef.current();
        unsubMessagesRef.current = null;
      }
    };
  }, [currentUid, activeChatId, useSupabaseChats, activeChat?.purgedAt, supabasePurgedChats]);

  // Subscribe to RTDB presence for chat counterparts (instant online/offline).
  useEffect(() => {
    if (!currentUid) return undefined;

    const otherUids = Array.from(
      new Set(
        (chats || [])
          .map((c) => (c.participants || []).find((p) => p !== currentUid))
          .filter(Boolean),
      ),
    );

    if (!otherUids.length) return undefined;

    const unsubs = otherUids.map((uid) =>
      subscribePresence(uid, (p) => {
        setProfilesByUid((prev) => {
          const existing = prev?.[uid] || { uid };
          const online = p?.state === "online" ? true : p?.state === "offline" ? false : existing.online;
          return {
            ...prev,
            [uid]: {
              ...existing,
              online,
              presenceLastChanged: p?.last_changed ?? null,
            },
          };
        });
      }),
    );

    return () => {
      unsubs.forEach((u) => {
        try {
          u();
        } catch {
          // ignore
        }
      });
    };
  }, [chats, currentUid]);

  // Mark unread messages as read when opening a chat.
  useEffect(() => {
    if (!currentUid || !activeChatId) return;

    if (useSupabaseChats) {
      // v1: unread tracking isn't implemented in Supabase tables.
      return;
    }

    (async () => {
      try {
        const unreadQuery = query(
          collection(db, "chats", activeChatId, "messages"),
          where("receiverId", "==", currentUid),
          where("read", "==", false),
        );
        const unreadSnap = await getDocs(unreadQuery);
        if (unreadSnap.empty) return;

        const batch = writeBatch(db);
        unreadSnap.docs.forEach((d) => {
          batch.update(d.ref, { read: true });
        });
        // Also reset the chat unreadCount for this user.
        batch.update(doc(db, "chats", activeChatId), { [`unreadCount.${currentUid}`]: 0 });
        await batch.commit();
      } catch (e) {
        console.error("Failed to mark messages read", e);
      }
    })();
  }, [currentUid, activeChatId, useSupabaseChats]);

  const otherUid = useMemo(() => {
    return (activeChat?.participants || []).find((p) => p !== currentUid) || null;
  }, [activeChat, currentUid]);

  const otherProfile = otherUid ? profilesByUid[otherUid] : null;

  const onSend = async (text) => {
    if (!currentUid || !activeChatId || !otherUid) return;
    try {
      setSendingDisabled(true);
      if (useSupabaseChats) {
        await supabaseChatSend(otherUid, text);
      } else {
        await sendChatMessage(db, {
          chatId: activeChatId,
          senderId: currentUid,
          receiverId: otherUid,
          text,
        });
      }
    } catch (e) {
      console.error("Failed to send message", e);
    } finally {
      setSendingDisabled(false);
    }
  };

  const onUnsendMessage = async (message) => {
    if (!currentUid || !activeChatId) return;
    if (!message?.id) return;
    if (message?.senderId !== currentUid) return;

    if (useSupabaseChats) {
      alert("Unsend is not implemented for Supabase chat backend yet.");
      return;
    }

    const ok = window.confirm("Unsend this message for everyone?");
    if (!ok) return;

    try {
      const msgRef = doc(db, "chats", activeChatId, "messages", message.id);
      await updateDoc(msgRef, {
        deleted: true,
        deletedAt: serverTimestamp(),
        deletedBy: currentUid,
        text: "",
      });

      // If this was the latest message in the chat, update the chat preview.
      const last = (messages || []).slice(-1)[0];
      if (last?.id === message.id) {
        await updateDoc(doc(db, "chats", activeChatId), {
          lastMessage: "(message unsent)",
        });
      }
    } catch (e) {
      console.error("Failed to unsend message", e);
      alert(e?.message || "Failed to unsend message");
    }
  };

  const handleSelectChat = (chatId) => {
    setActiveChatId(chatId);
    if (isMobile) setMobileView("chat");
  };

  const userSearchBody = (
    <div className="h-full min-h-0 rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden flex flex-col dark:border-slate-800 dark:bg-slate-950">
      <div className="border-b border-slate-200 bg-white/95 p-4 pb-3 dark:border-slate-800 dark:bg-slate-950/90">
        <div className="text-sm font-semibold text-slate-900 dark:text-slate-100">Search users</div>
        <div className="mt-0.5 text-[11px] text-slate-500 dark:text-slate-400">Start a new conversation</div>

        <div className="relative mt-3">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400 dark:text-slate-500" />
          <Input
            value={userSearch}
            onChange={(e) => setUserSearch(e.target.value)}
            placeholder="Search by @username or name…"
            className="h-10 pl-9 border-slate-200 bg-white placeholder:text-slate-400 dark:border-slate-800 dark:bg-slate-950 dark:placeholder:text-slate-500"
          />
        </div>

        {userSearchError ? (
          <div className="mt-2 text-xs text-destructive">{String(userSearchError?.message || userSearchError)}</div>
        ) : null}
        {userSearching ? (
          <div className="mt-2 text-xs text-slate-500 dark:text-slate-400">Searching…</div>
        ) : null}
      </div>

      <div className="flex-1 min-h-0">
        {userResults.length ? (
          <ScrollArea className="h-full">
            <div className="divide-y divide-slate-200 dark:divide-slate-800">
              {userResults.map((u) => (
                <div
                  key={u.uid}
                  className="flex items-center justify-between gap-3 p-3 hover:bg-slate-50 dark:hover:bg-slate-900/60"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <Avatar className="h-9 w-9">
                      <AvatarImage src={u.photoURL} alt={u.name} />
                      <AvatarFallback>{initials(u.name)}</AvatarFallback>
                    </Avatar>
                    <div className="min-w-0">
                      <div className="text-sm font-medium truncate text-slate-900 dark:text-slate-100">
                        {u.username ? `@${u.username}` : u.name}
                      </div>
                      <div className="text-xs text-slate-500 dark:text-slate-400 truncate">
                        {u.username ? u.name : u.uid}
                        {u.role ? ` · ${u.role}` : ""}
                      </div>
                    </div>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    className="border-slate-200 dark:border-slate-800"
                    disabled={Boolean(u.isMe)}
                    onClick={() => startChatWith(u.uid)}
                  >
                    {u.isMe ? "You" : "Message"}
                  </Button>
                </div>
              ))}
            </div>
          </ScrollArea>
        ) : (
          <div className="p-4 text-sm text-slate-500 dark:text-slate-400">
            {userSearch.trim().length >= 2 ? "No users found." : "Search to find users."}
          </div>
        )}
      </div>
    </div>
  );

  const errorBanner = (chatsError || messagesError) ? (
    <div className="space-y-2">
      {chatsError ? (
        <div className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-100">
          Unable to load chats: {String(chatsError?.message || chatsError)}
        </div>
      ) : null}
      {messagesError ? (
        <div className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-100">
          Unable to load messages: {String(messagesError?.message || messagesError)}
        </div>
      ) : null}
    </div>
  ) : null;

  const leftPanel = (
    <div className="min-w-0 min-h-0">
      <div className="h-full min-h-0 rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden flex flex-col dark:border-slate-800 dark:bg-slate-950">
        <div className="sticky top-0 z-10 border-b border-slate-200 bg-white/95 p-4 pb-3 backdrop-blur supports-[backdrop-filter]:bg-white/80 dark:border-slate-800 dark:bg-slate-950/90 dark:supports-[backdrop-filter]:bg-slate-950/80">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="text-sm font-semibold leading-tight">Inbox</div>
              <div className="mt-0.5 text-[11px] text-slate-500 dark:text-slate-400 truncate">
                Signed in as {myUsername ? `@${myUsername}` : "(username not set)"}
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <div className="text-[11px] text-slate-500 dark:text-slate-400">{chats?.length || 0}</div>
              {isMobile ? (
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  className="h-9 w-9 border-slate-200 dark:border-slate-800"
                  onClick={() => setUserSheetOpen(true)}
                  aria-label="Search users"
                >
                  <UserRoundSearch className="h-4 w-4" />
                </Button>
              ) : null}
            </div>
          </div>

          <div className="relative mt-3">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400 dark:text-slate-500" />
            <Input
              value={conversationSearch}
              onChange={(e) => setConversationSearch(e.target.value)}
              placeholder="Search conversations…"
              className="h-10 pl-9 border-slate-200 bg-white placeholder:text-slate-400 dark:border-slate-800 dark:bg-slate-950 dark:placeholder:text-slate-500"
            />
          </div>
        </div>

        <div className="flex-1 min-h-0">
          <ChatList
            chats={chats}
            profilesByUid={profilesByUid}
            currentUid={currentUid}
            activeChatId={activeChatId}
            onSelectChat={handleSelectChat}
            query={conversationSearch}
            className="h-full"
          />
        </div>
      </div>
    </div>
  );

  const chatPanel = (
    <div className="min-w-0 min-h-0">
      <ChatWindow
        currentUid={currentUid}
        activeChat={activeChat}
        otherProfile={otherProfile}
        messages={messages}
        onSend={onSend}
        onUnsendMessage={onUnsendMessage}
        sendingDisabled={sendingDisabled}
        onBack={isMobile ? () => setMobileView("inbox") : undefined}
        onOpenUserSearch={isMobile ? () => setUserSheetOpen(true) : undefined}
        onDeleteChat={onDeleteChat}
      />
    </div>
  );

  return (
    <div className="flex h-full min-h-0 flex-col gap-3 text-slate-900 dark:text-slate-100">
      <Sheet open={userSheetOpen} onOpenChange={setUserSheetOpen}>
        <SheetContent side="bottom" className="p-0 h-[85vh] rounded-t-2xl">
          <div className="p-4 pb-0">
            <SheetHeader className="text-left">
              <SheetTitle>Search users</SheetTitle>
              <SheetDescription>Start a new conversation</SheetDescription>
            </SheetHeader>
          </div>
          <div className="h-[calc(85vh-72px)] p-3 pt-2">{userSearchBody}</div>
        </SheetContent>
      </Sheet>

      {errorBanner}

      {isMobile ? (
        <div className="flex-1 min-h-0">
          {mobileView === "inbox" ? leftPanel : chatPanel}
        </div>
      ) : (
        <div className="grid flex-1 min-h-0 grid-cols-1 gap-3 md:grid-cols-[minmax(280px,25%)_minmax(0,50%)_minmax(280px,25%)]">
          {leftPanel}
          {chatPanel}
          <div className="min-w-0 min-h-0">{userSearchBody}</div>
        </div>
      )}
    </div>
  );
}
