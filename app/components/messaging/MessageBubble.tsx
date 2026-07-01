// app/components/messaging/MessageBubble.tsx
"use client";

import type { Message } from "../../../lib/messaging";

type MessageBubbleProps = {
  message: Message;
  isOwn: boolean;
  status?: "sent" | "delivered" | "read"; // wired up in Phase 2
};

function formatTime(iso: string): string {
  const date = new Date(iso);
  return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

export default function MessageBubble({ message, isOwn, status }: MessageBubbleProps) {
  return (
    <div
      className={`flex w-full ${isOwn ? "justify-end" : "justify-start"} px-2 py-1`}
    >
      <div
        className={`max-w-[75%] rounded-2xl px-4 py-2 text-sm leading-relaxed ${
          isOwn
            ? "bg-[#dc2626] text-white rounded-br-sm"
            : "bg-[rgba(17,24,39,0.92)] text-[#ededed] border border-[rgba(127,29,29,0.35)] rounded-bl-sm"
        }`}
      >
        {message.is_deleted ? (
          <span className="italic opacity-60">This message was deleted</span>
        ) : (
          <span className="whitespace-pre-wrap break-words">{message.content}</span>
        )}

        <div
          className={`mt-1 flex items-center gap-1 text-[10px] ${
            isOwn ? "text-white/70 justify-end" : "text-white/40"
          }`}
        >
          <span>{formatTime(message.created_at)}</span>
          {message.is_edited && <span>· edited</span>}
          {isOwn && status && (
            <span className="ml-0.5">
              {status === "read" ? "✓✓" : status === "delivered" ? "✓✓" : "✓"}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
