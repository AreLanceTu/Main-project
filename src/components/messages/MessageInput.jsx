import { useEffect, useRef, useState } from "react";

import { Paperclip, SendHorizontal, Smile } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Textarea } from "@/components/ui/textarea";
import { supabaseUploadViaFunction } from "@/lib/supabaseStorage";

export default function MessageInput({ disabled, onSend, currentUid }) {
  const [value, setValue] = useState("");
  const [uploading, setUploading] = useState(false);
  const [emojiOpen, setEmojiOpen] = useState(false);
  const fileRef = useRef(null);
  const textareaRef = useRef(null);

  const autosizeTextarea = () => {
    const el = textareaRef.current;
    if (!el) return;

    // Reset and grow based on content, but cap it.
    el.style.height = "0px";
    const next = Math.min(el.scrollHeight, 160);
    el.style.height = `${next}px`;
  };

  useEffect(() => {
    autosizeTextarea();
  }, [value]);

  const canSend = !disabled && !uploading && value.trim().length > 0;

  const submit = async (e) => {
    e?.preventDefault?.();
    if (!canSend) return;
    const text = value.trim();
    setValue("");
    await onSend?.(text);
  };

  const onKeyDown = async (e) => {
    if (disabled) return;
    if (uploading) return;
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      await submit(e);
    }
  };

  const insertEmoji = (emoji) => {
    if (disabled || uploading) return;
    setValue((prev) => `${String(prev || "")}${emoji}`);
  };

  const emojis = [
    "😀","😃","😄","😁","😆","😅","😂","🤣","🙂","🙃","😉","😊",
    "😍","🥰","😘","😋","😎","🤓","😇","🤩","🥳","😤","😢","😭",
    "😡","🤯","😴","🤗","🤝","🙏","👏","👍","👎","💪","🔥","✨",
    "💯","❤️","🧡","💛","💚","💙","💜","🤍","🖤","💔","🎉","✅",
    "⭐","📌","📎","📷","🎁","🧠","💡","🕒","📅","📍","🚀","💬",
  ];

  const uploadAttachment = async (file) => {
    if (!file) return null;
    if (!currentUid) throw new Error("Not signed in");

    if (file.size > 25 * 1024 * 1024) {
      throw new Error("File must be under 25MB.");
    }

    const safeName = String(file.name || "file").replace(/[^a-zA-Z0-9._-]/g, "_");
    const path = `chat-uploads/${currentUid}/${Date.now()}-${safeName}`;
    const bucket = "uploads";

    const uploaded = await supabaseUploadViaFunction({ bucket, path, file });
    const url = uploaded?.publicUrl;
    if (!url) {
      throw new Error(
        "Uploaded, but no public URL returned. Make the bucket public or use signed download URLs.",
      );
    }
    return { url, name: file.name || "attachment" };
  };

  const onPickFile = async (e) => {
    const file = e.target.files?.[0] || null;
    // allow choosing the same file again
    e.target.value = "";
    if (!file) return;

    try {
      setUploading(true);
      const uploaded = await uploadAttachment(file);
      if (!uploaded?.url) return;

      const snippet = `Attachment: ${uploaded.name}\n${uploaded.url}`;
      setValue((prev) => {
        const base = String(prev || "").trim();
        return base ? `${base}\n\n${snippet}` : snippet;
      });
    } catch (err) {
      console.error("Attachment upload failed", err);
      // Keep UX simple: user can retry; we don't toast here to avoid wiring deps.
      setValue((prev) => (prev ? prev : ""));
      alert(
        err?.message ??
          "Attachment upload failed. Ensure bucket exists (uploads) and deploy Supabase Edge Functions: storage-upload and storage-signed-upload.",
      );
    } finally {
      setUploading(false);
    }
  };

  return (
    <form
      onSubmit={submit}
      className="flex items-end gap-2 p-3 bg-white dark:bg-slate-950"
    >
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="shrink-0 text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-900"
        disabled={disabled || uploading}
        aria-label="Attach"
        onClick={() => fileRef.current?.click?.()}
      >
        <Paperclip className="h-5 w-5" />
      </Button>

      <Popover open={emojiOpen} onOpenChange={setEmojiOpen}>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="shrink-0 text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-900"
            disabled={disabled || uploading}
            aria-label="Emoji"
          >
            <Smile className="h-5 w-5" />
          </Button>
        </PopoverTrigger>
        <PopoverContent
          align="start"
          side="top"
          className="w-72 p-3"
        >
          <div className="text-xs font-medium text-slate-700 dark:text-slate-200">Emojis</div>
          <div className="mt-2 grid grid-cols-8 gap-1">
            {emojis.map((e) => (
              <button
                key={e}
                type="button"
                className="h-8 w-8 rounded-md hover:bg-slate-100 dark:hover:bg-slate-900"
                onClick={() => insertEmoji(e)}
                aria-label={e}
              >
                <span className="text-lg leading-none">{e}</span>
              </button>
            ))}
          </div>
        </PopoverContent>
      </Popover>

      <input
        ref={fileRef}
        type="file"
        className="hidden"
        onChange={onPickFile}
        disabled={disabled || uploading}
      />

      <div className="flex-1 rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-950">
        <Textarea
          ref={textareaRef}
          value={value}
          onChange={(e) => {
            setValue(e.target.value);
          }}
          onKeyDown={onKeyDown}
          placeholder={disabled ? "Select a conversation" : "Write a message…"}
          disabled={disabled}
          rows={2}
          className="min-h-[56px] max-h-[160px] resize-none overflow-y-auto border-0 bg-transparent px-3 py-3 text-[15px] leading-relaxed text-slate-900 placeholder:text-slate-400 focus-visible:ring-0 dark:text-slate-100 dark:placeholder:text-slate-500"
        />
      </div>

      <Button type="submit" disabled={!canSend} className="shrink-0 bg-emerald-600 hover:bg-emerald-700">
        <SendHorizontal className="h-4 w-4" />
        {uploading ? "Uploading…" : "Send"}
      </Button>
    </form>
  );
}
