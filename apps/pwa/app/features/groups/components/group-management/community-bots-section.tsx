"use client";

import React from "react";
import { Bot, Plus, X } from "lucide-react";
import { Button } from "@/app/components/ui/button";
import { Input } from "@/app/components/ui/input";
import { Label } from "@/app/components/ui/label";
import { cn } from "@/app/lib/cn";
import type { PublicKeyHex } from "@dweb/crypto/public-key-hex";
import { parseCommunityBotPubkeyInput } from "../../services/community-bot-policy";
import { mgmtFieldClass, mgmtSectionClass } from "./constants";

export function CommunityBotsSection({
    botPubkeys,
    onChange,
    disabled,
    requiresGovernanceProposal = false,
}: Readonly<{
    botPubkeys: ReadonlyArray<PublicKeyHex>;
    onChange: (next: ReadonlyArray<PublicKeyHex>) => void;
    disabled?: boolean;
    requiresGovernanceProposal?: boolean;
}>): React.JSX.Element {
    const [draft, setDraft] = React.useState("");
    const [inputError, setInputError] = React.useState<string | null>(null);

    const handleAdd = (): void => {
        const parsed = parseCommunityBotPubkeyInput(draft);
        if (!parsed) {
            setInputError("Enter a valid 64-character hex public key.");
            return;
        }
        if (botPubkeys.includes(parsed)) {
            setInputError("This bot is already registered.");
            return;
        }
        setInputError(null);
        onChange([...botPubkeys, parsed]);
        setDraft("");
    };

    const handleRemove = (pubkey: PublicKeyHex): void => {
        onChange(botPubkeys.filter((entry) => entry !== pubkey));
    };

    return (
        <section className={mgmtSectionClass} id="community-bots-descriptor">
            <div className="flex items-start gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-violet-100 text-violet-700 dark:bg-violet-500/15 dark:text-violet-300">
                    <Bot className="h-5 w-5" />
                </div>
                <div className="min-w-0 flex-1 space-y-1">
                    <Label className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
                        Outbound bots (B1)
                    </Label>
                    <p className="text-xs leading-relaxed text-zinc-500">
                        Register bot npubs allowed to publish announcements on this managed workspace.
                        Unlisted authors are not shown when at least one bot is registered.
                        {requiresGovernanceProposal
                            ? " Changes apply after members approve the governance proposal (Propose changes)."
                            : ""}
                    </p>
                </div>
            </div>

            {botPubkeys.length > 0 ? (
                <ul className="mt-4 space-y-2">
                    {botPubkeys.map((pubkey) => (
                        <li
                            key={pubkey}
                            className="flex items-center gap-2 rounded-lg border border-zinc-200 bg-white/80 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-900/60"
                        >
                            <code className="min-w-0 flex-1 truncate text-xs text-zinc-600 dark:text-zinc-300">
                                {pubkey}
                            </code>
                            <button
                                type="button"
                                disabled={disabled}
                                onClick={() => handleRemove(pubkey)}
                                className="shrink-0 rounded-md p-1 text-zinc-500 hover:bg-zinc-100 hover:text-rose-600 disabled:opacity-50 dark:hover:bg-zinc-800"
                                aria-label="Remove bot"
                            >
                                <X className="h-4 w-4" />
                            </button>
                        </li>
                    ))}
                </ul>
            ) : (
                <p className="mt-3 text-xs text-zinc-500">No bots registered — all members can post (legacy permissive mode).</p>
            )}

            <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-start">
                <Input
                    value={draft}
                    onChange={(event) => {
                        setDraft(event.target.value);
                        setInputError(null);
                    }}
                    disabled={disabled}
                    placeholder="Bot public key (hex)"
                    className={cn(mgmtFieldClass, "font-mono text-xs")}
                    aria-invalid={inputError ? true : undefined}
                />
                <Button
                    type="button"
                    variant="outline"
                    disabled={disabled || draft.trim().length === 0}
                    onClick={handleAdd}
                    className="shrink-0 gap-2 rounded-lg border border-violet-500/40 bg-white text-violet-900 hover:bg-violet-50 dark:border-violet-500/30 dark:bg-transparent dark:text-zinc-100 dark:hover:bg-violet-500/10"
                >
                    <Plus className="h-4 w-4" />
                    Add bot
                </Button>
            </div>
            {inputError ? (
                <p className="text-xs text-rose-500">{inputError}</p>
            ) : null}
        </section>
    );
}
