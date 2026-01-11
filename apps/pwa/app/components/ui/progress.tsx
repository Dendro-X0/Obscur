import { cn } from "../../lib/cn";

type ProgressProps = Readonly<{
  value?: number; // 0-100
  size?: "small" | "medium" | "large";
  variant?: "default" | "success" | "warning" | "error";
  className?: string;
  showValue?: boolean;
}>;

const getSizeStyles = (size: "small" | "medium" | "large"): string => {
  switch (size) {
    case "small":
      return "h-1";
    case "large":
      return "h-3";
    case "medium":
    default:
      return "h-2";
  }
};

const getVariantStyles = (variant: "default" | "success" | "warning" | "error"): string => {
  switch (variant) {
    case "success":
      return "bg-emerald-500 dark:bg-emerald-400";
    case "warning":
      return "bg-amber-500 dark:bg-amber-400";
    case "error":
      return "bg-red-500 dark:bg-red-400";
    case "default":
    default:
      return "bg-blue-500 dark:bg-blue-400";
  }
};

export const Progress = (props: ProgressProps) => {
  const value = Math.min(100, Math.max(0, props.value ?? 0));
  const size = props.size ?? "medium";
  const variant = props.variant ?? "default";

  return (
    <div className={cn("w-full", props.className)}>
      <div className={cn(
        "w-full overflow-hidden rounded-full bg-zinc-200 dark:bg-zinc-700",
        getSizeStyles(size)
      )}>
        <div
          className={cn(
            "h-full transition-all duration-300 ease-out",
            getVariantStyles(variant)
          )}
          style={{ width: `${value}%` }}
        />
      </div>
      {props.showValue && (
        <div className="mt-1 text-xs text-zinc-600 dark:text-zinc-400 text-center">
          {Math.round(value)}%
        </div>
      )}
    </div>
  );
};

type SpinnerProps = Readonly<{
  size?: "small" | "medium" | "large";
  className?: string;
}>;

const getSpinnerSize = (size: "small" | "medium" | "large"): string => {
  switch (size) {
    case "small":
      return "h-4 w-4";
    case "large":
      return "h-8 w-8";
    case "medium":
    default:
      return "h-6 w-6";
  }
};

export const Spinner = (props: SpinnerProps) => {
  const size = props.size ?? "medium";

  return (
    <div
      className={cn(
        "animate-spin rounded-full border-2 border-zinc-300 border-t-zinc-600 dark:border-zinc-600 dark:border-t-zinc-300",
        getSpinnerSize(size),
        props.className
      )}
    />
  );
};

type LoadingStateProps = Readonly<{
  type?: "spinner" | "progress";
  message?: string;
  progress?: number;
  size?: "small" | "medium" | "large";
  className?: string;
}>;

export const LoadingState = (props: LoadingStateProps) => {
  const type = props.type ?? "spinner";
  const size = props.size ?? "medium";

  return (
    <div className={cn(
      "flex flex-col items-center justify-center gap-3 p-6",
      props.className
    )}>
      {type === "spinner" ? (
        <Spinner size={size} />
      ) : (
        <div className="w-full max-w-xs">
          <Progress 
            value={props.progress} 
            size={size} 
            showValue={props.progress !== undefined}
          />
        </div>
      )}
      
      {props.message && (
        <div className="text-sm text-zinc-600 dark:text-zinc-400 text-center">
          {props.message}
        </div>
      )}
    </div>
  );
};