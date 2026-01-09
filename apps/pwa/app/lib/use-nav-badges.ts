"use client";

import { useMemo } from "react";
import type { PublicKeyHex } from "@dweb/crypto/public-key-hex";

type NavBadgeCounts = Readonly<Record<string, number>>;

type UseNavBadgesParams = Readonly<{ publicKeyHex: PublicKeyHex | null }>;

type UseNavBadgesResult = Readonly<{ navBadgeCounts: NavBadgeCounts }>;

export default function useNavBadges(params: UseNavBadgesParams): UseNavBadgesResult {
  const navBadgeCounts: NavBadgeCounts = useMemo((): NavBadgeCounts => {
    void params;
    return {};
  }, [params]);
  return { navBadgeCounts };
}
