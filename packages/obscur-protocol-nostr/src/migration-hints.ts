/**
 * P7c — Obscur-Nostr switch / migration copy (no dual-write claims).
 */

export type ObscurNostrMigrationHint = Readonly<{
  id: string;
  title: string;
  body: string;
}>;

export const getObscurNostrMigrationHints = (): ReadonlyArray<ObscurNostrMigrationHint> => ([
  {
    id: "nostr-native-path",
    title: "What stays on Obscur-Nostr",
    body: "DMs, relays, and connection requests use the Obscur-Nostr stack. Other protocol sessions on this profile stay idle until you switch.",
  },
]);

export const getObscurNostrSwitchSummary = (): string => (
  "Switched to Obscur-Nostr — DMs and relays; other protocol sessions stay idle."
);
