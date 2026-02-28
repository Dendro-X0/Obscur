import { Check, CheckCheck, Clock, AlertTriangle, XCircle, Loader2 } from "lucide-react";
import { cn } from "../utils/cn";

/**
 * Valid status values for a message.
 */
export type MessageStatusType = "sending" | "queued" | "accepted" | "rejected" | "delivered" | "failed";

/**
 * Props for the MessageStatus component.
 */
export type MessageStatusProps = Readonly<{
    status: MessageStatusType;
    className?: string;
    size?: "small" | "medium";
}>;

const getStatusIcon = (status: MessageStatusType, size: "small" | "medium") => {
    const iconClass = cn(
        size === "small" ? "h-3 w-3" : "h-4 w-4"
    );

    switch (status) {
        case "sending":
            return <Clock className={cn(iconClass, "text-zinc-400 dark:text-zinc-500 animate-pulse")} />;
        case "queued":
            return <Loader2 className={cn(iconClass, "text-amber-500 dark:text-amber-400 animate-spin")} />;
        case "delivered":
            return <Check className={cn(iconClass, "text-zinc-500 dark:text-zinc-400")} />;
        case "accepted":
            return <CheckCheck className={cn(iconClass, "text-emerald-600 dark:text-emerald-400")} />;
        case "rejected":
            return <AlertTriangle className={cn(iconClass, "text-amber-600 dark:text-amber-400")} />;
        case "failed":
            return <XCircle className={cn(iconClass, "text-red-600 dark:text-red-400")} />;
        default:
            return null;
    }
};

const getStatusLabel = (status: MessageStatusType): string => {
    switch (status) {
        case "sending":
            return "Sending...";
        case "queued":
            return "Queued";
        case "delivered":
            return "Delivered";
        case "accepted":
            return "Sent";
        case "rejected":
            return "Retry pending";
        case "failed":
            return "Failed";
        default:
            return "";
    }
};

/**
 * Component to display the delivery and acceptance status of a message.
 */
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
