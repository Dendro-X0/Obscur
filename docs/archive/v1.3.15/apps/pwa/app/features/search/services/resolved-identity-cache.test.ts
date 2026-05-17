import { beforeEach, describe, expect, it } from "vitest";
import { ProfileRegistryService } from "@/app/features/profiles/services/profile-registry-service";
import { discoveryCache } from "./discovery-cache";
import { resolvedIdentityCache, resolvedIdentityCacheInternals } from "./resolved-identity-cache";

describe("resolvedIdentityCache", () => {
  beforeEach(() => {
    localStorage.clear();
    ProfileRegistryService.switchProfile("default");
  });

  it("isolates resolved identities by active profile", () => {
    resolvedIdentityCache.upsert({
      pubkey: "a".repeat(64),
      display: "Alice",
      inviteCode: "OBSCUR-ALICE",
      source: "contact_card",
      confidence: "direct",
    });
    const defaultKey = resolvedIdentityCacheInternals.getStorageKey();

    const created = ProfileRegistryService.createProfile("Work");
    expect(created.ok).toBe(true);
    if (!created.ok) return;
    const workId = created.value.profiles.find((profile) => profile.label === "Work")?.profileId;
    expect(workId).toBeTruthy();
    if (!workId) return;

    ProfileRegistryService.switchProfile(workId);
    const workKey = resolvedIdentityCacheInternals.getStorageKey();
    resolvedIdentityCache.upsert({
      pubkey: "b".repeat(64),
      display: "Bob",
      inviteCode: "OBSCUR-BOB",
      source: "text",
      confidence: "cached_only",
    });

    expect(workKey).not.toBe(defaultKey);
    expect(resolvedIdentityCache.getByPubkey("a".repeat(64))).toBeNull();
    expect(resolvedIdentityCache.getByPubkey("b".repeat(64))?.display).toBe("Bob");

    ProfileRegistryService.switchProfile("default");
    expect(resolvedIdentityCache.getByPubkey("a".repeat(64))?.display).toBe("Alice");
    expect(resolvedIdentityCache.getByPubkey("b".repeat(64))).toBeNull();
  });

  it("migrates legacy invite-code cache per active profile only once", () => {
    discoveryCache.upsertProfile({
      pubkey: "c".repeat(64),
      displayName: "Carol",
      inviteCode: "OBSCUR-CAROL",
    });

    resolvedIdentityCache.runOneTimeMigration();
    expect(resolvedIdentityCache.getByLegacyInviteCode("OBSCUR-CAROL")?.pubkey).toBe("c".repeat(64));

    const markerKey = resolvedIdentityCacheInternals.getMigrationMarkerKey();
    expect(localStorage.getItem(markerKey)).toBe("1");

    discoveryCache.upsertProfile({
      pubkey: "d".repeat(64),
      displayName: "Dave",
      inviteCode: "OBSCUR-DAVE",
    });
    resolvedIdentityCache.runOneTimeMigration();

    const raw = localStorage.getItem(resolvedIdentityCacheInternals.getStorageKey());
    expect(raw).toBeTruthy();
    const parsed = JSON.parse(raw ?? "{}") as { entries?: Array<{ pubkey: string }> };
    expect(parsed.entries?.some((entry) => entry.pubkey === "d".repeat(64))).toBe(false);
    expect(resolvedIdentityCache.getByLegacyInviteCode("OBSCUR-DAVE")?.pubkey).toBe("d".repeat(64));
  });
});
