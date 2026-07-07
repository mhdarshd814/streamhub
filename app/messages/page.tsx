"use client";

// The conversation list itself lives in app/messages/layout.tsx (a single
// persistent ConversationListPane shared across this whole route segment).
// On mobile it renders full-bleed as the list screen; on desktop it's the
// sidebar and this page becomes the empty right-hand pane below.
export default function MessagesPage() {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-3 bg-canvas text-center text-white">
      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-surface-raised">
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          className="h-8 w-8 text-faint"
        >
          <path d="M21 11.5a8.38 8.38 0 01-.9 3.8 8.5 8.5 0 01-7.6 4.7 8.38 8.38 0 01-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 01-.9-3.8 8.5 8.5 0 014.7-7.6 8.38 8.38 0 013.8-.9h.5a8.48 8.48 0 018 8v.5z" />
        </svg>
      </div>
      <p className="text-sm text-muted">Select a conversation to start chatting</p>
    </div>
  );
}
