import { describe, expect, it } from "vitest";
import {
  authKernelKeychainEntryIdForProfile,
  authKernelLoginAssistEntryIdForProfile,
  authKernelProfileScopeMatches,
} from "./auth-kernel-profile-scope";

describe("auth-kernel profile scope", () => {
  it("matches profile ids with trim semantics", () => {
    expect(authKernelProfileScopeMatches("tester1", "tester1")).toBe(true);
    expect(authKernelProfileScopeMatches(" tester1 ", "tester1")).toBe(true);
    expect(authKernelProfileScopeMatches("tester1", "tester2")).toBe(false);
  });

  it("derives distinct keychain entry ids per profile", () => {
    expect(authKernelKeychainEntryIdForProfile("alice")).toBe("nsec::alice");
    expect(authKernelKeychainEntryIdForProfile("bob")).toBe("nsec::bob");
    expect(authKernelKeychainEntryIdForProfile("alice")).not.toBe(
      authKernelKeychainEntryIdForProfile("bob"),
    );
  });

  it("derives distinct login assist entry ids per profile", () => {
    expect(authKernelLoginAssistEntryIdForProfile("work:1")).toBe("login_assist_work_1");
    expect(authKernelLoginAssistEntryIdForProfile("work:2")).toBe("login_assist_work_2");
  });
});
