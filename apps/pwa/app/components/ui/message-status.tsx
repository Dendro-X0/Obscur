import { Check, CheckCheck, Clock, AlertTriangle } from "lucide-react";
import { cn } from "../../lib/cn";

type MessageStatus = "sending" | "delivered" | "accepted" | "rejected";

type MessageStatusProps = Readonly<{
  status: MessageStatus;
  className?: string;
  size?: "small" | "medium";
}>;

const getStatusIcon = (status: MessageStatus, size: "small" | "medium") => {
  const iconClass = cn(
    size === "small" ? "h-3 w-3" : "h-4 w-4"
  );

  switch (status) {
    case "sending":
      return <Clock className={cn(iconClass, "text-zinc-400 dark:text-zinc-500 animate-pulse")} />;
    case "delivered":
      return <Check className={cn(iconClass, "text-zinc-500 dark:text-zinc-400")} />;
    case "accepted":
      return <CheckCheck className={cn(iconClass, "text-emerald-600 dark:text-emerald-400")} />;
    case "rejected":
      return <AlertTriangle className={cn(iconClass, "text-red-600 dark:text-red-400")} />;
    default:
      return null;
  }
};

const getStatusLabel = (status: MessageStatus): string => {
  switch (status) {
    case "sending":
      return "Sending...";
    case "delivered":
      return "Delivered";
    case "accepted":
      return "Read";
    case "rejected":
      return "Failed";
    default:
      return "";
  }
};

export const MessageStatus = (props: MessageStatusProps) => {
  const size = props.size ?? "small";
  
  return (
    <div 
      className={cn(
        "flex items-center gap-1",
        props.className
      )}
      title={getStatusLabel(props.status)}
    >
      {getStatusIcon(props.status, size)}
      {size === "medium" && (
        <span className="text-xs text-zinc-500 dark:text-zinc-400">
          {getStatusLabel(props.status)}
        </span>
      )}
    </div>
  );
};