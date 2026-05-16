import type { ReactNode } from "react";
import { cn } from "../../lib/cn";

type BadgeVariant = "default" | "outline" | "secondary" | "destructive";

type BadgeProps = Readonly<{
    children: ReactNode;
    className?: string;
    variant?: BadgeVariant;
}>;

const variantClasses: Record<BadgeVariant, string> = {
    default: "bg-zinc-900 text-zinc-50 dark:bg-zinc-50 dark:text-zinc-900",
    outline: "border border-zinc-200 dark:border-zinc-700",
    secondary: "bg-zinc-100 text-zinc-900 dark:bg-zinc-800 dark:text-zinc-50",
    destructive: "bg-red-500 text-white",
};

export const Badge = ({ children, className, variant = "default" }: BadgeProps) => (
    <span
        className={cn(
            "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium transition-colors",
            variantClasses[variant],
            className,
        )}
    >
        {children}
    </span>
);
