import { cn } from "@dweb/ui-kit/cn";
import { MessageStatus, type MessageStatusType } from "@dweb/ui-kit/message-status";

/**
 * OB3 — presentational message bubble. Props only · no durability owners / reactions / voice.
 */
export type MessageBubbleViewProps = Readonly<{
  id: string;
  body: string;
  direction: "in" | "out";
  deliveryStatus: "accepted" | "failed" | "pending";
  sentAtUnixMs?: number;
}>;

const mapDeliveryStatus = (
  status: MessageBubbleViewProps["deliveryStatus"],
): MessageStatusType => {
  if (status === "failed") {
    return "failed";
  }
  if (status === "pending") {
    return "sending";
  }
  return "accepted";
};

export function MessageBubbleView(props: MessageBubbleViewProps) {
  const outgoing = props.direction === "out";

  return (
    <div
      data-testid="message-bubble"
      data-message-id={props.id}
      className={cn(
        "flex max-w-[85%] flex-col gap-1",
        outgoing ? "self-end items-end" : "self-start items-start",
      )}
    >
      <div
        className={cn(
          "rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed shadow-sm",
          outgoing
            ? "bg-gradient-primary text-white"
            : "border border-black/5 bg-gradient-card text-zinc-900 dark:border-white/10 dark:text-zinc-100",
        )}
      >
        <p className="m-0 whitespace-pre-wrap break-words">{props.body}</p>
      </div>
      <div className="flex items-center gap-1.5 px-1">
        {typeof props.sentAtUnixMs === "number" ? (
          <span className="text-[10px] font-medium text-zinc-500 dark:text-zinc-400">
            {new Date(props.sentAtUnixMs).toLocaleTimeString([], {
              hour: "2-digit",
              minute: "2-digit",
            })}
          </span>
        ) : null}
        {outgoing ? (
          <MessageStatus status={mapDeliveryStatus(props.deliveryStatus)} size="small" />
        ) : null}
      </div>
    </div>
  );
}
