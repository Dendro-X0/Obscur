import { Wifi, WifiOff, AlertCircle, CheckCircle } from "lucide-react";
import { cn } from "../../lib/cn";

type ConnectionStatusProps = Readonly<{
  isOnline: boolean;
  hasRelayConnection: boolean;
  connectedRelayCount?: number;
  totalRelayCount?: number;
  className?: string;
  showLabel?: boolean;
}>;

export const ConnectionStatus = (props: ConnectionStatusProps) => {
  const { isOnline, hasRelayConnection, connectedRelayCount = 0, totalRelayCount = 0, showLabel = true } = props;

  // Determine status
  const isFullyConnected = isOnline && hasRelayConnection && connectedRelayCount > 0;
  const isPartiallyConnected = isOnline && hasRelayConnection && connectedRelayCount < totalRelayCount;
  const isDisconnected = !isOnline || !hasRelayConnection;

  // Get icon and color
  const getStatusIcon = () => {
    if (isFullyConnected) {
      return <CheckCircle className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />;
    } else if (isPartiallyConnected) {
      return <AlertCircle className="h-4 w-4 text-amber-600 dark:text-amber-400" />;
    } else if (!isOnline) {
      return <WifiOff className="h-4 w-4 text-red-600 dark:text-red-400" />;
    } else {
      return <Wifi className="h-4 w-4 text-zinc-400 dark:text-zinc-500" />;
    }
  };

  const getStatusLabel = () => {
    if (!isOnline) {
      return "Offline";
    } else if (!hasRelayConnection) {
      return "Connecting...";
    } else if (connectedRelayCount === 0) {
      return "No relays connected";
    } else if (connectedRelayCount === totalRelayCount) {
      return `Connected to ${connectedRelayCount} relay${connectedRelayCount !== 1 ? 's' : ''}`;
    } else {
      return `Connected to ${connectedRelayCount}/${totalRelayCount} relays`;
    }
  };

  const getStatusColor = () => {
    if (isFullyConnected) {
      return "text-emerald-700 dark:text-emerald-300";
    } else if (isPartiallyConnected) {
      return "text-amber-700 dark:text-amber-300";
    } else {
      return "text-red-700 dark:text-red-300";
    }
  };

  return (
    <div className={cn("flex items-center gap-2", props.className)}>
      {getStatusIcon()}
      {showLabel && (
        <span className={cn("text-sm", getStatusColor())}>
          {getStatusLabel()}
        </span>
      )}
    </div>
  );
};
