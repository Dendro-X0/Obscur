import { useState } from "react";
import { AlertCircle, ChevronDown, ChevronUp } from "lucide-react";
import { cn } from "../../lib/cn";

type ErrorDetailsProps = Readonly<{
  title: string;
  message: string;
  details?: string;
  technicalDetails?: string;
  className?: string;
  onRetry?: () => void;
  retryLabel?: string;
}>;

export const ErrorDetails = (props: ErrorDetailsProps) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const hasDetails = Boolean(props.details || props.technicalDetails);

  return (
    <div className={cn(
      "rounded-xl border border-red-200 bg-red-50 dark:border-red-900/50 dark:bg-red-950/20",
      props.className
    )}>
      <div className="flex items-start gap-3 px-3 py-2">
        <AlertCircle className="h-5 w-5 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
        <div className="flex-1 min-w-0">
          <div className="font-medium text-sm text-red-700 dark:text-red-300">
            {props.title}
          </div>
          <div className="text-sm text-red-600 dark:text-red-400 mt-1">
            {props.message}
          </div>

          {hasDetails && (
            <button
              onClick={() => setIsExpanded(!isExpanded)}
              className="flex items-center gap-1 text-xs text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300 mt-2"
            >
              {isExpanded ? (
                <>
                  <ChevronUp className="h-3 w-3" />
                  Hide details
                </>
              ) : (
                <>
                  <ChevronDown className="h-3 w-3" />
                  Show details
                </>
              )}
            </button>
          )}

          {isExpanded && (
            <div className="mt-2 space-y-2">
              {props.details && (
                <div className="text-xs text-red-600 dark:text-red-400 bg-red-100 dark:bg-red-950/40 rounded px-2 py-1">
                  {props.details}
                </div>
              )}
              {props.technicalDetails && (
                <div className="text-xs font-mono text-red-600 dark:text-red-400 bg-red-100 dark:bg-red-950/40 rounded px-2 py-1 overflow-x-auto scrollbar-immersive">
                  {props.technicalDetails}
                </div>
              )}
            </div>
          )}

          {props.onRetry && (
            <button
              onClick={props.onRetry}
              className="mt-2 text-sm font-medium text-red-700 dark:text-red-300 hover:text-red-800 dark:hover:text-red-200 underline"
            >
              {props.retryLabel || 'Try again'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
