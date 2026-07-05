// app/components/messaging/MessageBubble.tsx
"use client";

import type { Message } from "../../../lib/messaging";

type MessageBubbleProps = {
  message: Message;
  isOwn: boolean;
  status?: "sent" | "delivered" | "read";
};

function formatTime(iso: string): string {
  const date = new Date(iso);
  return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

// WhatsApp-style ticks: single grey = sent, double grey = delivered,
// double blue = read.
function TickIcon({ status }: { status: "sent" | "delivered" | "read" }) {
  const color = status === "read" ? "#53bdeb" : "rgba(255,255,255,0.7)";

  if (status === "sent") {
    return (
      <svg viewBox="0 0 16 15" width="14" height="13" fill="none">
        <path
          d="M4 8.5l2.5 2.5L12 5"
          stroke={color}
          strokeWidth="1.6"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    );
  }

  // delivered or read: two overlapping checks
  return (
    <svg viewBox="0 0 20 15" width="17" height="13" fill="none">
      <path
        d="M1 8.5l2.5 2.5L9 5"
        stroke={color}
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M7 8.5l2.5 2.5L15 5"
        stroke={color}
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
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
          {isOwn && status && <TickIcon status={status} />}
        </div>
      </div>
    </div>
  );
}
