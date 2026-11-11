import { useState, type FormEvent } from "react";
import {
  clearVitePrivateDcSession,
  readVitePrivateDcSession,
  writeVitePrivateDcSession,
} from "./vite-private-dc-session";

/**
 * Cut 11.3 — configure private home session (H-dc / Continuity M2 transport).
 * ≠ Continuity Pass · Soft L3 paused.
 */

export type PrivateHomeSessionDoorProps = Readonly<{
  profileId: string;
}>;

export function PrivateHomeSessionDoor(props: PrivateHomeSessionDoorProps) {
  const existing = readVitePrivateDcSession(props.profileId);
  const [baseUrl, setBaseUrl] = useState(existing?.baseUrl ?? "");
  const [bearerToken, setBearerToken] = useState(existing?.bearerToken ?? "");
  const [status, setStatus] = useState<string | null>(null);

  const onSave = (event: FormEvent) => {
    event.preventDefault();
    try {
      const saved = writeVitePrivateDcSession(props.profileId, {
        baseUrl,
        bearerToken: bearerToken.trim() || undefined,
      });
      setBaseUrl(saved.baseUrl);
      setBearerToken(saved.bearerToken ?? "");
      setStatus(`Home saved · ${saved.baseUrl}`);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Save failed");
    }
  };

  const onClear = () => {
    clearVitePrivateDcSession(props.profileId);
    setBaseUrl("");
    setBearerToken("");
    setStatus("Home session cleared");
  };

  return (
    <section className="home-session-door" data-testid="private-home-session-door">
      <header>
        <h2>Private home</h2>
        <p className="lede">
          Configure your private home for sealed send and Continuity publish — transport
          only · ≠ Continuity Pass.
        </p>
      </header>
      <form className="auth-form" onSubmit={onSave}>
        <label className="auth-label">
          Base URL
          <input
            className="auth-input"
            type="url"
            data-testid="home-session-base-url"
            placeholder="http://127.0.0.1:8791"
            value={baseUrl}
            onChange={(event) => setBaseUrl(event.target.value)}
            required
          />
        </label>
        <label className="auth-label">
          Bearer token (optional)
          <input
            className="auth-input"
            type="password"
            data-testid="home-session-bearer"
            value={bearerToken}
            onChange={(event) => setBearerToken(event.target.value)}
            autoComplete="off"
          />
        </label>
        <div className="continuity-actions">
          <button type="submit" className="auth-button" data-testid="home-session-save">
            Save home session
          </button>
          <button
            type="button"
            className="auth-button secondary"
            data-testid="home-session-clear"
            onClick={onClear}
          >
            Clear
          </button>
        </div>
      </form>
      {status ? (
        <p className="pt-status" data-testid="home-session-status">{status}</p>
      ) : null}
    </section>
  );
}
