import { describe, expect, it } from "vitest";
import {
  canLegacyConnectionStoreGatePrivilegedMessaging,
  canLegacyConnectionStoreImplyContactAcceptance,
  isConnectionStoreBehaviorDeprivileged,
} from "./connection-store-behavior-policy";

describe("connection-store-behavior-policy (Containment B)", () => {
  it("deprivileges legacy connectionStore from behavioral decisions", () => {
    expect(isConnectionStoreBehaviorDeprivileged()).toBe(true);
    expect(canLegacyConnectionStoreImplyContactAcceptance()).toBe(false);
    expect(canLegacyConnectionStoreGatePrivilegedMessaging()).toBe(false);
  });
});
