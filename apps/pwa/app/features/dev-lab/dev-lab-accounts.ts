/**
 * Disposable dev accounts for Dev Lab automation.
 * Same credentials as Playwright e2e helpers — dev builds only.
 */

export type DevLabAccountId = "tester1" | "tester2";

export type DevLabAccount = Readonly<{
  id: DevLabAccountId;
  username: string;
  password: string;
  privateKeyHex?: string;
  nsec?: string;
  npub?: string;
  publicKeyHex?: string;
}>;

export const DEV_LAB_ACCOUNTS: Readonly<Record<DevLabAccountId, DevLabAccount>> = {
  tester1: {
    id: "tester1",
    username: "Tester1",
    password: "SyI14^ew1E",
    privateKeyHex: "c09832d637eb265d90b29c12eb8dfcfffe165b8fb34094af75236d5be4d97884",
  },
  tester2: {
    id: "tester2",
    username: "Tester2",
    password: "HT512#scE8",
    nsec: "nsec1gkv6kg9gyfvrg7h7q60usvaqtjq096dxewaw4vpk9y6krrlcglpqat96ta",
    npub: "npub18kc9tdr7qk7lhyyralkqk7hv62sytklhmpju7nv4mxyp0k2xsv8ss7n67a",
    publicKeyHex: "3db055b47e05bdfb9083efec0b7aecd2a045dbf7d865cf4d95d98817d946830f",
  },
};

/** Hex pubkey for Tester1 — use as DM peer when sending from Tester2 session. */
export const DEV_LAB_TESTER1_PEER = DEV_LAB_ACCOUNTS.tester1.privateKeyHex!;

export const resolveDevLabAccount = (id: DevLabAccountId = "tester1"): DevLabAccount => (
  DEV_LAB_ACCOUNTS[id]
);
