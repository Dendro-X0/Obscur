import { useMemo, useState, type FormEvent, type ReactNode } from "react";
import type { DeviceUnlockPort } from "@dweb/auth/ports/device-unlock-port";
import type { Passphrase } from "@dweb/crypto/passphrase";
import type { PublicKeyHex } from "@dweb/crypto/public-key-hex";
import { Button } from "@dweb/ui-kit/button";
import { Input } from "@dweb/ui-kit/input";
import { Label } from "@dweb/ui-kit/label";
import {
  beginAuthDoorUnlock,
  createLockedAuthDoorSession,
  clearAuthDoorBindPending,
  isAuthDoorShellReady,
  lockAuthDoorSession,
  unlockAuthDoorWithPassphrase,
  type AuthDoorSession,
} from "./auth-door-session";
import { LAB_AUTH_DOOR_DEFAULTS } from "./lab-device-unlock-port";
import { REMASTER_AUTH_META } from "../remaster-honesty-copy";
import {
  createVitePassphraseIdentity,
  readViteIdentityRecord,
} from "./vite-passphrase-device-unlock";

/**
 * Cut 3 / 11.2 / OB2 — Vite AuthDoor (unlock + empty-device create).
 * Soft L3 paused · Continuity Pass not claimed · unlock ≠ Continuity.
 * OB2: @dweb/ui-kit primitives · remaster DeviceUnlockPort only · no pwa features.
 */

export type AuthDoorProps = Readonly<{
  deviceUnlock: DeviceUnlockPort;
  profileId?: string;
  expectedPublicKeyHex?: string;
  /** Lab-only: simulate Single-door Slice A bind pending after unlock. */
  simulateBindPendingAfterUnlock?: boolean;
  /** Cut 3.3 — shell mounts only when resolveAuthShellReady is true. */
  renderShell?: (params: Readonly<{
    session: AuthDoorSession;
    onLock: () => void;
  }>) => ReactNode;
}>;

