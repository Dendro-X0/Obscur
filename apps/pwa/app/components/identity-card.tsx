"use client";

import { useMemo, useState } from "react";
import type { Passphrase } from "@dweb/crypto/passphrase";
import { useIdentity } from "../lib/use-identity";
import { Button } from "./ui/button";
import { Card } from "./ui/card";
import { Input } from "./ui/input";
import { Label } from "./ui/label";

export const IdentityCard = () => {
  const [passphrase, setPassphrase] = useState<string>("");
  const identity = useIdentity();
  const state = identity.state;
  const canSubmit: boolean = useMemo(() => passphrase.trim().length >= 6, [passphrase]);
  const onCreate = async (): Promise<void> => {
    if (!canSubmit) {
      return;
    }
    await identity.createIdentity({ passphrase: passphrase as Passphrase });
  };

  const onUnlock = async (): Promise<void> => {
    if (!canSubmit) {
      return;
    }
    await identity.unlockIdentity({ passphrase: passphrase as Passphrase });
  };

  const onLock = (): void => {
    setPassphrase("");
    identity.lockIdentity();
  };

  const onForget = async (): Promise<void> => {
    await identity.forgetIdentity();
    setPassphrase("");
  };

  if (state.status === "loading") {
    return (
      <Card title="Identity" description="Your Nostr keypair, encrypted and stored locally.">
        <div>Loading…</div>
      </Card>
    );
  }

  if (state.status === "error") {
    return (
      <Card tone="danger" title="Identity" description="Your Nostr keypair, encrypted and stored locally.">
        <div className="wrap-break-word">{state.error}</div>
      </Card>
    );
  }

  return (
    <Card title="Identity" description="Your Nostr keypair, encrypted and stored locally.">
      <div>
        <Label>Passphrase (min 6 chars)</Label>
        <Input value={passphrase} onChange={(e) => setPassphrase(e.target.value)} type="password" placeholder="Enter passphrase" />
      </div>
      <div className="mt-3 flex flex-col gap-2 sm:flex-row">
        <Button type="button" onClick={() => void onCreate()} disabled={!canSubmit}>
          Create
        </Button>
        <Button type="button" variant="secondary" onClick={() => void onUnlock()} disabled={!canSubmit || !state.stored}>
          Unlock
        </Button>
        <Button type="button" variant="secondary" onClick={onLock} disabled={state.status !== "unlocked"}>
          Lock
        </Button>
        <Button type="button" variant="danger" onClick={() => void onForget()}>
          Forget
        </Button>
      </div>
      <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div>
          <div className="text-xs font-medium text-zinc-600 dark:text-zinc-400">Status</div>
          <div className="mt-1 font-semibold tracking-tight">{state.status}</div>
        </div>
        <div>
          <div className="text-xs font-medium text-zinc-600 dark:text-zinc-400">Stored</div>
          <div className="mt-1 font-semibold tracking-tight">{state.stored ? "yes" : "no"}</div>
        </div>
      </div>
      {state.publicKeyHex ? (
        <div className="mt-4">
          <div className="text-xs font-medium text-zinc-600 dark:text-zinc-400">Public key (hex)</div>
          <div className="mt-2 rounded-xl border border-black/10 bg-white px-3 py-2 font-mono text-xs wrap-break-word dark:border-white/10 dark:bg-zinc-950/60">
            {state.publicKeyHex}
          </div>
        </div>
      ) : null}
    </Card>
  );
};
