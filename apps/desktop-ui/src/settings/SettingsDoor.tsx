import { useState, type FormEvent } from "react";
import {
  readViteSettingsResidue,
  removeViteSettingsRelay,
  upsertViteSettingsRelay,
  writeViteSettingsResidue,
} from "./vite-settings-residue";

/**
 * Cut 14.3 — thin Vite Settings door (T2 residue).
 * ≠ Continuity Pass · Soft L3 paused · ≠ apps/pwa Settings · ≠ live mesh.
 */

export type SettingsDoorProps = Readonly<{
  profileId: string;
}>;

export function SettingsDoor(props: SettingsDoorProps) {
  const initial = readViteSettingsResidue(props.profileId);
  const [displayName, setDisplayName] = useState(initial.displayName);
  const [relayUrl, setRelayUrl] = useState("");
  const [hideReadReceipts, setHideReadReceipts] = useState(
    initial.privacySettings.hideReadReceipts === true,
  );
  const [compactUi, setCompactUi] = useState(initial.uiSettings.compact === true);
  const [residue, setResidue] = useState(initial);
  const [status, setStatus] = useState<string | null>(null);

  const persistIdentityPrivacy = (event: FormEvent) => {
    event.preventDefault();
    const next = writeViteSettingsResidue(props.profileId, {
      ...readViteSettingsResidue(props.profileId),
      displayName,
      privacySettings: { hideReadReceipts },
      uiSettings: { compact: compactUi },
    });
    setResidue(next);
    setStatus("Settings saved · T2 residue (≠ Continuity Pass)");
  };

  const onAddRelay = (event: FormEvent) => {
    event.preventDefault();
    const url = relayUrl.trim();
    if (!url) {
      setStatus("Relay URL required");
      return;
    }
    const next = upsertViteSettingsRelay(props.profileId, { url, enabled: true });
    setResidue(next);
    setRelayUrl("");
    setStatus(`Relay added · local residue only (≠ live mesh)`);
  };

  const onRemoveRelay = (url: string) => {
    const next = removeViteSettingsRelay(props.profileId, url);
    setResidue(next);
    setStatus(`Relay removed · ${url}`);
  };

  return (
    <section className="settings-door" data-testid="settings-door">
      <header>
        <h2>Settings</h2>
        <p className="lede">
          Thin Vite face · Continuity T2 residue — Soft L3 paused · Continuity Pass not claimed ·
          relays are local only (≠ live mesh).
        </p>
      </header>

      <form className="auth-form" onSubmit={persistIdentityPrivacy}>
        <h3>Identity</h3>
        <label className="auth-label">
          Display name
          <input
            className="auth-input"
            type="text"
            data-testid="settings-display-name"
            value={displayName}
            onChange={(event) => setDisplayName(event.target.value)}
            placeholder="Optional display name"
          />
        </label>

        <h3>Privacy / UI</h3>
        <label className="settings-check">
          <input
            type="checkbox"
            data-testid="settings-hide-read-receipts"
            checked={hideReadReceipts}
            onChange={(event) => setHideReadReceipts(event.target.checked)}
          />
          Prefer hide read receipts (local preference · ≠ Soft L3 Fixed)
        </label>
        <label className="settings-check">
          <input
            type="checkbox"
            data-testid="settings-compact-ui"
            checked={compactUi}
            onChange={(event) => setCompactUi(event.target.checked)}
          />
          Compact UI preference
        </label>
        <button type="submit" className="auth-button" data-testid="settings-save">
          Save settings
        </button>
      </form>

      <form className="auth-form" onSubmit={onAddRelay}>
        <h3>Network (local relay list)</h3>
        <p className="continuity-door-sub">
          Stored for Continuity T2 export — not a live relay pool claim · ≠ Tor Verified.
        </p>
        <label className="auth-label">
          Relay URL
          <input
            className="auth-input"
            type="url"
            data-testid="settings-relay-url"
            value={relayUrl}
            onChange={(event) => setRelayUrl(event.target.value)}
            placeholder="wss://relay.example"
          />
        </label>
        <button type="submit" className="auth-button" data-testid="settings-relay-add">
          Add relay
        </button>
        <ul data-testid="settings-relay-list">
          {residue.relayList.length === 0 ? (
            <li className="muted">No local relays</li>
          ) : (
            residue.relayList.map((row) => (
              <li key={row.url}>
                <span>{row.url}{row.enabled ? "" : " · off"}</span>
                <button
                  type="button"
                  data-testid={`settings-relay-remove-${row.url}`}
                  onClick={() => onRemoveRelay(row.url)}
                >
                  Remove
                </button>
              </li>
            ))
          )}
        </ul>
      </form>

      {status ? (
        <p className="pt-status" data-testid="settings-status">{status}</p>
      ) : null}
    </section>
  );
}
