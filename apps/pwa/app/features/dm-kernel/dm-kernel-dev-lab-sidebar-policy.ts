import type { DmConversation } from "@/app/features/messaging/types";

/** Isolated SQLite conversation for CDP write-probe — not a user thread. */
export const DM_KERNEL_WRITE_PROBE_CONVERSATION_ID = "obscur:dev-lab:dm-kernel-write-probe";

export const DM_KERNEL_WRITE_PROBE_PLAINTEXT = "obscur-dm-kernel-write-probe";

const DEV_LAB_SIDEBAR_PREVIEW_PREFIXES = [
  "dev-lab-relay-backfill-in-",
  "dev-lab-relay-backfill-out-",
  "dev-lab-",
] as const;

export const isDevLabSyntheticDmPlaintext = (plaintext: string): boolean => {
  const trimmed = plaintext.trim();
  if (!trimmed) {
    return false;
  }
  if (trimmed === DM_KERNEL_WRITE_PROBE_PLAINTEXT) {
    return true;
  }
  return DEV_LAB_SIDEBAR_PREVIEW_PREFIXES.some((prefix) => trimmed.startsWith(prefix));
};

/** Dev Lab / CDP automation rows must not appear in the messenger sidebar. */
export const isDevLabSyntheticSidebarRow = (
  row: Readonly<Pick<DmConversation, "id" | "lastMessage">>,
): boolean => {
  if (row.id === DM_KERNEL_WRITE_PROBE_CONVERSATION_ID) {
    return true;
  }
  if (row.id.startsWith("obscur:dev-lab:")) {
    return true;
  }
  return isDevLabSyntheticDmPlaintext(row.lastMessage);
};

export const filterDevLabSyntheticSidebarRows = (
  rows: ReadonlyArray<DmConversation>,
): ReadonlyArray<DmConversation> => (
  rows.filter((row) => !isDevLabSyntheticSidebarRow(row))
);
