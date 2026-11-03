import {
  getObscurNostrMigrationHints,
  getObscurNostrSwitchSummary,
} from "@obscur/protocol-nostr";
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
  if (protocolId === "private_dc") {
    return [
      {
        id: "private-dc-spike",
        title: "Private DC HTTPS wire",
        body: "Company / private server uses /v1/conversations JSON. Configure base URL (+ optional bearer). Nostr history stays separate — no dual-write.",
      },
      {
        id: "private-dc-no-bridge",
        title: "No history bridge",
        body: "Private DC does not import Nostr DMs or Matrix rooms. Switching protocols changes what you see — no dual-write.",
      },
    ];
  }
  return getObscurNostrMigrationHints();
};

export const getProtocolSwitchSummary = (protocolId: ProtocolId): string => {
  if (protocolId === "matrix") {
    return "Switched to Matrix (lab) — rooms from your homeserver; Obscur-Nostr history stays separate.";
  }
  if (protocolId === "private_dc") {
    return "Switched to Private DC — company server path; Obscur-Nostr history stays separate.";
  }
  return getObscurNostrSwitchSummary();
};
