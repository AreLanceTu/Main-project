import { useEffect, useMemo, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { aiChat } from "@/lib/aiChat";

import { ArrowLeft, Languages, MoreVertical, Paperclip, Search, Star, Trash2 } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

import MessageInput from "@/components/messages/MessageInput";

function initials(name) {
  const s = String(name || "").trim();
  if (!s) return "?";
  const parts = s.split(/\s+/).slice(0, 2);
  return parts.map((p) => p[0]?.toUpperCase()).join("");
}

function formatTime(ts) {
  try {
    const d = ts?.toDate ? ts.toDate() : ts instanceof Date ? ts : ts ? new Date(ts) : null;
    if (!d || Number.isNaN(d.getTime())) return "";
    return d.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
  } catch {
    return "";
  }
}

function parseAttachmentSnippets(text) {
  const raw = String(text || "");

  // MessageInput inserts:
  // Attachment: <name>
  // <url>
  const re = /(^|\n)Attachment:\s*([^\n]+)\n(https?:\/\/\S+)/g;
  const attachments = [];
  let cleaned = raw;

  let match;
  while ((match = re.exec(raw)) !== null) {
    const name = String(match[2] || "attachment").trim();
    const url = String(match[3] || "").trim();
    if (!url) continue;
    attachments.push({ name, url });
  }

  if (attachments.length) {
    cleaned = cleaned.replace(re, "").trim();
  }

  return { text: cleaned, attachments };
}

function isLikelyImageUrl(url) {
  try {
    const pathname = new URL(url).pathname;
    return /\.(png|jpe?g|gif|webp|bmp|svg)$/i.test(pathname);
  } catch {
    return /\.(png|jpe?g|gif|webp|bmp|svg)(\?|#|$)/i.test(String(url || ""));
  }
}

export default function ChatWindow({
  currentUid,
  activeChat,
  otherProfile,
  messages,
  onSend,
  onUnsendMessage,
  sendingDisabled,
  onBack,
  onOpenUserSearch,
  onDeleteChat,
}) {
  const bottomRef = useRef(null);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteScope, setDeleteScope] = useState("me");
  const [translatedByMessageId, setTranslatedByMessageId] = useState({});
  const [translatingByMessageId, setTranslatingByMessageId] = useState({});

  const isEmpty = !activeChat?.chatId;

  const headerTitle = useMemo(() => {
    const name = otherProfile?.name;
    if (name) return name;
    const chatTitle = activeChat?.title;
    if (chatTitle) return chatTitle;
    const otherUid = (activeChat?.participants || []).find((p) => p !== currentUid);
    return otherUid || "Messages";
  }, [activeChat, currentUid, otherProfile]);

  const statusText = useMemo(() => {
    if (isEmpty) return "Select a conversation";
    if (typeof otherProfile?.online === "boolean") return otherProfile.online ? "Online" : "Offline";
    return "Active";
  }, [isEmpty, otherProfile]);

  const statusDotClass = useMemo(() => {
    if (isEmpty) return "bg-slate-300 dark:bg-slate-700";
    if (typeof otherProfile?.online === "boolean") {
      return otherProfile.online ? "bg-emerald-500" : "bg-slate-400 dark:bg-slate-600";
    }
    return "bg-slate-300 dark:bg-slate-600";
  }, [isEmpty, otherProfile]);

  useEffect(() => {
    if (isEmpty) return;
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [isEmpty, messages?.length, activeChat?.chatId]);

  const targetLanguage = useMemo(() => {
    try {
      return String(navigator?.language || "en").trim() || "en";
    } catch {
      return "en";
    }
  }, []);

  const translateMessage = async (messageId, text) => {
    const t = String(text || "").trim();
    if (!messageId || !t) return;

    // Avoid duplicate requests.
    if (translatedByMessageId?.[messageId]) return;
    if (translatingByMessageId?.[messageId]) return;

    setTranslatingByMessageId((prev) => ({ ...prev, [messageId]: true }));
    try {
      const reply = await aiChat({
        system:
          `You are a translation engine. Translate the user's text into ${targetLanguage}. ` +
          "Return ONLY the translated text. Do not add quotes, prefixes, or explanations.",
        prompt: t.slice(0, 4000),
      });

      const translated = String(reply || "").trim();
      if (!translated) throw new Error("Empty translation");
      setTranslatedByMessageId((prev) => ({ ...prev, [messageId]: translated }));
    } catch (e) {
      console.error("Translate failed", e);
      alert(e?.message || "Translation failed. Please try again.");
    } finally {
      setTranslatingByMessageId((prev) => ({ ...prev, [messageId]: false }));
    }
  };

  return (
    <Card className="h-full flex flex-col bg-white border-slate-200 dark:bg-slate-950 dark:border-slate-800">
      <CardHeader className="pb-3 border-b border-slate-200 dark:border-slate-800">
        <div className="flex items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            {onBack ? (
              <button
                type="button"
                onClick={onBack}
                className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-900 dark:hover:text-slate-100"
                aria-label="Back"
              >
                <ArrowLeft className="h-4 w-4" />
              </button>
            ) : null}
            <Avatar className="h-10 w-10">
              <AvatarImage src={otherProfile?.photoURL || ""} alt={headerTitle} />
              <AvatarFallback>{initials(headerTitle)}</AvatarFallback>
            </Avatar>
            <div className="min-w-0">
              <CardTitle className="text-base truncate text-slate-900 dark:text-slate-100">
                {headerTitle}
              </CardTitle>
              <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                <span
                  className={cn(
                    "h-2 w-2 rounded-full",
                    statusDotClass,
                  )}
                />
                <span className="truncate">{statusText}</span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-1">
            {onOpenUserSearch ? (
              <button
                type="button"
                className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-900 dark:hover:text-slate-100"
                onClick={onOpenUserSearch}
                aria-label="Search users"
              >
                <Search className="h-4 w-4" />
              </button>
            ) : null}
            <button
              type="button"
              className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-900 dark:hover:text-slate-100"
              disabled={isEmpty}
              aria-label="Star"
            >
              <Star className="h-4 w-4" />
            </button>
            <button
              type="button"
              className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-900 dark:hover:text-slate-100"
              disabled={isEmpty}
              aria-label="Attach file"
            >
              <Paperclip className="h-4 w-4" />
            </button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-900 dark:hover:text-slate-100"
                  disabled={isEmpty}
                  aria-label="More options"
                >
                  <MoreVertical className="h-4 w-4" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-52">
                <DropdownMenuItem
                  className="text-destructive focus:text-destructive"
                  onSelect={(e) => {
                    e.preventDefault();
                    if (isEmpty) return;
                    setDeleteScope("me");
                    setDeleteOpen(true);
                  }}
                >
                  <Trash2 className="mr-2 h-4 w-4" />
                  Delete chat
                </DropdownMenuItem>

                <DropdownMenuItem
                  className="text-destructive focus:text-destructive"
                  onSelect={(e) => {
                    e.preventDefault();
                    if (isEmpty) return;
                    setDeleteScope("everyone");
                    setDeleteOpen(true);
                  }}
                >
                  <Trash2 className="mr-2 h-4 w-4" />
                  Delete for everyone
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem disabled>
                  <Star className="mr-2 h-4 w-4" />
                  Star (coming soon)
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </CardHeader>

      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {deleteScope === "everyone" ? "Delete chat for everyone?" : "Delete this chat?"}
            </AlertDialogTitle>
            {deleteScope === "everyone" ? (
              <AlertDialogDescription>
                This clears chat history for both users and removes it from both inboxes. It may reappear if
                either user sends a new message.
              </AlertDialogDescription>
            ) : (
              <AlertDialogDescription>
                This removes the conversation from your inbox. The other user may still see it, and it can
                reappear if new messages are sent.
              </AlertDialogDescription>
            )}
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={async () => {
                const chatId = activeChat?.chatId;
                if (!chatId) return;
                try {
                  await onDeleteChat?.(chatId, deleteScope);
                } finally {
                  setDeleteOpen(false);
                }
              }}
            >
              {deleteScope === "everyone" ? "Delete for everyone" : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <CardContent className="flex min-h-0 flex-1 flex-col p-0">
        <div className="flex-1 overflow-hidden bg-white dark:bg-slate-950">
          {isEmpty ? (
            <div className="flex h-full flex-col items-center justify-center p-8 text-center">
              <svg
                width="180"
                height="140"
                viewBox="0 0 180 140"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
                className="mb-4 opacity-90"
              >
                <rect x="18" y="18" width="144" height="92" rx="18" className="fill-slate-100 dark:fill-slate-900" />
                <rect x="34" y="38" width="92" height="10" rx="5" className="fill-slate-200 dark:fill-slate-800" />
                <rect x="34" y="58" width="112" height="10" rx="5" className="fill-slate-200 dark:fill-slate-800" />
                <rect x="34" y="78" width="72" height="10" rx="5" className="fill-slate-200 dark:fill-slate-800" />
                <circle cx="135" cy="88" r="10" className="fill-emerald-500" />
              </svg>
              <div className="text-lg font-semibold text-slate-900 dark:text-slate-100">
                Select a conversation
              </div>
              <div className="mt-1 max-w-sm text-sm text-slate-500 dark:text-slate-400">
                Choose a chat from the left to view messages, send updates, and manage your order.
              </div>
            </div>
          ) : (
            <ScrollArea className="h-full">
              <div className="space-y-2 p-3">
                {(messages || []).map((m) => {
                  const isMe = m.senderId === currentUid;
                  const translatedText = translatedByMessageId?.[m.id];
                  const isDeleted = Boolean(m?.deleted);
                  const parsed = isDeleted ? { text: "", attachments: [] } : parseAttachmentSnippets(m.text);
                  const hasAttachments = parsed.attachments.length > 0;
                  const displayText = isDeleted
                    ? "Message unsent"
                    : hasAttachments
                      ? parsed.text
                      : (translatedText || m.text);
                  const translating = Boolean(translatingByMessageId?.[m.id]);
                  return (
                    <div key={m.id} className={cn("flex w-full", isMe ? "justify-end" : "justify-start")}>
                      <div
                        className={cn(
                          "group relative max-w-[90%] rounded-2xl px-4 py-3 text-[15px] leading-relaxed",
                          isMe
                            ? "bg-emerald-600 text-white"
                            : "bg-slate-100 text-slate-900 dark:bg-slate-900 dark:text-slate-100",
                        )}
                      >
                        {isMe && !isDeleted && typeof onUnsendMessage === "function" ? (
                          <div className="absolute right-2 top-2 opacity-0 transition-opacity group-hover:opacity-100">
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <button
                                  type="button"
                                  className={cn(
                                    "inline-flex h-7 w-7 items-center justify-center rounded-md",
                                    isMe ? "text-white/90 hover:bg-white/10" : "text-slate-600 hover:bg-slate-200 dark:text-slate-300 dark:hover:bg-slate-800",
                                  )}
                                  aria-label="Message options"
                                >
                                  <MoreVertical className="h-4 w-4" />
                                </button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end" className="w-44">
                                <DropdownMenuItem
                                  className="text-destructive focus:text-destructive"
                                  onSelect={(e) => {
                                    e.preventDefault();
                                    onUnsendMessage(m);
                                  }}
                                >
                                  Unsend
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </div>
                        ) : null}

                        {displayText ? (
                          <div className={cn("whitespace-pre-wrap break-words", isDeleted ? "italic opacity-80" : "")}>{displayText}</div>
                        ) : null}

                        {hasAttachments ? (
                          <div className="mt-2 space-y-2">
                            {parsed.attachments.map((a, idx) => {
                              const image = isLikelyImageUrl(a.url);
                              return (
                                <div
                                  key={`${a.url}-${idx}`}
                                  className={cn(
                                    "rounded-xl border p-2",
                                    isMe
                                      ? "border-white/20 bg-white/10"
                                      : "border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-950",
                                  )}
                                >
                                  {image ? (
                                    <a href={a.url} target="_blank" rel="noreferrer" className="block">
                                      <img
                                        src={a.url}
                                        alt={a.name || "Attachment"}
                                        loading="lazy"
                                        className={cn(
                                          "max-h-64 w-full max-w-xs rounded-lg object-contain",
                                          isMe ? "border border-white/20" : "border border-slate-200 dark:border-slate-800",
                                        )}
                                      />
                                    </a>
                                  ) : (
                                    <a
                                      href={a.url}
                                      target="_blank"
                                      rel="noreferrer"
                                      className={cn(
                                        "block text-[13px] font-medium underline underline-offset-2 break-all",
                                        isMe ? "text-white" : "text-slate-900 dark:text-slate-100",
                                      )}
                                    >
                                      {a.name || "Attachment"}
                                    </a>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        ) : null}

                        <div className="mt-1.5 flex items-center justify-between gap-3">
                          <div
                            className={cn(
                              "text-[12px] opacity-70",
                              isMe ? "text-white" : "text-slate-500 dark:text-slate-400",
                            )}
                          >
                            {formatTime(m.createdAt)}
                          </div>
                          <button
                            type="button"
                            onClick={() => translateMessage(m.id, m.text)}
                            className={cn(
                              "inline-flex items-center gap-1 text-[12px] opacity-70 transition-opacity",
                              "hover:opacity-100",
                              isMe ? "text-white" : "text-slate-500 dark:text-slate-400",
                            )}
                            disabled={isDeleted || hasAttachments || translating || Boolean(translatedText)}
                            aria-label="Translate message"
                            title={
                              isDeleted
                                ? "Translation disabled for unsent messages"
                                : hasAttachments
                                ? "Translation disabled for attachments"
                                : translatedText
                                  ? "Translated"
                                  : translating
                                    ? "Translating…"
                                    : "Translate"
                            }
                          >
                            <Languages className="h-3.5 w-3.5" />
                            <span className="hidden sm:inline">
                              {isDeleted ? "Unsent" : hasAttachments ? "Attachment" : translatedText ? "Translated" : translating ? "Translating…" : "Translate"}
                            </span>
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
                <div ref={bottomRef} />
              </div>
            </ScrollArea>
          )}
        </div>

        <div className="border-t border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-950">
          <MessageInput disabled={isEmpty || sendingDisabled} onSend={onSend} currentUid={currentUid} />
        </div>
      </CardContent>
    </Card>
  );
}
