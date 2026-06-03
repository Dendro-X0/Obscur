"use client";

import React from "react";
import { MessageSquareReply, Plus, X, Zap } from "lucide-react";
import { Button } from "@/app/components/ui/button";
import { Input } from "@/app/components/ui/input";
import { Label } from "@/app/components/ui/label";
import { cn } from "@/app/lib/cn";
import type { PublicKeyHex } from "@dweb/crypto/public-key-hex";
import type {
  CommunityBotTriggerEntry,
  CommunityBotTriggerKind,
  CommunityBotTriggerRule,
} from "../../services/community-bot-triggers-policy";
import { findBotTriggerEntry } from "../../services/community-bot-triggers-policy";
import { mgmtFieldClass, mgmtSectionClass } from "./constants";

const TRIGGER_KIND_LABEL: Record<CommunityBotTriggerKind, string> = {
  keyword: "Keyword",
  mention: "Mention",
  schedule: "Schedule",
};

const upsertBotTriggerEntry = (
  entries: ReadonlyArray<CommunityBotTriggerEntry>,
  botPubkey: PublicKeyHex,
  updater: (current: CommunityBotTriggerEntry | undefined) => CommunityBotTriggerEntry | null,
): ReadonlyArray<CommunityBotTriggerEntry> => {
  const current = findBotTriggerEntry(entries, botPubkey);
  const next = updater(current);
  const without = entries.filter((entry) => entry.botPubkey !== botPubkey);
  return next ? [...without, next] : without;
};

const defaultRuleForKind = (kind: CommunityBotTriggerKind): CommunityBotTriggerRule => {
  if (kind === "keyword") {
    return { kind, enabled: true, reply: "Got it.", keywords: ["help"] };
  }
  if (kind === "schedule") {
    return { kind, enabled: true, reply: "Scheduled check-in.", intervalMinutes: 60 };
  }
  return { kind, enabled: true, reply: "You mentioned me." };
};

