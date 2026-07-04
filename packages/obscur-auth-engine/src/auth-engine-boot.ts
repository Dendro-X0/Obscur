import type { AuthBootSnapshot } from "@dweb/auth";

export type AuthBootHostPort = Readonly<{
  fetchBootSnapshot: (params: Readonly<{
    expectedPubkeyHex?: string;
    restoreEligible: boolean;
  }>) => Promise<AuthBootSnapshot>;
}>;

export const fetchAuthBootSnapshot = async (
  port: AuthBootHostPort,
  params: Readonly<{
    expectedPubkeyHex?: string;
    restoreEligible: boolean;
  }>,
): Promise<AuthBootSnapshot> => port.fetchBootSnapshot(params);
