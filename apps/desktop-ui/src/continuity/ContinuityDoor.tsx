import { useRef, useState, type ChangeEvent } from "react";
import type { ContinuityPorts } from "./ports";
import { CONTINUITY_TIER_LABELS } from "./continuity-tiers";

/**
 * Cut 7–15 — Continuity M1–M6 + peer history grants door.
 * Unlock ≠ Continuity. Soft L3 / Continuity Pass not claimed · grants ≠ invent CRM.
 */

export type ContinuityDoorProps = Readonly<{
  ports: ContinuityPorts;
}>;

export function ContinuityDoor(props: ContinuityDoorProps) {
  const [status, setStatus] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [continuityPassphrase, setContinuityPassphrase] = useState("");
  const [devicePassphrase, setDevicePassphrase] = useState("");
  const [transferOfferJson, setTransferOfferJson] = useState("");
  const [transferCode, setTransferCode] = useState("");
  const [lastOfferJson, setLastOfferJson] = useState<string | null>(null);
  const [lastOfferCode, setLastOfferCode] = useState<string | null>(null);
  const [deviceLabel, setDeviceLabel] = useState("");
  const [linkedDevices, setLinkedDevices] = useState(() => props.ports.listLinkedDevices());
  const [backfillReport, setBackfillReport] = useState(() => props.ports.getLastHomeBackfillReport());
  const [peerGrants, setPeerGrants] = useState(() => props.ports.listPeerHistoryGrants());
  const [grantRecipient, setGrantRecipient] = useState("");
  const [grantOfferJson, setGrantOfferJson] = useState("");
  const [grantCode, setGrantCode] = useState("");
  const [lastGrantOfferJson, setLastGrantOfferJson] = useState<string | null>(null);
  const [lastGrantCode, setLastGrantCode] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const inventory = props.ports.getInventory();
  const honesty = props.ports.getHonesty();

  const refreshLinkedDevices = () => {
    setLinkedDevices(props.ports.listLinkedDevices());
  };

  const refreshBackfillReport = () => {
    setBackfillReport(props.ports.getLastHomeBackfillReport());
  };

  const refreshPeerGrants = () => {
    setPeerGrants(props.ports.listPeerHistoryGrants());
  };

  const onExport = async () => {
    setBusy(true);
    setStatus(null);
    try {
      const result = await props.ports.exportSealedSnapshot({
        continuityPassphrase,
        devicePassphrase: devicePassphrase.trim() || undefined,
      });
      setStatus(result.ok
        ? `Export ok · honesty=${result.honesty}`
        : (result.error ?? result.reasonCode ?? "Export refused"));
    } finally {
      setBusy(false);
    }
  };

  const onPublishHome = async () => {
    setBusy(true);
    setStatus(null);
    try {
      const result = await props.ports.publishSealedSnapshotToHome({
        continuityPassphrase,
        devicePassphrase: devicePassphrase.trim() || undefined,
      });
      setStatus(result.ok
        ? `Home publish ok · id=${result.homeBackupId ?? "?"} · honesty=${result.honesty}`
        : (result.error ?? result.reasonCode ?? "Home publish refused"));
    } finally {
      setBusy(false);
    }
  };

  const onRestoreHome = async () => {
    setBusy(true);
    setStatus(null);
    try {
      const result = await props.ports.restoreSealedSnapshotFromHome({
        continuityPassphrase,
      });
      setStatus(result.ok
        ? `Home restore ok · honesty=${result.honesty}`
        : (result.error ?? result.reasonCode ?? "Home restore refused"));
    } finally {
      setBusy(false);
    }
  };

  const onCreateTransferOffer = async () => {
    setBusy(true);
    setStatus(null);
    try {
      const result = await props.ports.createDeviceTransferOffer({
        continuityPassphrase,
        devicePassphrase: devicePassphrase.trim() || undefined,
      });
      if (result.ok && result.transferOfferJson && result.transferCode) {
        setLastOfferJson(result.transferOfferJson);
        setLastOfferCode(result.transferCode);
        setStatus(`M4 offer ok · code=${result.transferCode} · honesty=${result.honesty}`);
      } else {
        setStatus(result.error ?? result.reasonCode ?? "M4 offer refused");
      }
    } finally {
      setBusy(false);
    }
  };

  const onAcceptTransferOffer = async () => {
    setBusy(true);
    setStatus(null);
    try {
      const result = await props.ports.acceptDeviceTransferOffer({
        continuityPassphrase,
        transferOfferJson,
        transferCode,
      });
      setStatus(result.ok
        ? `M4 accept ok · honesty=${result.honesty}`
        : (result.error ?? result.reasonCode ?? "M4 accept refused"));
      if (result.ok) {
        refreshLinkedDevices();
      }
    } finally {
      setBusy(false);
    }
  };

  const onEnrollDevice = () => {
    try {
      const enrolled = props.ports.enrollThisDevice({
        label: deviceLabel.trim() || undefined,
      });
      setDeviceLabel("");
      refreshLinkedDevices();
      setStatus(`M5 enroll ok · ${enrolled.deviceId} (registry ≠ live sync)`);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "M5 enroll refused");
    }
  };

  const onRevokeDevice = (deviceId: string) => {
    const revoked = props.ports.revokeLinkedDevice(deviceId);
    refreshLinkedDevices();
    setStatus(revoked
      ? `M5 revoke marked · ${deviceId}`
      : `M5 revoke missed · ${deviceId}`);
  };

  const onBackfillHome = async () => {
    setBusy(true);
    setStatus(null);
    try {
      const result = await props.ports.backfillFromPrivateHome();
      refreshBackfillReport();
      if (result.ok && result.report) {
        setStatus(
          `M6 backfill ok · conv=${result.report.conversationCount} · env=${result.report.envelopeCount} · droppedPlain=${result.report.droppedPlaintextCount} (opaque only · ≠ invent CRM)`,
        );
      } else {
        setStatus(result.error ?? result.reasonCode ?? "M6 backfill refused");
      }
    } finally {
      setBusy(false);
    }
  };

  const onCreatePeerGrant = () => {
    setStatus(null);
    const result = props.ports.createPeerHistoryGrant({
      recipientPublicKeyHex: grantRecipient,
    });
    refreshPeerGrants();
    if (result.ok && result.grantOfferJson && result.transferCode) {
      setLastGrantOfferJson(result.grantOfferJson);
      setLastGrantCode(result.transferCode);
      setGrantRecipient("");
      setStatus(`Peer grant ok · code=${result.transferCode} (opaque · ≠ invent CRM)`);
    } else {
      setStatus(result.error ?? result.reasonCode ?? "Peer grant refused");
    }
  };

  const onAcceptPeerGrant = () => {
    setStatus(null);
    const result = props.ports.acceptPeerHistoryGrant({
      grantOfferJson,
      transferCode: grantCode,
    });
    refreshPeerGrants();
    if (result.ok && result.record) {
      setStatus(`Peer grant accepted · ${result.record.grantId} (residue only · ≠ Soft L3 invent)`);
    } else {
      setStatus(result.error ?? result.reasonCode ?? "Peer grant accept refused");
    }
  };

  const onImportClick = () => {
    fileInputRef.current?.click();
  };

  const onImportFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) {
      return;
    }
    setBusy(true);
    setStatus(null);
    try {
      const raw = await file.text();
      const result = await props.ports.importSealedSnapshot(raw, {
        continuityPassphrase,
      });
      setStatus(result.ok
        ? `Import ok · honesty=${result.honesty}`
        : (result.error ?? result.reasonCode ?? "Import refused"));
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="continuity-door" data-testid="continuity-door">
      <header className="continuity-door-header">
        <h2>Continuity</h2>
        <p className="continuity-door-sub">
          Plane 3 · M1–M6 · peer history grants — unlock does not restore a wiped PC ·
          registry ≠ live sync · grants ≠ invent CRM · ≠ Continuity Pass.
        </p>
      </header>
      <p className="continuity-honesty" data-testid="continuity-honesty">
        Status: <strong>{honesty}</strong>
        {" "}(empty | restoring | partial | full)
      </p>
      <ul className="continuity-tiers">
        {inventory.tiersPresent.map((tier) => (
          <li key={tier}>{tier}: {CONTINUITY_TIER_LABELS[tier]}</li>
        ))}
        {inventory.missingRequiredTiers.length > 0 ? (
          <li data-testid="continuity-missing-tiers">
            Missing C0: {inventory.missingRequiredTiers.join(", ")}
          </li>
        ) : null}
      </ul>
      <div className="continuity-secrets">
        <label>
          Continuity passphrase
          <input
            type="password"
            autoComplete="new-password"
            data-testid="continuity-passphrase"
            value={continuityPassphrase}
            disabled={busy}
            onChange={(event) => setContinuityPassphrase(event.target.value)}
          />
        </label>
        <label>
          Device password (export unwrap; optional if same)
          <input
            type="password"
            autoComplete="current-password"
            data-testid="continuity-device-passphrase"
            value={devicePassphrase}
            disabled={busy}
            onChange={(event) => setDevicePassphrase(event.target.value)}
          />
        </label>
      </div>
      <div className="continuity-actions">
        <button type="button" disabled={busy} onClick={() => void onExport()}>
          Export sealed snapshot
        </button>
        <button type="button" disabled={busy} onClick={onImportClick}>
          Import sealed snapshot
        </button>
        <button
          type="button"
          disabled={busy}
          data-testid="continuity-publish-home"
          onClick={() => void onPublishHome()}
        >
          Publish to private home
        </button>
        <button
          type="button"
          disabled={busy}
          data-testid="continuity-restore-home"
          onClick={() => void onRestoreHome()}
        >
          Restore from private home
        </button>
        <button
          type="button"
          disabled={busy}
          data-testid="continuity-m4-create-offer"
          onClick={() => void onCreateTransferOffer()}
        >
          Create device transfer offer
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept="application/json,.json"
          hidden
          data-testid="continuity-import-file"
          onChange={(event) => void onImportFile(event)}
        />
      </div>
      {lastOfferJson && lastOfferCode ? (
        <div className="continuity-m4-offer" data-testid="continuity-m4-offer-out">
          <p>Transfer code: <strong data-testid="continuity-m4-code-out">{lastOfferCode}</strong></p>
          <textarea
            readOnly
            rows={6}
            value={lastOfferJson}
            data-testid="continuity-m4-offer-json-out"
          />
        </div>
      ) : null}
      <div className="continuity-m4-accept">
        <label>
          Paste M4 offer JSON
          <textarea
            rows={4}
            data-testid="continuity-m4-offer-json-in"
            value={transferOfferJson}
            disabled={busy}
            onChange={(event) => setTransferOfferJson(event.target.value)}
          />
        </label>
        <label>
          Transfer code
          <input
            type="text"
            inputMode="numeric"
            autoComplete="one-time-code"
            data-testid="continuity-m4-code-in"
            value={transferCode}
            disabled={busy}
            onChange={(event) => setTransferCode(event.target.value)}
          />
        </label>
        <button
          type="button"
          disabled={busy}
          data-testid="continuity-m4-accept"
          onClick={() => void onAcceptTransferOffer()}
        >
          Accept device transfer
        </button>
      </div>
      <div className="continuity-m5" data-testid="continuity-m5-registry">
        <h3>Linked devices (M5 registry)</h3>
        <p className="continuity-door-sub">
          Enroll/revoke list only — not live multi-device sync · ≠ Continuity Pass.
        </p>
        <label>
          Device label
          <input
            type="text"
            data-testid="continuity-m5-label"
            value={deviceLabel}
            disabled={busy}
            onChange={(event) => setDeviceLabel(event.target.value)}
            placeholder="This laptop"
          />
        </label>
        <button
          type="button"
          disabled={busy}
          data-testid="continuity-m5-enroll"
          onClick={onEnrollDevice}
        >
          Enroll this device
        </button>
        <ul data-testid="continuity-m5-list">
          {linkedDevices.length === 0 ? (
            <li className="muted">No linked devices enrolled</li>
          ) : (
            linkedDevices.map((device) => (
              <li key={device.deviceId}>
                <span>
                  {device.label}
                  {" · "}
                  {device.deviceId.slice(0, 8)}
                  {device.revokedAtUnixMs ? " · revoked" : ""}
                </span>
                {!device.revokedAtUnixMs ? (
                  <button
                    type="button"
                    disabled={busy}
                    data-testid={`continuity-m5-revoke-${device.deviceId}`}
                    onClick={() => onRevokeDevice(device.deviceId)}
                  >
                    Revoke
                  </button>
                ) : null}
              </li>
            ))
          )}
        </ul>
      </div>
      <div className="continuity-m6" data-testid="continuity-m6-backfill">
        <h3>Home backfill (M6)</h3>
        <p className="continuity-door-sub">
          Pull opaque envelopes from private home — plaintext rows dropped · ≠ Continuity Pass · ≠ Soft L3 invent.
        </p>
        <button
          type="button"
          disabled={busy}
          data-testid="continuity-m6-backfill-run"
          onClick={() => void onBackfillHome()}
        >
          Backfill from private home
        </button>
        {backfillReport ? (
          <p className="continuity-m6-report" data-testid="continuity-m6-report">
            Last: conv={backfillReport.conversationCount}
            {" · "}env={backfillReport.envelopeCount}
            {" · "}droppedPlain={backfillReport.droppedPlaintextCount}
            {" · "}cursor={backfillReport.cursorUnixMs}
            {" · "}{backfillReport.honestyNote}
          </p>
        ) : (
          <p className="muted">No M6 backfill report yet</p>
        )}
      </div>
      <div className="continuity-peer-grant" data-testid="continuity-peer-grant">
        <h3>Peer history grants</h3>
        <p className="continuity-door-sub">
          Ingredient 5 NARROW — opaque history residue to a peer pubkey · ≠ Soft L3 invent · ≠ Continuity Pass.
        </p>
        <label>
          Recipient public key
          <input
            type="text"
            data-testid="continuity-peer-grant-recipient"
            value={grantRecipient}
            disabled={busy}
            onChange={(event) => setGrantRecipient(event.target.value)}
            placeholder="peer pubkey hex"
          />
        </label>
        <button
          type="button"
          disabled={busy}
          data-testid="continuity-peer-grant-create"
          onClick={onCreatePeerGrant}
        >
          Create peer history grant
        </button>
        {lastGrantOfferJson && lastGrantCode ? (
          <div data-testid="continuity-peer-grant-out">
            <p>Grant code: <strong data-testid="continuity-peer-grant-code-out">{lastGrantCode}</strong></p>
            <textarea
              readOnly
              rows={5}
              value={lastGrantOfferJson}
              data-testid="continuity-peer-grant-json-out"
            />
          </div>
        ) : null}
        <label>
          Paste peer grant JSON
          <textarea
            rows={4}
            data-testid="continuity-peer-grant-json-in"
            value={grantOfferJson}
            disabled={busy}
            onChange={(event) => setGrantOfferJson(event.target.value)}
          />
        </label>
        <label>
          Grant code
          <input
            type="text"
            inputMode="numeric"
            data-testid="continuity-peer-grant-code-in"
            value={grantCode}
            disabled={busy}
            onChange={(event) => setGrantCode(event.target.value)}
          />
        </label>
        <button
          type="button"
          disabled={busy}
          data-testid="continuity-peer-grant-accept"
          onClick={onAcceptPeerGrant}
        >
          Accept peer history grant
        </button>
        <ul data-testid="continuity-peer-grant-list">
          {peerGrants.length === 0 ? (
            <li className="muted">No peer grants recorded</li>
          ) : (
            peerGrants.map((grant) => (
              <li key={`${grant.direction}-${grant.grantId}`}>
                {grant.direction} · {grant.status} · {grant.grantId.slice(0, 8)} · {grant.honestyNote}
              </li>
            ))
          )}
        </ul>
      </div>
      {status ? (
        <p className="continuity-status" data-testid="continuity-status">{status}</p>
      ) : null}
    </section>
  );
}
