import type { LabelHTMLAttributes } from "react";
import { cn } from "../utils/cn";

type LabelProps = Readonly<{
    className?: string;
}> &
    Omit<LabelHTMLAttributes<HTMLLabelElement>, "className">;

export const Label = (props: LabelProps) => {
    const { className, ...rest } = props;
    return <label {...rest} className={cn("block text-xs font-medium text-zinc-700 dark:text-zinc-300", className)} />;
};
