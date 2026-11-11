import { EmptyState } from "@dweb/ui-kit/empty-state";

/**
 * OB3 — empty thread / empty list chrome (presentational).
 * Strips PWA relay/pubkey/share owners — remaster honesty copy only.
 */
export type EmptyThreadViewProps = Readonly<{
  variant: "no-conversations" | "no-selection" | "empty-thread";
}>;

const COPY: Record<EmptyThreadViewProps["variant"], Readonly<{ title: string; description: string }>> = {
  "no-conversations": {
    title: "No conversations yet",
    description: "Conversations appear here when private-trust home has peers. Continuity restore is a separate door.",
  },
  "no-selection": {
    title: "Select a conversation",
    description: "Choose a peer from the list to open the thread and composer.",
  },
  "empty-thread": {
    title: "No messages yet",
    description: "Send the first message on the active private-trust face. Home ACK ≠ delivered.",
  },
};

export function EmptyThreadView(props: EmptyThreadViewProps) {
  const copy = COPY[props.variant];
  return (
    <div data-testid={`empty-thread-${props.variant}`}>
      <EmptyState
        type="chats"
        title={copy.title}
        description={copy.description}
        className="min-h-[14rem] p-4"
      />
    </div>
  );
}
