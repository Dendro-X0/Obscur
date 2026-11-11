import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import {
  isPrivateTrustComposeFace,
  privateTrustComposeTransportCopy,
  type PrivateTrustProtocolId,
} from "@obscur/private-trust-engine";
import { ContinuityDoor } from "../continuity/ContinuityDoor";
import type { ContinuityPorts } from "../continuity/ports";
import { LAB_AUTH_DOOR_DEFAULTS } from "../auth/lab-device-unlock-port";
import { REMASTER_SHELL_HONESTY } from "../remaster-honesty-copy";
import { SettingsDoor } from "../settings/SettingsDoor";
import { PrivateHomeSessionDoor } from "./PrivateHomeSessionDoor";
import type {
  PrivateTrustConversationRow,
  PrivateTrustHomePorts,
  PrivateTrustMessageRow,
} from "./ports";

const PROTOCOL_CHIPS: ReadonlyArray<Readonly<{ id: PrivateTrustProtocolId; label: string }>> = [
  { id: "private_dc", label: "Private DC" },
  { id: "nostr", label: "Obscur-Nostr" },
  { id: "matrix", label: "Matrix (lab)" },
];

export type PrivateTrustHomeProps = Readonly<{
  ports: PrivateTrustHomePorts;
  continuityPorts?: ContinuityPorts;
  profileId?: string;
  onLock?: () => void;
}>;

export function PrivateTrustHome(props: PrivateTrustHomeProps) {
  const [protocolId, setProtocolId] = useState<PrivateTrustProtocolId>(() => (
    props.ports.resolveProtocolId()
  ));
  const [conversations, setConversations] = useState<ReadonlyArray<PrivateTrustConversationRow>>([]);
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  const [thread, setThread] = useState<ReadonlyArray<PrivateTrustMessageRow>>([]);
  const [draft, setDraft] = useState("");
  const [statusLine, setStatusLine] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const privateTrustFace = isPrivateTrustComposeFace(protocolId);
  const transportCopy = useMemo(
    () => (privateTrustFace ? privateTrustComposeTransportCopy() : null),
    [privateTrustFace],
  );

  const refreshConversations = useCallback(async () => {
    const rows = await props.ports.listConversations();
    setConversations(rows);
    setActiveConversationId((current) => current ?? rows[0]?.id ?? null);
  }, [props.ports]);

  const refreshThread = useCallback(async (conversationId: string | null) => {
    if (!conversationId) {
      setThread([]);
      return;
    }
    setThread(await props.ports.listMessages(conversationId));
  }, [props.ports]);

  useEffect(() => {
    void refreshConversations();
  }, [refreshConversations]);

  useEffect(() => {
    void refreshThread(activeConversationId);
  }, [activeConversationId, refreshThread]);

  const selectProtocol = (next: PrivateTrustProtocolId) => {
    props.ports.setProtocolId(next);
    setProtocolId(props.ports.resolveProtocolId());
    setStatusLine(null);
  };

  const onSend = async (event: FormEvent) => {
    event.preventDefault();
    if (!activeConversationId || busy) {
      return;
    }
    setBusy(true);
    setStatusLine(null);
    try {
      const result = await props.ports.sendDm({
        conversationId: activeConversationId,
        body: draft,
        carrier: protocolId,
      });
      if (!result.ok) {
        setStatusLine(result.error ?? result.reasonCode ?? "Send refused");
        return;
      }
      setDraft("");
      setStatusLine(
        result.deliveryStatus === "accepted"
          ? "Accepted by home (≠ delivered)"
          : "Sent",
      );
      await refreshConversations();
      await refreshThread(activeConversationId);
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="pt-home" data-testid="private-trust-home">
      <header className="pt-home-header">
        <div>
          <p className="brand">Obscur</p>
          <h1>Private-trust home</h1>
          <p className="lede">{REMASTER_SHELL_HONESTY}</p>
        </div>
        {props.onLock ? (
          <button type="button" className="auth-button secondary" onClick={props.onLock}>
            Lock
          </button>
        ) : null}
      </header>

      <div className="pt-protocol-chips" role="group" aria-label="Active protocol">
        {PROTOCOL_CHIPS.map((chip) => (
          <button
            key={chip.id}
            type="button"
            className={chip.id === protocolId ? "pt-chip active" : "pt-chip"}
            onClick={() => selectProtocol(chip.id)}
          >
            {chip.label}
          </button>
        ))}
      </div>

      {transportCopy ? (
        <p className="pt-transport" data-testid="hdc-t3-chrome">
          <strong>{transportCopy.label}</strong>
          <span>{transportCopy.detail}</span>
        </p>
      ) : (
        <p className="pt-transport muted">Module face · not private-trust primary chrome</p>
      )}

      <div className="pt-layout">
        <aside className="pt-list" aria-label="Conversations">
          {conversations.length === 0 ? (
            <p className="muted">No conversations</p>
          ) : (
            conversations.map((row) => (
              <button
                key={row.id}
                type="button"
                className={row.id === activeConversationId ? "pt-conv active" : "pt-conv"}
                onClick={() => setActiveConversationId(row.id)}
              >
                <span className="pt-conv-title">{row.peerLabel}</span>
                <span className="pt-conv-preview">{row.preview}</span>
              </button>
            ))
          )}
        </aside>

        <div className="pt-thread">
          <div className="pt-messages" aria-live="polite">
            {thread.map((message) => (
              <div
                key={message.id}
                className={message.direction === "out" ? "pt-msg out" : "pt-msg in"}
              >
                <p>{message.body}</p>
                <span className="pt-msg-meta">{message.deliveryStatus}</span>
              </div>
            ))}
          </div>

          <form className="pt-composer" onSubmit={(event) => void onSend(event)}>
            <textarea
              className="pt-draft"
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              placeholder={privateTrustFace ? "Message (T3 sealed)…" : "Message…"}
              rows={3}
              disabled={!activeConversationId || busy}
            />
            <div className="pt-composer-actions">
              <button
                type="submit"
                className="auth-button"
                disabled={!activeConversationId || busy || draft.trim().length === 0}
              >
                {busy ? "Sending…" : "Send"}
              </button>
              {statusLine ? <p className="pt-status">{statusLine}</p> : null}
            </div>
          </form>
        </div>
      </div>

      <SettingsDoor
        profileId={props.profileId ?? LAB_AUTH_DOOR_DEFAULTS.profileId}
      />

      <PrivateHomeSessionDoor
        profileId={props.profileId ?? LAB_AUTH_DOOR_DEFAULTS.profileId}
      />

      {props.continuityPorts ? (
        <ContinuityDoor ports={props.continuityPorts} />
      ) : null}
    </section>
  );
}
