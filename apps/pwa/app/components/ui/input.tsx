import type { ForwardedRef, InputHTMLAttributes } from "react";
import { forwardRef } from "react";
import { cn } from "../../lib/cn";

type InputProps = Readonly<{
  className?: string;
}> &
  Omit<InputHTMLAttributes<HTMLInputElement>, "className">;

export const Input = forwardRef<HTMLInputElement, InputProps>((props: InputProps, ref: ForwardedRef<HTMLInputElement>) => {
  const { className, ...rest } = props;
  return (
    <input
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

Input.displayName = "Input";
