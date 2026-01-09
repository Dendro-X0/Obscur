"use client";

import type React from "react";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { Button } from "../components/ui/button";
import { Card } from "../components/ui/card";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { PageShell } from "../components/page-shell";
import { IdentityCard } from "../components/identity-card";
import { parsePublicKeyInput } from "../lib/parse-public-key-input";
import { parseNip29GroupIdentifier } from "../lib/parse-nip29-group-identifier";
import { useIdentity } from "../lib/use-identity";
import useNavBadges from "../lib/use-nav-badges";
import type { PublicKeyHex } from "@dweb/crypto/public-key-hex";

type SearchMode = "user" | "group";

export default function SearchPage(): React.JSX.Element {
  const router = useRouter();
  const identity = useIdentity();
  const publicKeyHex: PublicKeyHex | null = (identity.state.publicKeyHex as PublicKeyHex | null) ?? null;
  const navBadges = useNavBadges({ publicKeyHex });
  const [mode, setMode] = useState<SearchMode>("user");
  const [pubkeyInput, setPubkeyInput] = useState<string>("");
  const [groupInput, setGroupInput] = useState<string>("");

  const trimmedPubkeyInput: string = pubkeyInput.trim();
  const parsedPubkey = useMemo(() => parsePublicKeyInput(trimmedPubkeyInput), [trimmedPubkeyInput]);
  const canOpenDm: boolean = parsedPubkey.ok;

  const trimmedGroupInput: string = groupInput.trim();
  const parsedGroup = useMemo(() => parseNip29GroupIdentifier(trimmedGroupInput), [trimmedGroupInput]);
  const canSearchGroup: boolean = parsedGroup.ok;

  const activeInputValue: string = mode === "user" ? pubkeyInput : groupInput;
  const setActiveInputValue = (value: string): void => {
    if (mode === "user") {
      setPubkeyInput(value);
      return;
    }
    setGroupInput(value);
  };

  const onSubmit = (): void => {
    if (mode === "user") {
      if (!parsedPubkey.ok) {
        return;
      }
      const encoded: string = encodeURIComponent(parsedPubkey.publicKeyHex);
      router.push(`/?pubkey=${encoded}`);
      return;
    }
    if (!parsedGroup.ok) {
      return;
    }
    const encoded: string = encodeURIComponent(parsedGroup.identifier);
    router.push(`/groups/${encoded}`);
  };

  return (
    <PageShell title="Search" navBadgeCounts={navBadges.navBadgeCounts}>
      <div className="mx-auto w-full max-w-3xl p-4">
        {identity.state.status !== "unlocked" ? (
          <div className="mb-4">
            <Card title="Identity locked" description="You can search, but you must unlock to chat." className="w-full">
              <div className="space-y-2">
                <div className="text-sm text-zinc-700 dark:text-zinc-300">Your private key stays local; unlocking enables encrypted DMs and group posting.</div>
                <IdentityCard />
              </div>
            </Card>
          </div>
        ) : null}

        <Card title="Search" description="Find people or groups quickly." className="w-full">
          <div className="space-y-4">
            <div className="flex flex-wrap gap-2">
              <Button type="button" variant={mode === "user" ? "primary" : "secondary"} onClick={() => setMode("user")}>
                User
              </Button>
              <Button type="button" variant={mode === "group" ? "primary" : "secondary"} onClick={() => setMode("group")}>
                Group
              </Button>
            </div>

            <div className="space-y-2">
              <Label htmlFor="search-input">{mode === "user" ? "Public key" : "Group identifier"}</Label>
              <Input
                id="search-input"
                value={activeInputValue}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setActiveInputValue(e.target.value)}
                placeholder={mode === "user" ? "npub... or 64-hex" : "groups.example.com'abcdef"}
                className={mode === "user" ? "font-mono" : "font-mono"}
              />
              {mode === "user" ? (
                !parsedPubkey.ok && trimmedPubkeyInput.length > 0 ? (
                  <div className="text-xs text-red-600 dark:text-red-400">Invalid public key (npub or 64-hex required).</div>
                ) : (
                  <div className="text-xs text-zinc-600 dark:text-zinc-400">Paste an exact key (no discovery yet).</div>
                )
              ) : !parsedGroup.ok && trimmedGroupInput.length > 0 ? (
                <div className="text-xs text-red-600 dark:text-red-400">{parsedGroup.error}</div>
              ) : (
                <div className="text-xs text-zinc-600 dark:text-zinc-400">
                  NIP-29 format is <span className="font-mono">host{"'"}group-id</span>
                </div>
              )}
            </div>

            <div className="flex flex-wrap gap-2">
              <Button type="button" disabled={mode === "user" ? !canOpenDm : !canSearchGroup} onClick={onSubmit}>
                {mode === "user" ? "Open DM" : "Open group"}
              </Button>
              {mode === "user" ? (
                <Button
                  type="button"
                  variant="secondary"
                  disabled={!parsedPubkey.ok}
                  onClick={() => {
                    if (!parsedPubkey.ok) {
                      return;
                    }
                    void navigator.clipboard.writeText(parsedPubkey.publicKeyHex);
                  }}
                >
                  Copy hex
                </Button>
              ) : null}
            </div>

            {mode === "user" && parsedPubkey.ok ? (
              <div className="rounded-xl border border-black/10 bg-zinc-50 p-3 text-xs dark:border-white/10 dark:bg-zinc-950/60">
                <div className="mb-1 font-medium">Normalized (hex)</div>
                <div className="break-all font-mono">{parsedPubkey.publicKeyHex}</div>
              </div>
            ) : null}
          </div>
        </Card>
      </div>
    </PageShell>
  );
}
