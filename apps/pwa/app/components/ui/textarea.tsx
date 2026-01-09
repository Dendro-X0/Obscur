import type { ForwardedRef, TextareaHTMLAttributes } from "react";
import { forwardRef } from "react";
import { cn } from "../../lib/cn";

type TextareaProps = Readonly<{
  className?: string;
}> &
  Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, "className">;

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>((props: TextareaProps, ref: ForwardedRef<HTMLTextAreaElement>) => {
  const { className, ...rest } = props;
  return (
    <textarea
      {...rest}
      ref={ref}
      className={cn(
        "w-full rounded-xl border px-3 py-2 text-sm",
        "border-black/10 bg-white text-zinc-900 placeholder:text-zinc-400",
        "dark:border-white/10 dark:bg-zinc-950/60 dark:text-zinc-100 dark:placeholder:text-zinc-500",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400/60 focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:focus-visible:ring-offset-black",
        className
      )}
    />
  );
});

Textarea.displayName = "Textarea";