export function CommunityBotTriggersSection({
  botPubkeys,
  botTriggers,
  onChange,
  disabled,
  requiresGovernanceProposal = false,
}: Readonly<{
  botPubkeys: ReadonlyArray<PublicKeyHex>;
  botTriggers: ReadonlyArray<CommunityBotTriggerEntry>;
  onChange: (next: ReadonlyArray<CommunityBotTriggerEntry>) => void;
  disabled?: boolean;
  requiresGovernanceProposal?: boolean;
}>): React.JSX.Element | null {
  if (botPubkeys.length === 0) {
    return null;
  }

  const updateEntry = (
    botPubkey: PublicKeyHex,
    updater: (current: CommunityBotTriggerEntry | undefined) => CommunityBotTriggerEntry | null,
  ): void => {
    onChange(upsertBotTriggerEntry(botTriggers, botPubkey, updater));
  };

  return (
    <section className={mgmtSectionClass} id="community-bot-triggers-descriptor">
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-sky-100 text-sky-700 dark:bg-sky-500/15 dark:text-sky-300">
          <Zap className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1 space-y-1">
          <Label className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
            Inbound triggers (B2)
          </Label>
          <p className="text-xs leading-relaxed text-zinc-500">
            Configure keyword, mention, and schedule replies for registered bots.
            Disabled bots or rules are ignored by the inbound runner.
            Default rate limit: 6 replies/min per community.
            {requiresGovernanceProposal
              ? " Changes apply after members approve the governance proposal."
              : ""}
          </p>
        </div>
      </div>

      <div className="mt-4 space-y-4">
        {botPubkeys.map((botPubkey) => {
          const entry = findBotTriggerEntry(botTriggers, botPubkey);
          const enabled = entry?.enabled ?? false;
          const triggers = entry?.triggers ?? [];

          return (
            <div
              key={botPubkey}
              className="rounded-lg border border-zinc-200 bg-white/80 p-3 dark:border-zinc-700 dark:bg-zinc-900/60"
            >
              <div className="flex flex-wrap items-center gap-2">
                <code className="min-w-0 flex-1 truncate text-xs text-zinc-600 dark:text-zinc-300">
                  {botPubkey}
                </code>
                <label className="flex items-center gap-2 text-xs text-zinc-500">
                  <input
                    type="checkbox"
                    checked={enabled}
                    disabled={disabled}
                    onChange={(event) => {
                      updateEntry(botPubkey, (current) => {
                        const nextTriggers = current?.triggers ?? [];
                        if (!event.target.checked && nextTriggers.length === 0) {
                          return null;
                        }
                        return {
                          botPubkey,
                          enabled: event.target.checked,
                          triggers: nextTriggers.length > 0
                            ? nextTriggers
                            : [defaultRuleForKind("mention")],
                        };
                      });
                    }}
                  />
                  Triggers enabled
                </label>
              </div>

              {enabled ? (
                <div className="mt-3 space-y-3">
                  {triggers.map((rule, index) => (
                    <div
                      key={`${rule.kind}-${index}`}
                      className="space-y-2 rounded-md border border-zinc-200/80 p-3 dark:border-zinc-700/80"
                    >
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="inline-flex items-center gap-1 rounded-md bg-zinc-100 px-2 py-0.5 text-xs font-medium text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">
                          <MessageSquareReply className="h-3 w-3" />
                          {TRIGGER_KIND_LABEL[rule.kind]}
                        </span>
                        <label className="flex items-center gap-1 text-xs text-zinc-500">
                          <input
                            type="checkbox"
                            checked={rule.enabled}
                            disabled={disabled}
                            onChange={(event) => {
                              updateEntry(botPubkey, (current) => {
                                if (!current) return null;
                                const nextRules = current.triggers.map((item, itemIndex) => (
                                  itemIndex === index
                                    ? { ...item, enabled: event.target.checked }
                                    : item
                                ));
                                return { ...current, triggers: nextRules };
                              });
                            }}
                          />
                          Rule active
                        </label>
                        <button
                          type="button"
                          disabled={disabled}
                          onClick={() => {
                            updateEntry(botPubkey, (current) => {
                              if (!current) return null;
                              const nextRules = current.triggers.filter((_, itemIndex) => itemIndex !== index);
                              if (nextRules.length === 0) {
                                return null;
                              }
                              return { ...current, triggers: nextRules };
                            });
                          }}
                          className="ml-auto rounded-md p-1 text-zinc-500 hover:bg-zinc-100 hover:text-rose-600 disabled:opacity-50 dark:hover:bg-zinc-800"
                          aria-label="Remove trigger rule"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      </div>

                      {rule.kind === "keyword" ? (
                        <Input
                          value={(rule.keywords ?? []).join(", ")}
                          disabled={disabled}
                          placeholder="Keywords (comma-separated)"
                          className={cn(mgmtFieldClass, "text-xs")}
                          onChange={(event) => {
                            const keywords = event.target.value
                              .split(",")
                              .map((part) => part.trim())
                              .filter(Boolean);
                            updateEntry(botPubkey, (current) => {
                              if (!current) return null;
                              const nextRules = current.triggers.map((item, itemIndex) => (
                                itemIndex === index ? { ...item, keywords } : item
                              ));
                              return { ...current, triggers: nextRules };
                            });
                          }}
                        />
                      ) : null}

                      {rule.kind === "schedule" ? (
                        <Input
                          type="number"
                          min={1}
                          max={1440}
                          value={rule.intervalMinutes ?? 60}
                          disabled={disabled}
                          placeholder="Interval minutes"
                          className={cn(mgmtFieldClass, "text-xs")}
                          onChange={(event) => {
                            const parsed = Number.parseInt(event.target.value, 10);
                            const intervalMinutes = Number.isFinite(parsed)
                              ? Math.max(1, Math.min(1440, parsed))
                              : 60;
                            updateEntry(botPubkey, (current) => {
                              if (!current) return null;
                              const nextRules = current.triggers.map((item, itemIndex) => (
                                itemIndex === index ? { ...item, intervalMinutes } : item
                              ));
                              return { ...current, triggers: nextRules };
                            });
                          }}
                        />
                      ) : null}

                      <Input
                        value={rule.reply}
                        disabled={disabled}
                        placeholder="Reply text ({{author}} {{content}} supported)"
                        className={cn(mgmtFieldClass, "text-xs")}
                        onChange={(event) => {
                          updateEntry(botPubkey, (current) => {
                            if (!current) return null;
                            const nextRules = current.triggers.map((item, itemIndex) => (
                              itemIndex === index ? { ...item, reply: event.target.value } : item
                            ));
                            return { ...current, triggers: nextRules };
                          });
                        }}
                      />
                    </div>
                  ))}

                  <div className="flex flex-wrap gap-2">
                    {(["keyword", "mention", "schedule"] as const).map((kind) => (
                      <Button
                        key={kind}
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={disabled}
                        className="gap-1 rounded-lg border border-sky-500/40 bg-white text-sky-900 hover:bg-sky-50 text-xs dark:border-sky-500/30 dark:bg-transparent dark:text-zinc-100 dark:hover:bg-sky-500/10"
                        onClick={() => {
                          updateEntry(botPubkey, (current) => ({
                            botPubkey,
                            enabled: true,
                            triggers: [...(current?.triggers ?? []), defaultRuleForKind(kind)],
                          }));
                        }}
                      >
                        <Plus className="h-3 w-3" />
                        Add {TRIGGER_KIND_LABEL[kind].toLowerCase()}
                      </Button>
                    ))}
                  </div>
                </div>
              ) : null}
            </div>
          );
        })}
      </div>
    </section>
  );
}
