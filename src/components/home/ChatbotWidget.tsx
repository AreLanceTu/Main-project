import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { MessageCircle, Send, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { aiChat, type AiChatMessage } from "@/lib/aiChat";

const SYSTEM_PROMPT =
  "You are GigFlow's helpful assistant. Answer concisely and practically. If the user asks about gigs, propose clear gig titles, pricing, and next steps.";

const STARTER: AiChatMessage[] = [
  {
    role: "assistant",
    content:
      "Hi! Tell me what service you want to offer (e.g. video editing) and I’ll help you with a gig title, description, pricing, and tags.",
  },
];

function clampHistory(messages: AiChatMessage[], max: number): AiChatMessage[] {
  if (messages.length <= max) return messages;
  return messages.slice(messages.length - max);
}

export default function ChatbotWidget() {
  const navigate = useNavigate();
  const { toast } = useToast();

  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<AiChatMessage[]>(() => STARTER);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);

  const scrollRef = useRef<HTMLDivElement | null>(null);

  const canSend = useMemo(() => {
    return Boolean(text.trim()) && !sending;
  }, [sending, text]);

  useEffect(() => {
    // Auto-scroll to bottom whenever messages change.
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [messages, open]);

  async function send() {
    const prompt = text.trim();
    if (!prompt || sending) return;

    setText("");
    setSending(true);

    const nextMessages = clampHistory([...messages, { role: "user", content: prompt }], 16);
    setMessages(nextMessages);

    try {
      const reply = await aiChat({ messages: nextMessages, system: SYSTEM_PROMPT });
      setMessages((prev) => clampHistory([...prev, { role: "assistant", content: reply }], 16));
    } catch (e: any) {
      const msg = String(e?.message || "AI chat failed");

      // Common case: user isn't signed in (Firebase token required).
      if (/not signed in/i.test(msg)) {
        toast({
          title: "Sign in to use chat",
          description: "Please sign in, then try again.",
          variant: "destructive",
        });
        navigate("/login");
      } else {
        toast({
          title: "Chatbot failed",
          description: msg,
          variant: "destructive",
        });
      }

      setMessages((prev) =>
        clampHistory(
          [
            ...prev,
            {
              role: "assistant",
              content: "I couldn’t reply just now. Please try again in a moment.",
            },
          ],
          16,
        ),
      );
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="fixed bottom-4 right-4 sm:bottom-6 sm:right-6 z-50">
      {open ? (
        <Card className="w-[calc(100vw-2rem)] max-w-[380px] shadow-xl border-muted">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between gap-3">
              <CardTitle className="text-base">GigFlow Chatbot</CardTitle>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => setOpen(false)}
                aria-label="Close chatbot"
              >
                <X className="h-5 w-5" />
              </Button>
            </div>
            <div className="text-xs text-muted-foreground">
              Ask about gig titles, descriptions, pricing, tags.
            </div>
          </CardHeader>

          <Separator />

          <CardContent className="pt-4">
            <div ref={scrollRef} className="h-[50vh] sm:h-[320px] overflow-auto pr-3">
              <div className="space-y-3">
                {messages.map((m, idx) => {
                  const isUser = m.role === "user";
                  return (
                    <div
                      key={`${m.role}-${idx}`}
                      className={`flex ${isUser ? "justify-end" : "justify-start"}`}
                    >
                      <div
                        className={`max-w-[85%] rounded-lg px-3 py-2 text-sm whitespace-pre-wrap ${
                          isUser
                            ? "bg-primary text-primary-foreground"
                            : "bg-muted text-foreground"
                        }`}
                      >
                        {m.content}
                      </div>
                    </div>
                  );
                })}

                {sending ? (
                  <div className="flex justify-start">
                    <div className="max-w-[85%] rounded-lg px-3 py-2 text-sm bg-muted text-muted-foreground">
                      Thinking…
                    </div>
                  </div>
                ) : null}
              </div>
            </div>
          </CardContent>

          <Separator />

          <CardFooter className="pt-3">
            <form
              className="flex w-full items-center gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                send();
              }}
            >
              <Input
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder="Type a message…"
                disabled={sending}
              />
              <Button type="submit" disabled={!canSend} aria-label="Send message">
                <Send className="h-4 w-4" />
              </Button>
            </form>
          </CardFooter>
        </Card>
      ) : (
        <Button
          type="button"
          size="icon"
          className="h-12 w-12 rounded-full shadow-lg"
          onClick={() => setOpen(true)}
          aria-label="Open chatbot"
        >
          <MessageCircle className="h-6 w-6" />
        </Button>
      )}
    </div>
  );
}
