// app/components/messaging/ConversationListItem.tsx
"use client";

import type { ConversationListItem as ConversationListItemType } from "../../../lib/messaging";
import { displayNameFor } from "../../../lib/messaging";

type Props = {
  item: ConversationListItemType;
  onClick: () => void;
};

function formatTimestamp(iso: string | null): string {
  if (!iso) return "";
  const date = new Date(iso);
  const now = new Date();
  const isToday = date.toDateString() === now.toDateString();
  if (isToday) {
    return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  }
  return date.toLocaleDateString([], { month: "short", day: "numeric" });
}

export default function ConversationListItem({ item, onClick }: Props) {
  const { conversation, otherProfile, lastMessage, unreadCount } = item;
  const name = displayNameFor(otherProfile);
  const preview = lastMessage?.is_deleted
    ? "This message was deleted"
    : lastMessage?.message_type === "text"
    ? lastMessage.content
    : lastMessage?.message_type
    ? `[${lastMessage.message_type}]`
    : "Say hello 👋";

  return (
    <button
      onClick={onClick}
      className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-white/5 transition-colors border-b border-white/5"
    >
      <div className="relative shrink-0">
        {otherProfile?.avatar_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={otherProfile.avatar_url}
            alt={name}
            className="h-12 w-12 rounded-full object-cover"
          />
        ) : (
          <div className="h-12 w-12 rounded-full bg-[rgba(127,29,29,0.45)] flex items-center justify-center text-white font-semibold">
            {name.charAt(0).toUpperCase()}
          </div>
        )}
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between">
          <span className="font-medium text-[#ededed] truncate">{name}</span>
          <span className="text-xs text-white/40 shrink-0 ml-2">
            {formatTimestamp(conversation.last_message_at)}
          </span>
        </div>
        <div className="flex items-center justify-between mt-0.5">
          <span
            className={`text-sm truncate ${
              unreadCount > 0 ? "text-white font-medium" : "text-white/50"
            }`}
          >
            {preview}
          </span>
          {unreadCount > 0 && (
            <span className="shrink-0 ml-2 h-5 min-w-5 rounded-full bg-[#dc2626] text-white text-[11px] font-semibold flex items-center justify-center px-1.5">
              {unreadCount > 99 ? "99+" : unreadCount}
            </span>
          )}
        </div>
      </div>
    </button>
  );
}
