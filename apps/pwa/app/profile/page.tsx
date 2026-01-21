"use client";

import type React from "react";
import Link from "next/link";
import { useState } from "react";
import { Button } from "../components/ui/button";
import { Card } from "../components/ui/card";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { useIdentity } from "../lib/use-identity";
import { ProfileSettings } from "../components/invites/profile-settings";

type StoredProfile = Readonly<{ publicKey: string; username: string }>;

const PROFILE_STORAGE_PREFIX: string = "dweb.nostr.pwa.profile";

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null;

const isString = (value: unknown): value is string => typeof value === "string";

const createDefaultUsername = (publicKey: string): string => {
  if (!publicKey) {
    return "";
  }
  return `${publicKey.slice(0, 10)}…${publicKey.slice(-6)}`;
};

const getProfileStorageKey = (publicKeyHex: string): string => `${PROFILE_STORAGE_PREFIX}.${publicKeyHex}`;

const loadProfileForKey = (publicKeyHex: string): StoredProfile => {
  const trimmedPublicKey: string = publicKeyHex.trim();
  if (!trimmedPublicKey) {
    return { publicKey: "", username: "" };
  }
  if (typeof window === "undefined") {
    return { publicKey: trimmedPublicKey, username: createDefaultUsername(trimmedPublicKey) };
  }
  const raw: string | null = window.localStorage.getItem(getProfileStorageKey(trimmedPublicKey));
  if (!raw) {
    return { publicKey: trimmedPublicKey, username: createDefaultUsername(trimmedPublicKey) };
  }
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!isRecord(parsed)) {
      return { publicKey: trimmedPublicKey, username: createDefaultUsername(trimmedPublicKey) };
    }
    const publicKey: unknown = parsed.publicKey;
    const username: unknown = parsed.username;
    if (!isString(publicKey) || !isString(username)) {
      return { publicKey: trimmedPublicKey, username: createDefaultUsername(trimmedPublicKey) };
    }
    if (publicKey !== trimmedPublicKey) {
      return { publicKey: trimmedPublicKey, username: createDefaultUsername(trimmedPublicKey) };
    }
    return { publicKey, username };
  } catch {
    return { publicKey: trimmedPublicKey, username: createDefaultUsername(trimmedPublicKey) };
  }
};

const saveProfileForKey = (profile: StoredProfile): void => {
  if (typeof window === "undefined") {
    return;
  }
  const publicKey: string = profile.publicKey.trim();
  if (!publicKey) {
    return;
  }
  window.localStorage.setItem(getProfileStorageKey(publicKey), JSON.stringify(profile));
};

type ProfileFormProps = Readonly<{ publicKey: string }>;

const ProfileForm = (props: ProfileFormProps): React.JSX.Element => {
  const [usernameInput, setUsernameInput] = useState<string>(() => loadProfileForKey(props.publicKey).username);

  const onSave = (): void => {
    const trimmed: string = usernameInput.trim();
    const nextUsername: string = trimmed || createDefaultUsername(props.publicKey);
    setUsernameInput(nextUsername);
    saveProfileForKey({ publicKey: props.publicKey, username: nextUsername });
  };

  return (
    <Card title="User profile" description="Username is derived from your public key unless you override it locally." className="w-full">
      <div className="space-y-3">
        <div className="space-y-2">
          <Label>Public key</Label>
          <Input value={props.publicKey} readOnly className="font-mono text-xs" />
          <Button type="button" variant="secondary" onClick={(): void => void navigator.clipboard.writeText(props.publicKey)} disabled={!props.publicKey}>
            Copy
          </Button>
        </div>
        <div className="space-y-2">
          <Label>Username</Label>
          <Input value={usernameInput} onChange={(e: React.ChangeEvent<HTMLInputElement>): void => setUsernameInput(e.target.value)} placeholder="yourname" />
          <div className="flex gap-2">
            <Button type="button" onClick={onSave} disabled={!props.publicKey}>
              Save
            </Button>
            <Button
              type="button"
              variant="secondary"
              onClick={(): void => {
                const next: string = createDefaultUsername(props.publicKey);
                setUsernameInput(next);
                saveProfileForKey({ publicKey: props.publicKey, username: next });
              }}
              disabled={!props.publicKey}
            >
              Reset
            </Button>
          </div>
          <div className="text-xs text-zinc-600 dark:text-zinc-400">This is a local preference right now (not published to relays).</div>
        </div>
      </div>
    </Card>
  );
};

export default function ProfilePage(): React.JSX.Element {
  const identity = useIdentity();
  const publicKey: string = identity.state.publicKeyHex ?? identity.state.stored?.publicKeyHex ?? "";

  return (
    <div className="min-h-screen bg-zinc-50 text-zinc-900 dark:bg-black dark:text-zinc-100">
      <header className="flex items-center justify-between border-b border-black/10 bg-white px-4 py-3 dark:border-white/10 dark:bg-black">
        <div className="flex items-center gap-3">
          <h1 className="text-lg font-semibold tracking-tight">Profile</h1>
          <Link className="text-sm text-zinc-600 hover:underline dark:text-zinc-400" href="/">
            Back
          </Link>
        </div>
        <Link className="text-sm text-zinc-600 hover:underline dark:text-zinc-400" href="/settings">
          Settings
        </Link>
      </header>
      <div className="mx-auto max-w-2xl space-y-4 p-4">
        {publicKey ? <ProfileForm key={publicKey} publicKey={publicKey} /> : <ProfileForm key="_" publicKey="" />}
        
        {/* Invite System Profile Settings */}
        {publicKey && identity.state.status === "unlocked" && (
          <div className="space-y-4">
            <div className="border-t border-black/10 pt-4 dark:border-white/10">
              <h2 className="mb-2 text-lg font-semibold">Invite System Profile</h2>
              <p className="mb-4 text-sm text-zinc-600 dark:text-zinc-400">
                Manage your profile information and privacy settings for the invite system.
              </p>
            </div>
            <ProfileSettings />
          </div>
        )}
      </div>
    </div>
  );
}
