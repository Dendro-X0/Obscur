import type { FormEvent } from "react";
import { Button } from "@dweb/ui-kit/button";
import { Textarea } from "@dweb/ui-kit/textarea";
import { cn } from "@dweb/ui-kit/cn";

/**
 * OB3 — presentational composer. Props only · no voice/attachment/protocol pipelines.
 */
export type ComposerViewProps = Readonly<{
  draft: string;
  onDraftChange: (value: string) => void;
  onSend: () => void | Promise<void>;
  disabled?: boolean;
  busy?: boolean;
  placeholder?: string;
  statusLine?: string | null;
}>;

export function ComposerView(props: ComposerViewProps) {
  const disabled = props.disabled === true || props.busy === true;
  const canSend = !disabled && props.draft.trim().length > 0;

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (!canSend) {
      return;
    }
    void props.onSend();
  };

  return (
    <form
      className="flex flex-col gap-3 border-t border-black/5 pt-3 dark:border-white/10"
      data-testid="composer"
      onSubmit={submit}
    >
      <Textarea
        value={props.draft}
        onChange={(event) => props.onDraftChange(event.target.value)}
        placeholder={props.placeholder ?? "Message…"}
        rows={3}
        disabled={disabled}
        className="min-h-[4.5rem] resize-y"
        data-testid="composer-draft"
      />
      <div className="flex flex-wrap items-center gap-3">
        <Button
          type="submit"
          disabled={!canSend}
          data-testid="composer-send"
        >
          {props.busy ? "Sending…" : "Send"}
        </Button>
        {props.statusLine ? (
          <p
            className={cn("m-0 text-sm text-zinc-500 dark:text-zinc-400")}
            data-testid="composer-status"
          >
            {props.statusLine}
          </p>
        ) : null}
      </div>
    </form>
  );
}
