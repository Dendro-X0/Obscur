import type { ProtocolId } from "./types";

export type ProtocolMigrationHint = Readonly<{
  id: string;
  title: string;
  body: string;
}>;

/** Honest capability / history gaps when switching protocols (no dual-write). */
export const getProtocolMigrationHints = (
  protocolId: ProtocolId,
): ReadonlyArray<ProtocolMigrationHint> => {
  if (protocolId === "matrix") {
    return [
      {
        id: "matrix-no-history-bridge",
        title: "Separate conversation list",
        body: "Matrix rooms do not import Nostr DMs. Switching protocols changes what you see — no dual-write.",
      },
      {
        id: "matrix-cleartext-mvp",
        title: "Cleartext rooms (MVP)",
        body: "This Matrix path sends server-visible text. Olm/Megolm E2EE is not in this slice.",
      },
      {
        id: "matrix-no-connection-requests",
        title: "No Nostr connection requests",
        body: "Invite / connection-request flows stay on Nostr. Matrix uses rooms on your homeserver.",
      },
    ];
  }
  return [
    {
      id: "nostr-native-path",
      title: "What stays on Nostr",
      body: "DMs, relays, and connection requests use the Obscur Nostr stack. A Matrix session on this profile stays idle until you switch protocol.",
    },
  ];
};

export const getProtocolSwitchSummary = (protocolId: ProtocolId): string => (
  protocolId === "matrix"
    ? "Switched to Matrix — rooms from your homeserver; Nostr history stays on Nostr."
    : "Switched to Nostr — DMs and relays; Matrix rooms stay on Matrix."
);
