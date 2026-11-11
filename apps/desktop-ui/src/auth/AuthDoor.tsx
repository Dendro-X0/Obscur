import { useMemo, useState, type FormEvent, type ReactNode } from "react";
import type { DeviceUnlockPort } from "@dweb/auth/ports/device-unlock-port";
import type { Passphrase } from "@dweb/crypto/passphrase";
import type { PublicKeyHex } from "@dweb/crypto/public-key-hex";
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
 * Cut 3 / 11.2 — Vite AuthDoor (unlock + empty-device create).
 * Soft L3 paused · Continuity Pass not claimed · unlock ≠ Continuity.
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
        <button type="button" className="auth-button secondary" onClick={onLock}>
          Lock
        </button>
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
        <button
          type="button"
          className="auth-button"
          onClick={() => setSession((current) => clearAuthDoorBindPending(current))}
        >
          Complete bind (lab)
        </button>
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
          <label className="auth-label">
            Device passphrase
            <input
              className="auth-input"
              type="password"
              autoComplete="new-password"
              data-testid="auth-create-passphrase"
              value={passphrase}
              onChange={(event) => setPassphrase(event.target.value)}
              disabled={createBusy}
              required
              minLength={8}
            />
          </label>
          <label className="auth-label">
            Confirm passphrase
            <input
              className="auth-input"
              type="password"
              autoComplete="new-password"
              data-testid="auth-create-passphrase-confirm"
              value={confirmPassphrase}
              onChange={(event) => setConfirmPassphrase(event.target.value)}
              disabled={createBusy}
              required
              minLength={8}
            />
          </label>
          {createError ? (
            <p className="auth-error" role="alert">{createError}</p>
          ) : null}
          <button
            type="submit"
            className="auth-button"
            disabled={createBusy || passphrase.length < 8}
            data-testid="auth-create-submit"
          >
            {createBusy ? "Creating…" : "Create account"}
          </button>
        </form>
        {stored ? (
          <button
            type="button"
            className="auth-button secondary"
            onClick={() => setMode("unlock")}
          >
            Back to unlock
          </button>
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
        <label className="auth-label">
          Passphrase
          <input
            className="auth-input"
            type="password"
            autoComplete="current-password"
            value={passphrase}
            onChange={(event) => setPassphrase(event.target.value)}
            disabled={session.phase === "unlocking"}
            required
          />
        </label>
        {session.errorMessage ? (
          <p className="auth-error" role="alert">{session.errorMessage}</p>
        ) : null}
        <button
          type="submit"
          className="auth-button"
          disabled={session.phase === "unlocking" || passphrase.length === 0}
        >
          {session.phase === "unlocking" ? "Unlocking…" : "Unlock"}
        </button>
      </form>
      <button
        type="button"
        className="auth-button secondary"
        data-testid="auth-switch-create"
        onClick={() => setMode("create")}
      >
        Create new account instead
      </button>
      <p className="meta">{REMASTER_AUTH_META}</p>
    </section>
  );
}
