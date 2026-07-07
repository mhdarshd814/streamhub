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
      className="flex items-end gap-2 border-t border-hairline bg-canvas/90 px-3 pt-3"
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
        className="flex-1 resize-none rounded-2xl border border-hairline bg-surface px-4 py-2 text-sm text-white placeholder-faint outline-none max-h-32 focus:border-accent"
      />
      <button
        onClick={handleSend}
        disabled={disabled || sending || !value.trim()}
        aria-label="Send message"
        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-accent text-white transition-colors hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-40"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
          fill="currentColor"
          className="h-5 w-5 translate-x-[-1px]"
        >
          <path d="M2.94 2.94a1.5 1.5 0 011.6-.34l17 6.5a1.5 1.5 0 010 2.8l-17 6.5a1.5 1.5 0 01-1.98-1.83L4.5 12 2.56 4.77a1.5 1.5 0 01.38-1.83z" />
        </svg>
      </button>
    </div>
  );
}
