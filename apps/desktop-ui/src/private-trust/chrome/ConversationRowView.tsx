import { cn } from "@dweb/ui-kit/cn";

/**
 * OB3 — presentational conversation row (Obscur list chrome).
 * Props only — no identity/metadata/voice owners · no @/app/features.
 */
export type ConversationRowViewProps = Readonly<{
  id: string;
  label: string;
  preview: string;
  selected: boolean;
  onSelect: (id: string) => void;
  unreadCount?: number;
}>;

export function ConversationRowView(props: ConversationRowViewProps) {
  const initial = (props.label.trim()[0] ?? "?").toUpperCase();
  const unread = props.unreadCount ?? 0;

  return (
    <button
      type="button"
      data-testid="conversation-row"
      data-conversation-id={props.id}
      aria-pressed={props.selected}
      onClick={() => props.onSelect(props.id)}
      className={cn(
        "group flex w-full cursor-pointer items-center gap-3 border-b border-black/5 p-3 text-left outline-none transition-all",
        "hover:bg-zinc-50/80 focus-visible:bg-zinc-50/80 dark:border-white/5 dark:hover:bg-zinc-900/40 dark:focus-visible:bg-zinc-900/40",
        props.selected && "bg-zinc-100/50 dark:bg-zinc-900/60",
      )}
    >
      <div
        className={cn(
          "relative flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-xl",
          "bg-gradient-to-br from-zinc-800 to-black text-sm font-black text-white shadow-sm",
          "dark:from-zinc-100 dark:to-zinc-300 dark:text-black",
        )}
        aria-hidden
      >
        {initial}
      </div>
      <div className="flex min-w-0 flex-1 flex-col justify-center gap-1 py-0.5">
        <span className="truncate text-sm font-bold tracking-tight text-zinc-900 dark:text-zinc-100">
          {props.label}
        </span>
        <div className="flex items-center justify-between gap-1 overflow-hidden">
          <p className="flex-1 truncate text-xs font-medium leading-normal text-zinc-600 dark:text-zinc-400">
            {props.preview || "No messages yet"}
          </p>
          {unread > 0 ? (
            <span className="flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full bg-red-500 px-1.5 text-[10px] font-black text-white shadow-sm ring-2 ring-white dark:ring-black">
              {unread}
            </span>
          ) : null}
        </div>
      </div>
    </button>
  );
}
