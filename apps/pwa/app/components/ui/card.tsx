import type { ReactNode } from "react";
import { cn } from "../../lib/cn";

export * from "@dweb/ui-kit";

type CardSubProps = Readonly<{
    children: ReactNode;
    className?: string;
}>;

export const CardHeader = ({ children, className }: CardSubProps) => (
    <div className={cn("flex flex-col space-y-1.5 p-6", className)}>{children}</div>
);

export const CardTitle = ({ children, className }: CardSubProps) => (
    <h3 className={cn("text-lg font-semibold leading-none tracking-tight", className)}>{children}</h3>
);

export const CardContent = ({ children, className }: CardSubProps) => (
    <div className={cn("p-6 pt-0", className)}>{children}</div>
);
