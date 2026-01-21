import type { ButtonHTMLAttributes } from "react";
import { cn } from "../../lib/cn";

type ButtonVariant = "primary" | "secondary" | "danger" | "outline";

type ButtonProps = Readonly<{
  variant?: ButtonVariant;
  className?: string;
}> &
  Omit<ButtonHTMLAttributes<HTMLButtonElement>, "className">;

const getVariantClassName = (variant: ButtonVariant): string => {
  if (variant === "secondary") {
    return "border border-black/10 bg-gradient-button text-zinc-900 hover:bg-zinc-50 dark:border-white/10 dark:text-zinc-100 dark:hover:bg-zinc-900/50";
  }
  if (variant === "danger") {
    return "border border-red-500/30 bg-red-600 text-white hover:bg-red-700 dark:border-red-500/40 dark:bg-red-600 dark:hover:bg-red-700";
  }
  if (variant === "outline") {
    return "border border-zinc-300 bg-transparent text-zinc-900 hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-100 dark:hover:bg-zinc-800";
  }
  return "bg-zinc-900 text-white hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-white";
};

export const Button = (props: ButtonProps) => {
  const { variant, className, disabled, ...rest } = props;
  const resolvedVariant: ButtonVariant = variant ?? "primary";
  return (
    <button
      {...rest}
      disabled={disabled}
      className={cn(
        "btn-enhanced inline-flex min-h-10 items-center justify-center gap-2 rounded-xl px-4 py-2 text-sm font-medium",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400/50 focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:focus-visible:ring-offset-black",
        "disabled:pointer-events-none disabled:opacity-40",
        getVariantClassName(resolvedVariant),
        className
      )}
    />
  );
};
