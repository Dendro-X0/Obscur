import { useState, type FormEvent } from "react";
import { Button } from "@dweb/ui-kit/button";
import { Input } from "@dweb/ui-kit/input";
import { Label } from "@dweb/ui-kit/label";
import {
  readViteSettingsResidue,
  removeViteSettingsRelay,
  upsertViteSettingsRelay,
  writeViteSettingsResidue,
} from "./vite-settings-residue";

/**
 * Cut 14.3 / OB4 — Settings product door (T2 residue on remaster ports).
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
    <section className="settings-door product-door" data-testid="settings-door">
      <header>
        <h2>Settings</h2>
        <p className="lede">
          Profile preferences and a local relay list for Continuity export.
          Soft L3 paused · Continuity Pass not claimed · relays ≠ live mesh · ≠ Tor Verified.
        </p>
      </header>

      <form className="auth-form" onSubmit={persistIdentityPrivacy}>
        <h3>Identity</h3>
        <div className="auth-field">
          <Label htmlFor="settings-display-name">Display name</Label>
          <Input
            id="settings-display-name"
            type="text"
            data-testid="settings-display-name"
            value={displayName}
            onChange={(event) => setDisplayName(event.target.value)}
            placeholder="Optional display name"
          />
        </div>

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
        <div className="auth-actions">
          <Button type="submit" data-testid="settings-save">
            Save settings
          </Button>
        </div>
      </form>

      <form className="auth-form" onSubmit={onAddRelay}>
        <h3>Network (local relay list)</h3>
        <p className="continuity-door-sub">
          Stored for Continuity export — not a live relay pool claim · ≠ Tor Verified.
        </p>
        <div className="auth-field">
          <Label htmlFor="settings-relay-url">Relay URL</Label>
          <Input
            id="settings-relay-url"
            type="url"
            data-testid="settings-relay-url"
            value={relayUrl}
            onChange={(event) => setRelayUrl(event.target.value)}
            placeholder="wss://relay.example"
          />
        </div>
        <div className="auth-actions">
          <Button type="submit" data-testid="settings-relay-add">
            Add relay
          </Button>
        </div>
        <ul data-testid="settings-relay-list">
          {residue.relayList.length === 0 ? (
            <li className="muted">No local relays</li>
          ) : (
            residue.relayList.map((row) => (
              <li key={row.url}>
                <span>{row.url}{row.enabled ? "" : " · off"}</span>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  data-testid={`settings-relay-remove-${row.url}`}
                  onClick={() => onRemoveRelay(row.url)}
                >
                  Remove
                </Button>
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
