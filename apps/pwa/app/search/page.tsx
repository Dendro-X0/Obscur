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
import { parsePublicKeyInput } from "@/app/features/profile/utils/parse-public-key-input";
import { parseNip29GroupIdentifier } from "@/app/features/groups/utils/parse-nip29-group-identifier";
import { useIdentity } from "@/app/features/auth/hooks/use-identity";
import { useRelayList } from "@/app/features/relays/hooks/use-relay-list";
import { useRelayPool } from "@/app/features/relays/hooks/use-relay-pool";
import useNavBadges from "@/app/features/main-shell/hooks/use-nav-badges";
import type { PublicKeyHex } from "@dweb/crypto/public-key-hex";
import { Loader2, Search, User as UserIcon } from "lucide-react";

type SearchMode = "user" | "group";

export default function SearchPage(): React.JSX.Element {
  const router = useRouter();
  const identity = useIdentity();
  const publicKeyHex: PublicKeyHex | null = (identity.state.publicKeyHex as PublicKeyHex | null) ?? null;
  const navBadges = useNavBadges({ publicKeyHex });
  const relayList = useRelayList({ publicKeyHex });
  const enabledRelayUrls = useMemo(() => relayList.state.relays.filter((r: { enabled: boolean }) => r.enabled).map((r: { url: string }) => r.url), [relayList.state.relays]);
  const pool = useRelayPool(enabledRelayUrls);

  const [mode, setMode] = useState<SearchMode>("user");
  const [pubkeyInput, setPubkeyInput] = useState<string>("");
  const [groupInput, setGroupInput] = useState<string>("");
  const [isSearching, setIsSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<Array<{ pubkey: string, name: string, display_name?: string, picture?: string }>>([]);

  const trimmedPubkeyInput: string = pubkeyInput.trim();
  const parsedPubkey = useMemo(() => parsePublicKeyInput(trimmedPubkeyInput), [trimmedPubkeyInput]);

  const handleSearchByName = async (): Promise<void> => {
    if (!trimmedPubkeyInput || parsedPubkey.ok) return;

    setIsSearching(true);
    setSearchResults([]);

    const subId = Math.random().toString(36).substring(7);
    // Removed broken invite code search. "OBSCUR-" codes are local and not queryable on relays via #code.
    // Use NIP-50 search for text.
    const filter: Readonly<{ kinds: number[]; limit: number; search: string }> = { kinds: [0], limit: 10, search: trimmedPubkeyInput };
    const req = JSON.stringify(["REQ", subId, filter]);

    void pool.broadcastEvent(req);

    const cleanup = pool.subscribeToMessages(({ message }: { message: string }) => {
      try {
        const parsed = JSON.parse(message);
        if (parsed[0] === "EVENT" && parsed[1] === subId) {
          const event = parsed[2];
          const content = JSON.parse(event.content);
          setSearchResults(prev => {
            if (prev.some(r => r.pubkey === event.pubkey)) return prev;
            return [...prev, {
              pubkey: event.pubkey,
              name: content.name || content.display_name || "Unknown",
              display_name: content.display_name,
              picture: content.picture
            }];
          });
        }
        if (parsed[0] === "EOSE" && parsed[1] === subId) {
          setIsSearching(false);
        }
      } catch (e) {
        // Ignore parsing errors
      }
    });

    // Auto-stop after 5 seconds
    setTimeout(() => {
      pool.sendToOpen(JSON.stringify(["CLOSE", subId]));
      cleanup();
      setIsSearching(false);
    }, 5000);
  };

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
      if (parsedPubkey.ok) {
        const encoded: string = encodeURIComponent(parsedPubkey.publicKeyHex);
        router.push(`/?pubkey=${encoded}`);
      } else {
        void handleSearchByName();
      }
      return;
    }
    if (!parsedGroup.ok) {
      return;
    }
    const encoded: string = encodeURIComponent(parsedGroup.identifier);
    router.push(`/groups/${encoded}`);
  };

  const canOpenDm: boolean = trimmedPubkeyInput.length > 0;

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
              <Label htmlFor="search-input">{mode === "user" ? "Public key or Name" : "Group identifier"}</Label>
              <Input
                id="search-input"
                value={activeInputValue}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setActiveInputValue(e.target.value)}
                placeholder={mode === "user" ? "npub... or name" : "groups.example.com'abcdef"}
                className={mode === "user" ? "font-mono" : "font-mono"}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    onSubmit();
                  }
                }}
              />
              {mode === "user" ? (
                !parsedPubkey.ok && trimmedPubkeyInput.length > 0 ? (
                  <div className="text-xs text-zinc-600 dark:text-zinc-400">Search for users by name.</div>
                ) : (
                  <div className="text-xs text-zinc-600 dark:text-zinc-400">Paste an exact key or type a name.</div>
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
                {mode === "user" ? (parsedPubkey.ok ? "Open DM" : "Search") : "Open group"}
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
              <div className="space-y-2">
                <div className="rounded-xl border border-black/10 bg-zinc-50 p-3 text-xs dark:border-white/10 dark:bg-zinc-950/60">
                  <div className="mb-1 font-medium">Normalized (hex)</div>
                  <div className="break-all font-mono">{parsedPubkey.publicKeyHex}</div>
                </div>
                <div className="p-3 text-xs text-amber-600 bg-amber-50 rounded-xl dark:text-amber-400 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/50">
                  Note: If this user is new or hasn&apos;t published a profile, they might not appear in search results, but you can still start a chat.
                </div>
              </div>
            ) : null}

            {mode === "user" && (searchResults.length > 0 || isSearching) && (
              <div className="space-y-4 pt-4 border-t border-black/10 dark:border-white/10">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-medium">Search Results</h3>
                  {isSearching && <Loader2 className="h-4 w-4 animate-spin text-zinc-500" />}
                </div>

                <div className="grid gap-2">
                  {searchResults.map((result) => (
                    <button
                      key={result.pubkey}
                      onClick={() => router.push(`/?pubkey=${encodeURIComponent(result.pubkey)}`)}
                      className="flex items-center justify-between gap-3 rounded-xl border border-black/10 p-3 text-left hover:bg-zinc-50 dark:border-white/10 dark:hover:bg-zinc-900"
                    >
                      <div className="flex items-center gap-3 overflow-hidden">
                        {result.picture ? (
                          <img src={result.picture} alt="" className="h-10 w-10 shrink-0 rounded-full object-cover" />
                        ) : (
                          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-zinc-200 dark:bg-zinc-800">
                            <UserIcon className="h-5 w-5 text-zinc-500" />
                          </div>
                        )}
                        <div className="min-w-0">
                          <div className="truncate font-medium">@{result.name}</div>
                          {result.display_name && (
                            <div className="truncate text-xs text-zinc-500">{result.display_name}</div>
                          )}
                          <div className="truncate font-mono text-[10px] text-zinc-400">
                            {result.pubkey.slice(0, 16)}...
                          </div>
                        </div>
                      </div>
                      <Search className="h-4 w-4 shrink-0 text-zinc-400" />
                    </button>
                  ))}
                  {!isSearching && searchResults.length === 0 && (
                    <div className="py-4 text-center text-sm text-zinc-500 font-medium">
                      No users found. Try an exact match or npub.
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </Card>
      </div>
    </PageShell>
  );
}
