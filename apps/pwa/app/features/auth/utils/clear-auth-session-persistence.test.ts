import { beforeEach, describe, expect, it } from "vitest";
import { clearAuthSessionPersistence } from "./clear-auth-session-persistence";

describe("clearAuthSessionPersistence", () => {
  beforeEach(() => {
    window.localStorage.clear();
    window.sessionStorage.clear();
  });

  it("clears scoped auth token and remember-me markers for the target profile", () => {
    window.localStorage.setItem("obscur_auth_token::profile-a", "token-a");
    window.localStorage.setItem("obscur_remember_me::profile-a", "true");
    window.localStorage.setItem("obscur_auth_token::profile-b", "token-b");
    window.localStorage.setItem("obscur_remember_me::profile-b", "true");
    window.sessionStorage.setItem("obscur_auth_token::profile-a", "session-token-a");

    clearAuthSessionPersistence({ profileId: "profile-a" });

    expect(window.localStorage.getItem("obscur_auth_token::profile-a")).toBeNull();
    expect(window.sessionStorage.getItem("obscur_auth_token::profile-a")).toBeNull();
    expect(window.localStorage.getItem("obscur_remember_me::profile-a")).toBeNull();

    expect(window.localStorage.getItem("obscur_auth_token::profile-b")).toBe("token-b");
    expect(window.localStorage.getItem("obscur_remember_me::profile-b")).toBe("true");
  });

  it("clears legacy auth keys by default", () => {
    window.localStorage.setItem("obscur_auth_token", "legacy-token");
    window.localStorage.setItem("obscur_remember_me", "true");
    window.sessionStorage.setItem("obscur_auth_token", "legacy-session-token");

    clearAuthSessionPersistence({ profileId: "profile-a" });

    expect(window.localStorage.getItem("obscur_auth_token")).toBeNull();
    expect(window.sessionStorage.getItem("obscur_auth_token")).toBeNull();
    expect(window.localStorage.getItem("obscur_remember_me")).toBeNull();
  });

  it("can keep legacy keys untouched when includeLegacy is disabled", () => {
    window.localStorage.setItem("obscur_auth_token", "legacy-token");
    window.localStorage.setItem("obscur_remember_me", "true");

    clearAuthSessionPersistence({ profileId: "profile-a", includeLegacy: false });

    expect(window.localStorage.getItem("obscur_auth_token")).toBe("legacy-token");
    expect(window.localStorage.getItem("obscur_remember_me")).toBe("true");
  });
});
