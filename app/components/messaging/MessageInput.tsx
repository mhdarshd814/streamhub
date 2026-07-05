// app/components/messaging/MessageInput.tsx
"use client";

import { useState, useRef, type KeyboardEvent } from "react";

type MessageInputProps = {
  onSend: (text: string) => Promise<void> | void;
  disabled?: boolean;
  placeholder?: string;
  onTyping?: () => void;
};

export default function MessageInput({
  onSend,
  disabled,
  placeholder = "Message...",
  onTyping,
}: MessageInputProps) {
  const [value, setValue] = useState("");
  const [sending, setSending] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  async function handleSend() {
    const trimmed = value.trim();
    if (!trimmed || sending || disabled) return;

    setSending(true);
    setValue("");
    try {
      await onSend(trimmed);
    } finally {
      setSending(false);
      textareaRef.current?.focus();
    }
  }

  function handleKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  return (
    <div
      className="flex items-end gap-2 border-t border-[rgba(127,29,29,0.35)] bg-black/90 px-3 pt-3"
      style={{
        paddingBottom: "max(8px, env(safe-area-inset-bottom))",
      }}
    >
      <textarea
        ref={textareaRef}
        value={value}
        onChange={(e) => {
          setValue(e.target.value);
          onTyping?.();
        }}
        onKeyDown={handleKeyDown}
        rows={1}
        placeholder={placeholder}
        disabled={disabled}
        className="flex-1 resize-none rounded-2xl border border-[rgba(127,29,29,0.35)] bg-[rgba(17,24,39,0.92)] px-4 py-2 text-sm text-[#ededed] placeholder-white/40 outline-none max-h-32 focus:border-[#dc2626]"
      />
      <button
        onClick={handleSend}
        disabled={disabled || sending || !value.trim()}
        className="shrink-0 rounded-full bg-[#dc2626] px-4 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-40"
      >
        Send
      </button>
    </div>
  );
}
