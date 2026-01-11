import type { ReactNode } from "react";
import { MessageCircle, Search, Wifi, Users } from "lucide-react";
import { cn } from "../../lib/cn";
import { Button } from "./button";

type EmptyStateType = "chats" | "search" | "relays" | "requests";

type EmptyStateAction = Readonly<{
  label: string;
  onClick: () => void;
  variant?: "primary" | "secondary";
}>;

type EmptyStateProps = Readonly<{
  type: EmptyStateType;
  title?: string;
  description?: string;
  actions?: ReadonlyArray<EmptyStateAction>;
  className?: string;
}>;

const getIllustration = (type: EmptyStateType): ReactNode => {
  const iconClass = "h-16 w-16 text-zinc-400 dark:text-zinc-500";
  
  switch (type) {
    case "chats":
      return (
        <div className="relative">
          <MessageCircle className={iconClass} />
          <div className="absolute -bottom-1 -right-1 h-6 w-6 rounded-full bg-gradient-card border-2 border-white dark:border-zinc-900 flex items-center justify-center">
            <div className="h-2 w-2 rounded-full bg-zinc-400 dark:bg-zinc-500" />
          </div>
        </div>
      );
    case "search":
      return (
        <div className="relative">
          <Search className={cn(iconClass, "animate-pulse")} />
          <div className="absolute -top-2 -right-2 h-4 w-4 rounded-full bg-gradient-card border border-zinc-200 dark:border-zinc-700" />
        </div>
      );
    case "relays":
      return (
        <div className="relative">
          <Wifi className={iconClass} />
          <div className="absolute -bottom-1 -right-1 flex space-x-1">
            <div className="h-2 w-2 rounded-full bg-red-400 animate-pulse" />
            <div className="h-2 w-2 rounded-full bg-yellow-400 animate-pulse delay-100" />
            <div className="h-2 w-2 rounded-full bg-green-400 animate-pulse delay-200" />
          </div>
        </div>
      );
    case "requests":
      return (
        <div className="relative">
          <Users className={iconClass} />
          <div className="absolute -top-1 -right-1 h-5 w-5 rounded-full bg-blue-500 text-white text-xs flex items-center justify-center font-semibold">
            0
          </div>
        </div>
      );
    default:
      return <MessageCircle className={iconClass} />;
  }
};

const getDefaultContent = (type: EmptyStateType): { title: string; description: string } => {
  switch (type) {
    case "chats":
      return {
        title: "No messages yet",
        description: "Start a conversation by sending your first message. Your messages are encrypted and private.",
      };
    case "search":
      return {
        title: "No results found",
        description: "Try different keywords or check your spelling. You can search messages, contacts, and conversations.",
      };
    case "relays":
      return {
        title: "No relays configured",
        description: "Relays help you connect to the network. Add at least one relay to start messaging.",
      };
    case "requests":
      return {
        title: "No connection requests",
        description: "When someone wants to connect with you, their requests will appear here.",
      };
    default:
      return {
        title: "Nothing here yet",
        description: "This area will show content when available.",
      };
  }
};

export const EmptyState = (props: EmptyStateProps) => {
  const defaultContent = getDefaultContent(props.type);
  const title = props.title ?? defaultContent.title;
  const description = props.description ?? defaultContent.description;

  return (
    <div className={cn(
      "flex h-full min-h-[400px] items-center justify-center p-8",
      props.className
    )}>
      <div className="max-w-md text-center">
        {/* Illustration */}
        <div className="mb-6 flex justify-center">
          <div className="rounded-2xl bg-gradient-card p-6 shadow-sm ring-1 ring-black/5 dark:ring-white/10">
            {getIllustration(props.type)}
          </div>
        </div>

        {/* Content */}
        <div className="mb-6">
          <h3 className="mb-2 text-lg font-semibold text-zinc-900 dark:text-zinc-100">
            {title}
          </h3>
          <p className="text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">
            {description}
          </p>
        </div>

        {/* Actions */}
        {props.actions && props.actions.length > 0 && (
          <div className="flex flex-col gap-2 sm:flex-row sm:justify-center">
            {props.actions.map((action, index) => (
              <Button
                key={index}
                type="button"
                variant={action.variant ?? "primary"}
                onClick={action.onClick}
                className="min-w-[120px]"
              >
                {action.label}
              </Button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};