export function AuthDoor(props: AuthDoorProps) {
  const profileId = props.profileId ?? LAB_AUTH_DOOR_DEFAULTS.profileId;
  const stored = readViteIdentityRecord(profileId);
  const initialExpected = (stored?.publicKeyHex
    ?? props.expectedPublicKeyHex
    ?? "") as PublicKeyHex;

  const [session, setSession] = useState<AuthDoorSession>(() => (
    createLockedAuthDoorSession({
      profileId,
      expectedPublicKeyHex: initialExpected,
    })
  ));
  const [passphrase, setPassphrase] = useState("");
  const [confirmPassphrase, setConfirmPassphrase] = useState("");
  const [createBusy, setCreateBusy] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [mode, setMode] = useState<"unlock" | "create">(() => (
    stored ? "unlock" : "create"
  ));
  const shellReady = useMemo(() => isAuthDoorShellReady(session), [session]);
  const hasIdentity = Boolean(readViteIdentityRecord(profileId) || session.expectedPublicKeyHex);

  const onUnlock = async (event: FormEvent) => {
    event.preventDefault();
    setSession((current) => beginAuthDoorUnlock(current));
    const next = await unlockAuthDoorWithPassphrase({
      session,
      deviceUnlock: props.deviceUnlock,
      passphrase: passphrase as Passphrase,
      devicePasswordBindPendingAfterUnlock: props.simulateBindPendingAfterUnlock === true,
    });
    setSession(next);
    if (isAuthDoorShellReady(next)) {
      setPassphrase("");
    }
  };

  const onCreate = async (event: FormEvent) => {
    event.preventDefault();
    setCreateError(null);
    if (passphrase.trim() !== confirmPassphrase.trim()) {
      setCreateError("Passphrases do not match");
      return;
    }
    setCreateBusy(true);
    try {
      const record = await createVitePassphraseIdentity({
        profileId,
        passphrase: passphrase as Passphrase,
      });
      const locked = createLockedAuthDoorSession({
        profileId,
        expectedPublicKeyHex: record.publicKeyHex as PublicKeyHex,
      });
      setSession(beginAuthDoorUnlock(locked));
      const unlocked = await unlockAuthDoorWithPassphrase({
        session: locked,
        deviceUnlock: props.deviceUnlock,
        passphrase: passphrase as Passphrase,
        devicePasswordBindPendingAfterUnlock: false,
      });
      setSession(unlocked);
      setPassphrase("");
      setConfirmPassphrase("");
      setMode("unlock");
    } catch (error) {
      setCreateError(error instanceof Error ? error.message : "Create account failed");
      setSession((current) => ({
        ...current,
        phase: "locked",
        errorMessage: null,
      }));
    } finally {
      setCreateBusy(false);
    }
  };

  if (shellReady) {
    const onLock = (): void => {
      setSession((current) => lockAuthDoorSession(current));
    };
    if (props.renderShell) {
      return (
        <div data-testid="auth-door-shell-ready">
          {props.renderShell({ session, onLock })}
        </div>
      );
    }
    return (
      <section className="auth-panel" data-testid="auth-door-shell-ready">
        <p className="brand">Obscur</p>
        <h1>Shell ready</h1>
        <p className="lede">
          Unlock gate matched AuthGateway (`resolveAuthShellReady`).
        </p>
        <p className="meta">profile · {session.profileId}</p>
        <div className="auth-actions">
          <Button type="button" variant="outline" onClick={onLock}>
            Lock
          </Button>
        </div>
      </section>
    );
  }

  if (session.phase === "bind_pending") {
    return (
      <section className="auth-panel" data-testid="auth-door-bind-pending">
        <p className="brand">Obscur</p>
        <h1>Device password bind</h1>
        <p className="lede">
          Identity unlocked; PDK bind still pending — same Single-door Slice A gate as
          AuthGateway. Shell stays closed until bind clears.
        </p>
        <div className="auth-actions">
          <Button
            type="button"
            onClick={() => setSession((current) => clearAuthDoorBindPending(current))}
          >
            Complete bind (lab)
          </Button>
        </div>
      </section>
    );
  }

  if (mode === "create" || !hasIdentity) {
    return (
      <section className="auth-panel" data-testid="auth-door-create">
        <p className="brand">Obscur</p>
        <h1>Create account</h1>
        <p className="lede">
          Empty device — choose a device passphrase. Unlock opens this device only;
          Continuity is a separate Plane 3 path.
        </p>
        <form className="auth-form" onSubmit={(event) => void onCreate(event)}>
          <div className="auth-field">
            <Label htmlFor="auth-create-passphrase">Device passphrase</Label>
            <Input
              id="auth-create-passphrase"
              type="password"
              autoComplete="new-password"
              data-testid="auth-create-passphrase"
              value={passphrase}
              onChange={(event) => setPassphrase(event.target.value)}
              disabled={createBusy}
              required
              minLength={8}
            />
          </div>
          <div className="auth-field">
            <Label htmlFor="auth-create-passphrase-confirm">Confirm passphrase</Label>
            <Input
              id="auth-create-passphrase-confirm"
              type="password"
              autoComplete="new-password"
              data-testid="auth-create-passphrase-confirm"
              value={confirmPassphrase}
              onChange={(event) => setConfirmPassphrase(event.target.value)}
              disabled={createBusy}
              required
              minLength={8}
            />
          </div>
          {createError ? (
            <p className="auth-error" role="alert">{createError}</p>
          ) : null}
          <div className="auth-actions">
            <Button
              type="submit"
              disabled={createBusy || passphrase.length < 8}
              data-testid="auth-create-submit"
            >
              {createBusy ? "Creating…" : "Create account"}
            </Button>
          </div>
        </form>
        {stored ? (
          <div className="auth-actions">
            <Button
              type="button"
              variant="outline"
              onClick={() => setMode("unlock")}
            >
              Back to unlock
            </Button>
          </div>
        ) : null}
        <p className="meta">{REMASTER_AUTH_META}</p>
      </section>
    );
  }

  return (
    <section className="auth-panel" data-testid="auth-door-locked">
      <p className="brand">Obscur</p>
      <h1>Unlock</h1>
      <p className="lede">
        Device passphrase unlocks this profile on this machine. Unlock does not restore
        a wiped PC — use Continuity after shell ready.
      </p>
      <form className="auth-form" onSubmit={(event) => void onUnlock(event)}>
        <div className="auth-field">
          <Label htmlFor="auth-unlock-passphrase">Passphrase</Label>
          <Input
            id="auth-unlock-passphrase"
            type="password"
            autoComplete="current-password"
            value={passphrase}
            onChange={(event) => setPassphrase(event.target.value)}
            disabled={session.phase === "unlocking"}
            required
          />
        </div>
        {session.errorMessage ? (
          <p className="auth-error" role="alert">{session.errorMessage}</p>
        ) : null}
        <div className="auth-actions">
          <Button
            type="submit"
            disabled={session.phase === "unlocking" || passphrase.length === 0}
          >
            {session.phase === "unlocking" ? "Unlocking…" : "Unlock"}
          </Button>
        </div>
      </form>
      <div className="auth-actions">
        <Button
          type="button"
          variant="outline"
          data-testid="auth-switch-create"
          onClick={() => setMode("create")}
        >
          Create new account instead
        </Button>
      </div>
      <p className="meta">{REMASTER_AUTH_META}</p>
    </section>
  );
}
