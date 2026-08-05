import type { Page } from "@playwright/test";
import {
  assertSliceCL3Tester1Identity,
  openSliceCL3NewTest2Chat,
  readSliceCL3LedgerSnapshot,
  SLICE_C_L3_GROUP_ID,
  SLICE_C_L3_GROUP_NAME,
  SLICE_C_L3_RELAY_URL,
  writeSliceCL3Report,
} from "./slice-c-l3-fixture";

export {
  assertSliceCL3Tester1Identity,
  openSliceCL3NewTest2Chat,
  readSliceCL3LedgerSnapshot,
  SLICE_C_L3_GROUP_ID,
  SLICE_C_L3_GROUP_NAME,
  SLICE_C_L3_RELAY_URL,
  writeSliceCL3Report,
};

export type U4L3MembershipEntry = Readonly<{
  status: string | null;
  groupId: string | null;
  communityId: string | null;
  joined: boolean;
  left: boolean;
}>;

export type U4L3LeaveDigestSnapshot = Readonly<{
  leaveCommitted: ReadonlyArray<Record<string, unknown>>;
  leaveRejected: ReadonlyArray<Record<string, unknown>>;
  leaveProofPublished: ReadonlyArray<Record<string, unknown>>;
  membershipMutation: ReadonlyArray<Record<string, unknown>>;
}>;

export const buildU4L3LeaveHref = (params: Readonly<{
  communityId?: string | null;
  groupId?: string;
  relayUrl?: string;
  displayName?: string;
}>): string => {
  const search = new URLSearchParams();
  search.set("id", params.groupId ?? SLICE_C_L3_GROUP_ID);
  search.set("relay", params.relayUrl ?? SLICE_C_L3_RELAY_URL);
  search.set("name", params.displayName ?? SLICE_C_L3_GROUP_NAME);
  const communityId = params.communityId?.trim() ?? "";
  if (communityId) {
    search.set("communityId", communityId);
  }
  return `/groups/leave?${search.toString()}`;
};

export const readU4L3MembershipEntry = async (
  page: Page,
  groupId = SLICE_C_L3_GROUP_ID,
): Promise<U4L3MembershipEntry> => (
  page.evaluate(({ targetGroupId }) => {
    const ledgerKeys = Object.keys(localStorage).filter((key) => (
      key.includes("obscur.group.membership_ledger.v1")
    ));
    let best: U4L3MembershipEntry = {
      status: null,
      groupId: null,
      communityId: null,
      joined: false,
      left: false,
    };
    for (const ledgerKey of ledgerKeys) {
      try {
        const raw = localStorage.getItem(ledgerKey);
        if (!raw) {
          continue;
        }
        const parsed: unknown = JSON.parse(raw);
        const entries = Array.isArray(parsed)
          ? parsed
          : (
            parsed && typeof parsed === "object" && Array.isArray((parsed as { entries?: unknown }).entries)
              ? (parsed as { entries: ReadonlyArray<{
                status?: string;
                groupId?: string;
                communityId?: string;
              }> }).entries
              : []
          );
        const matches = entries.filter((row) => row.groupId?.trim() === targetGroupId);
        for (const entry of matches) {
          const status = entry.status?.trim() ?? null;
          const candidate: U4L3MembershipEntry = {
            status,
            groupId: entry.groupId?.trim() ?? null,
            communityId: entry.communityId?.trim() ?? null,
            joined: status === "joined",
            left: status === "left",
          };
          // Prefer left (post-leave) over joined; otherwise keep first statusful row.
          if (candidate.left) {
            best = candidate;
          } else if (!best.left && candidate.joined) {
            best = candidate;
          } else if (!best.status && status) {
            best = candidate;
          }
        }
      } catch {
        // try next ledger key
      }
    }
    return best;
  }, { targetGroupId: groupId })
);

export const captureU4L3LeaveDigest = async (
  page: Page,
  windowSize = 600,
): Promise<U4L3LeaveDigestSnapshot> => (
  page.evaluate((size) => {
    // Prefer findByName — workspace.leave.* is not in CROSS_DEVICE_DIGEST_EVENT_CONFIG.
    const api = window.obscurAppEvents as {
      findByName?: (name: string, count?: number) => ReadonlyArray<Record<string, unknown>>;
      getCrossDeviceSyncDigest?: (count?: number) => {
        events?: Record<string, ReadonlyArray<Record<string, unknown>>>;
      };
    } | undefined;
    const find = (name: string): ReadonlyArray<Record<string, unknown>> => {
      if (typeof api?.findByName === "function") {
        return api.findByName(name, size);
      }
      return api?.getCrossDeviceSyncDigest?.(size)?.events?.[name] ?? [];
    };
    return {
      leaveCommitted: find("workspace.leave.committed"),
      leaveRejected: find("workspace.leave.rejected"),
      leaveProofPublished: find("groups.leave_proof_published"),
      membershipMutation: find("groups.membership_ledger_mutation").length > 0
        ? find("groups.membership_ledger_mutation")
        : find("groups.membership_mutation"),
    };
  }, windowSize)
);

export const confirmU4L3LeaveCommunity = async (page: Page): Promise<void> => {
  const leaveButton = page.getByRole("button", { name: /^Leave Community$/i });
  await leaveButton.waitFor({ state: "visible", timeout: 60_000 });
  await page.evaluate(() => {
    document.querySelectorAll(".fixed.bottom-4.right-4").forEach((node) => {
      if (node instanceof HTMLElement) {
        node.style.pointerEvents = "none";
      }
    });
  }).catch(() => undefined);
  await leaveButton.click({ force: true });
};
