import { Slot } from "@radix-ui/react-slot";
import type { ButtonHTMLAttributes } from "react";
import { cn } from "../../lib/cn";

type ButtonVariant = "primary" | "secondary" | "danger" | "outline" | "ghost";

type ButtonSize = "sm" | "md" | "lg";

type ButtonProps = Readonly<{
  variant?: ButtonVariant;
  size?: ButtonSize;
  className?: string;
  asChild?: boolean;
}> &
  ButtonHTMLAttributes<HTMLButtonElement>;

const getVariantClassName = (variant: ButtonVariant): string => {
  if (variant === "secondary") {
    return "border border-black/10 bg-gradient-button text-zinc-900 hover:bg-zinc-50 dark:border-white/10 dark:text-zinc-100 dark:hover:bg-zinc-900/50";
  }
  if (variant === "danger") {
    return "border border-red-500/30 bg-red-600 text-white hover:bg-red-700 dark:border-red-500/40 dark:bg-red-600 dark:hover:bg-red-700";
  }
  if (variant === "outline") {
    return "border border-black/10 bg-transparent text-zinc-900 hover:bg-zinc-50 dark:border-white/10 dark:text-zinc-100 dark:hover:bg-zinc-900/50";
  }
  if (variant === "ghost") {
    return "bg-transparent text-zinc-900 hover:bg-zinc-50 dark:text-zinc-100 dark:hover:bg-zinc-900/50";
  }
  return "bg-gradient-primary text-white shadow-md shadow-purple-500/20 hover:shadow-lg hover:shadow-purple-500/30 dark:shadow-purple-900/20";
};

const getSizeClassName = (size: ButtonSize): string => {
  if (size === "sm") {
    return "min-h-8 rounded-lg px-3 py-1 text-xs";
  }
  if (size === "lg") {
    return "min-h-12 rounded-xl px-6 py-3 text-base";
  }
  return "min-h-10 rounded-xl px-4 py-2 text-sm";
};

export const Button = (props: ButtonProps) => {
  const { variant, size, className, asChild = false, ...rest } = props;
  const Component = asChild ? Slot : "button";
  const resolvedVariant: ButtonVariant = variant ?? "primary";
  const resolvedSize: ButtonSize = size ?? "md";

  return (
    <Component
      {...(rest as any)}
      className={cn(
        "btn-enhanced inline-flex items-center justify-center gap-2 font-semibold transition-all active:scale-95",
        getSizeClassName(resolvedSize),
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-400/50 focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:focus-visible:ring-offset-black",
        "disabled:pointer-events-none disabled:opacity-40",
        getVariantClassName(resolvedVariant),
        className
      )}
    />
  );
};
