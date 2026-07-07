"use client";

import { useParams } from "next/navigation";
import ConversationListPane from "../components/messaging/ConversationListPane";

export default function MessagesLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const params = useParams<{ conversationId?: string }>();
  const isThreadRoute = !!params?.conversationId;

  // Single ConversationListPane instance for the whole /messages segment —
  // Next keeps this layout mounted across navigation between the list and
  // a thread, so the inbox subscription never gets torn down and
  // re-created. Only its CSS layout (full-bleed vs. narrow sidebar)
  // changes with route/breakpoint; the component itself never remounts
  // or duplicates.
  return (
    <div className="xl:flex xl:h-[calc(100dvh-env(safe-area-inset-top)-4rem)]">
      <div
        className={
          isThreadRoute
            ? "hidden xl:block xl:w-[380px] xl:shrink-0 xl:overflow-y-auto xl:border-r xl:border-hairline"
            : "block w-full xl:w-[380px] xl:shrink-0 xl:overflow-y-auto xl:border-r xl:border-hairline"
        }
      >
        <ConversationListPane activeConversationId={params?.conversationId} />
      </div>

      <div
        className={
          isThreadRoute
            ? "block min-w-0 flex-1"
            : "hidden min-w-0 flex-1 xl:block"
        }
      >
        {children}
      </div>
    </div>
  );
}
