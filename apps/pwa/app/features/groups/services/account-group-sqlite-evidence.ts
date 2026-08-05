import type { PublicKeyHex } from "@dweb/crypto/public-key-hex";
import { listWorkspaceGroupMessageRecords } from "@/app/features/messaging/services/thread-history/workspace-group-message-persist-port";
import { requiresSqlitePersistence } from "@/app/features/runtime/native-persistence-policy";

const normalizePublicKeyHex = (value: string): string => value.trim().toLowerCase();

/** True when the account authored at least one native sqlite row for this group scope. */
export const accountHasSqliteGroupMessageEvidence = async (params: Readonly<{
  profileId: string;
  groupId: string;
  accountPublicKeyHex: PublicKeyHex;
  sampleSize?: number;
}>): Promise<boolean> => {
  if (!requiresSqlitePersistence()) {
    return false;
  }
  const groupId = params.groupId.trim();
  const profileId = params.profileId.trim();
  const account = normalizePublicKeyHex(params.accountPublicKeyHex);
  if (!groupId || !profileId || account.length !== 64) {
    return false;
  }
  try {
    const rows = await listWorkspaceGroupMessageRecords({
      profileId,
      groupId,
      limit: params.sampleSize ?? 20,
    });
    return rows.some((row) => normalizePublicKeyHex(row.sender_pubkey) === account);
  } catch {
    return false;
  }
};
