import { useMemo } from "react";
import { cn } from "@/lib/utils";

import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";

function initials(name) {
  const s = String(name || "").trim();
  if (!s) return "?";
  const parts = s.split(/\s+/).slice(0, 2);
  return parts.map((p) => p[0]?.toUpperCase()).join("");
}

export default function ChatList({
  chats,
  profilesByUid,
  currentUid,
  activeChatId,
  onSelectChat,
  query,
  className,
}) {
  const formatStamp = (ts) => {
    const d = ts?.toDate ? ts.toDate() : ts instanceof Date ? ts : null;
    if (!d) return "";

    const diffMs = Date.now() - d.getTime();
    const diffMin = Math.floor(diffMs / 60000);
    if (diffMin < 1) return "Now";
    if (diffMin < 60) return `${diffMin}m`;
    const diffHr = Math.floor(diffMin / 60);
    if (diffHr < 24) return `${diffHr}h`;
    const diffDay = Math.floor(diffHr / 24);
    if (diffDay < 7) return `${diffDay}d`;
    return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
  };

  const rows = useMemo(() => {
    return (chats || []).map((c) => {
      const otherUid = (c.participants || []).find((p) => p !== currentUid) || null;
      const profile = otherUid ? profilesByUid?.[otherUid] : null;
      const username = profile?.username || profile?.usernameLower || "";
      const name = profile?.name || "";
      const title = username ? `@${username}` : name || otherUid || "Unknown";
      const photoURL = profile?.photoURL || "";
      const unread = Number(c.unreadCount?.[currentUid] || 0);

      return {
        chatId: c.chatId,
        otherUid,
        title,
        photoURL,
        lastMessage: c.lastMessage || "",
        lastUpdated: c.lastUpdated,
        unread,
      };
    });
  }, [chats, profilesByUid, currentUid]);

  const filtered = useMemo(() => {
    const term = String(query || "").trim().toLowerCase();
    if (!term) return rows;
    return rows.filter((r) => {
      const a = String(r.title || "").toLowerCase();
      const c = String(r.lastMessage || "").toLowerCase();
      return a.includes(term) || c.includes(term);
    });
  }, [rows, query]);

  return (
    <ScrollArea className={cn("h-full", className)}>
      <div className="divide-y divide-slate-200 dark:divide-slate-800">
        {filtered.length ? (
          filtered.map((r) => {
            const profile = r.otherUid ? profilesByUid?.[r.otherUid] : null;
            const online = typeof profile?.online === "boolean" ? profile.online : null;

            return (
              <button
                key={r.chatId}
                type="button"
                onClick={() => onSelectChat?.(r.chatId)}
                className={cn(
                  "w-full flex items-center gap-3 px-3 py-3 text-left transition-colors hover:bg-slate-50 dark:hover:bg-slate-900/60",
                  r.chatId === activeChatId && "bg-slate-100 dark:bg-slate-900",
                )}
              >
                <div className="relative">
                  <Avatar className="h-9 w-9">
                    <AvatarImage src={r.photoURL} alt={r.title} />
                    <AvatarFallback>{initials(r.title)}</AvatarFallback>
                  </Avatar>
                  <span
                    className={cn(
                      "absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full ring-2 ring-white dark:ring-slate-950",
                      online === true
                        ? "bg-emerald-500"
                        : online === false
                          ? "bg-slate-400 dark:bg-slate-500"
                          : "bg-slate-300 dark:bg-slate-600",
                    )}
                    aria-hidden="true"
                  />
                </div>

                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <div className="truncate font-medium text-slate-900 dark:text-slate-100">{r.title}</div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <div className="text-[11px] text-slate-500 dark:text-slate-400">{formatStamp(r.lastUpdated)}</div>
                      {r.unread > 0 ? (
                        <Badge
                          variant="default"
                          className="shrink-0 rounded-full bg-emerald-600 px-2 text-white"
                        >
                          {r.unread}
                        </Badge>
                      ) : null}
                    </div>
                  </div>
                  <div className="mt-1 truncate text-xs text-slate-500 dark:text-slate-400">{r.lastMessage || " "}</div>
                </div>
              </button>
            );
          })
        ) : (
          <div className="p-4 text-sm text-slate-500 dark:text-slate-400">
            {String(query || "").trim() ? "No results." : "No conversations yet."}
          </div>
        )}
      </div>
    </ScrollArea>
  );
}
