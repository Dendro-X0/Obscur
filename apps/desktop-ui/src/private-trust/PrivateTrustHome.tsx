import { useCallback, useEffect, useMemo, useState } from "react";
import { Button } from "@dweb/ui-kit/button";
import {
  isPrivateTrustComposeFace,
  privateTrustComposeTransportCopy,
  type PrivateTrustProtocolId,
} from "@obscur/private-trust-engine";
import { ContinuityDoor } from "../continuity/ContinuityDoor";
import type { ContinuityPorts } from "../continuity/ports";
import { LAB_AUTH_DOOR_DEFAULTS } from "../auth/lab-device-unlock-port";
import { ProductDoors } from "../product/ProductDoors";
import { REMASTER_SHELL_HONESTY } from "../remaster-honesty-copy";
import { SettingsDoor } from "../settings/SettingsDoor";
import {
  ComposerView,
  ConversationRowView,
  EmptyThreadView,
  MessageBubbleView,
} from "./chrome";
import { PrivateHomeSessionDoor } from "./PrivateHomeSessionDoor";
import type {
  PrivateTrustConversationRow,
  PrivateTrustHomePorts,
  PrivateTrustMessageRow,
} from "./ports";

/** OB4 — product protocol chips only · Matrix promote paused · no Matrix lab chip. */
const PROTOCOL_CHIPS: ReadonlyArray<Readonly<{ id: PrivateTrustProtocolId; label: string }>> = [
  { id: "private_dc", label: "Private DC" },
  { id: "nostr", label: "Obscur-Nostr" },
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
    if (next === "matrix") {
      return;
    }
    props.ports.setProtocolId(next);
    setProtocolId(props.ports.resolveProtocolId());
    setStatusLine(null);
  };

  useEffect(() => {
    if (protocolId === "matrix") {
      props.ports.setProtocolId("private_dc");
      setProtocolId(props.ports.resolveProtocolId());
    }
  }, [protocolId, props.ports]);

  const onSend = async () => {
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

  const threadEmptyVariant = conversations.length === 0
    ? "no-conversations"
    : activeConversationId === null
      ? "no-selection"
      : thread.length === 0
        ? "empty-thread"
        : null;

  return (
    <section className="pt-home" data-testid="private-trust-home">
      <header className="pt-home-header">
        <div>
          <p className="brand">Obscur</p>
          <h1>Private-trust home</h1>
          <p className="lede">{REMASTER_SHELL_HONESTY}</p>
        </div>
        {props.onLock ? (
          <Button type="button" variant="outline" onClick={props.onLock}>
            Lock
          </Button>
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

      <div className="pt-layout" data-testid="pt-shell-layout">
        <aside className="pt-list" aria-label="Conversations" data-testid="conversation-list">
          {conversations.length === 0 ? (
            <EmptyThreadView variant="no-conversations" />
          ) : (
            conversations.map((row) => (
              <ConversationRowView
                key={row.id}
                id={row.id}
                label={row.peerLabel}
                preview={row.preview}
                selected={row.id === activeConversationId}
                onSelect={setActiveConversationId}
              />
            ))
          )}
        </aside>

        <div className="pt-thread">
          <div className="pt-messages" aria-live="polite" data-testid="message-thread">
            {threadEmptyVariant ? (
              <EmptyThreadView variant={threadEmptyVariant} />
            ) : (
              thread.map((message) => (
                <MessageBubbleView
                  key={message.id}
                  id={message.id}
                  body={message.body}
                  direction={message.direction}
                  deliveryStatus={message.deliveryStatus}
                  sentAtUnixMs={message.sentAtUnixMs}
                />
              ))
            )}
          </div>

          <ComposerView
            draft={draft}
            onDraftChange={setDraft}
            onSend={onSend}
            disabled={!activeConversationId}
            busy={busy}
            placeholder={privateTrustFace ? "Message (T3 sealed)…" : "Message…"}
            statusLine={statusLine}
          />
        </div>
      </div>

      <ProductDoors
        settings={(
          <SettingsDoor
            profileId={props.profileId ?? LAB_AUTH_DOOR_DEFAULTS.profileId}
          />
        )}
        home={(
          <PrivateHomeSessionDoor
            profileId={props.profileId ?? LAB_AUTH_DOOR_DEFAULTS.profileId}
          />
        )}
        continuity={props.continuityPorts
          ? <ContinuityDoor ports={props.continuityPorts} />
          : null}
      />
    </section>
  );
}
