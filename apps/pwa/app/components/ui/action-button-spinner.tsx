import { cn } from "@/app/lib/utils";

type ActionButtonSpinnerProps = Readonly<{
  className?: string;
}>;

/** Continuous indeterminate spinner for primary actions (not tied to Tailwind animate-spin). */
export const ActionButtonSpinner = ({ className }: ActionButtonSpinnerProps) => (
  <span
    aria-hidden
    className={cn(
      "inline-block h-4 w-4 shrink-0 rounded-full border-2 border-current/30 border-t-current obscur-indeterminate-spin",
      className,
    )}
  />
);
