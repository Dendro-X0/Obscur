"use client";

import { useMemo } from "react";
import type { PublicKeyHex } from "@dweb/crypto/public-key-hex";
import { useCommunityLedgerCRDT } from "./use-community-ledger-crdt";
import { useSealedCommunity as useOriginalSealedCommunity } from "./use-sealed-community";

type UseSealedCommunityArgs = Parameters<typeof useOriginalSealedCommunity>[0];
type UseSealedCommunityResult = ReturnType<typeof useOriginalSealedCommunity>;

export const useSealedCommunityFixed = (
  args: UseSealedCommunityArgs,
): UseSealedCommunityResult & Readonly<{
  memberCount: number;
  _memberDiagnostics: Readonly<{
    originalCount: number;
    crdtCount: number;
    mergedCount: number;
  }>;
}> => {
  const original = useOriginalSealedCommunity(args);
  const actor = args.myPublicKeyHex ?? "anonymous";
  const crdtLedger = useCommunityLedgerCRDT(
    Array.from(original.members),
    actor,
  );

  const mergedMembers = useMemo(() => {
    const originalMembers = original.members as ReadonlyArray<PublicKeyHex>;
    const crdtMembers = crdtLedger.members as ReadonlyArray<PublicKeyHex>;
    return Array.from(new Set([...originalMembers, ...crdtMembers])) as ReadonlyArray<PublicKeyHex>;
  }, [crdtLedger.members, original.members]);

  return useMemo(
    () => ({
      ...original,
      members: mergedMembers,
      memberCount: mergedMembers.length,
      _memberDiagnostics: {
        originalCount: original.members.length,
        crdtCount: crdtLedger.members.length,
        mergedCount: mergedMembers.length,
      },
    }),
    [crdtLedger.members.length, mergedMembers, original],
  );
};

export default useSealedCommunityFixed;
