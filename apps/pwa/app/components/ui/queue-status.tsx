import { Loader2, Clock, CheckCircle, AlertCircle } from "lucide-react";
import { cn } from "../../lib/cn";

type QueueStatusProps = Readonly<{
  queuedCount: number;
  processingCount: number;
  failedCount: number;
  isProcessing: boolean;
  className?: string;
  onProcessQueue?: () => void;
}>;

export const QueueStatus = (props: QueueStatusProps) => {
  const { queuedCount, processingCount, failedCount, isProcessing } = props;
  const totalPending = queuedCount + processingCount;

  if (totalPending === 0 && failedCount === 0) {
    return null;
  }

  return (
    <div className={cn(
      "rounded-xl border px-3 py-2",
      failedCount > 0
        ? "border-red-200 bg-red-50 dark:border-red-900/50 dark:bg-red-950/20"
        : "border-amber-200 bg-amber-50 dark:border-amber-900/50 dark:bg-amber-950/20",
      props.className
    )}>
      <div className="flex items-start gap-3">
        {isProcessing ? (
          <Loader2 className="h-5 w-5 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5 animate-spin" />
        ) : failedCount > 0 ? (
          <AlertCircle className="h-5 w-5 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
        ) : (
          <Clock className="h-5 w-5 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
        )}
        
        <div className="flex-1 min-w-0">
          <div className={cn(
            "font-medium text-sm",
            failedCount > 0
              ? "text-red-700 dark:text-red-300"
              : "text-amber-700 dark:text-amber-300"
          )}>
            {isProcessing ? 'Sending queued messages...' : 'Messages queued'}
          </div>
          
          <div className={cn(
            "text-sm mt-1",
            failedCount > 0
              ? "text-red-600 dark:text-red-400"
              : "text-amber-600 dark:text-amber-400"
          )}>
            {totalPending > 0 && (
              <div className="flex items-center gap-1">
                <Clock className="h-3 w-3" />
                <span>{totalPending} message{totalPending !== 1 ? 's' : ''} pending</span>
              </div>
            )}
            {failedCount > 0 && (
              <div className="flex items-center gap-1 mt-1">
                <AlertCircle className="h-3 w-3" />
                <span>{failedCount} message{failedCount !== 1 ? 's' : ''} failed</span>
              </div>
            )}
          </div>

          {props.onProcessQueue && !isProcessing && totalPending > 0 && (
            <button
              onClick={props.onProcessQueue}
              className={cn(
                "mt-2 text-sm font-medium underline",
                failedCount > 0
                  ? "text-red-700 dark:text-red-300 hover:text-red-800 dark:hover:text-red-200"
                  : "text-amber-700 dark:text-amber-300 hover:text-amber-800 dark:hover:text-amber-200"
              )}
            >
              Send now
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
