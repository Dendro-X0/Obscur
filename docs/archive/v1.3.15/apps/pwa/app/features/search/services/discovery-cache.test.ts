import { beforeEach, describe, expect, it } from "vitest";
import { ProfileRegistryService } from "@/app/features/profiles/services/profile-registry-service";
import { discoveryCache, discoveryCacheInternals } from "./discovery-cache";

describe("discoveryCache", () => {
    beforeEach(() => {
        localStorage.clear();
        ProfileRegistryService.switchProfile("default");
    });

    it("upserts and resolves invite code from explicit value", () => {
        discoveryCache.upsertProfile({
            pubkey: "a".repeat(64),
            name: "Alice",
            inviteCode: "obscur-rw8nxd",
        });

        const resolved = discoveryCache.resolveInviteCode("OBSCUR-RW8NXD");
        expect(resolved?.pubkey).toBe("a".repeat(64));
        expect(resolved?.inviteCode).toBe("OBSCUR-RW8NXD");
    });

    it("extracts invite code from about text and supports text search", () => {
        discoveryCache.upsertProfile({
            pubkey: "b".repeat(64),
            displayName: "Bob",
            about: "Find me on Obscur with this code: obscur-xyz123",
            nip05: "bob@example.com",
        });

        const byInvite = discoveryCache.resolveInviteCode("OBSCUR-XYZ123");
        expect(byInvite?.pubkey).toBe("b".repeat(64));

        const byText = discoveryCache.searchProfiles("example.com");
        expect(byText.length).toBeGreaterThan(0);
        expect(byText[0]?.pubkey).toBe("b".repeat(64));
    });

    it("retrieves a cached profile by pubkey for metadata fallback", () => {
        discoveryCache.upsertProfile({
            pubkey: "e".repeat(64),
            displayName: "Erin",
            about: "Artist and builder",
            picture: "https://cdn.example.com/erin.png",
            nip05: "erin@example.com",
        });

        const profile = discoveryCache.getProfile("e".repeat(64));
        expect(profile?.displayName).toBe("Erin");
        expect(profile?.about).toBe("Artist and builder");
        expect(profile?.picture).toBe("https://cdn.example.com/erin.png");
        expect(profile?.nip05).toBe("erin@example.com");
    });

    it("isolates cached profiles by active profile", () => {
        discoveryCache.upsertProfile({
            pubkey: "c".repeat(64),
            name: "Carol",
            inviteCode: "OBSCUR-CAROL",
        });
        const defaultKey = discoveryCacheInternals.getStorageKey();

        const created = ProfileRegistryService.createProfile("Travel");
        expect(created.ok).toBe(true);
        if (!created.ok) return;
        const travelId = created.value.profiles.find((profile) => profile.label === "Travel")?.profileId;
        expect(travelId).toBeTruthy();
        if (!travelId) return;

        ProfileRegistryService.switchProfile(travelId);
        const travelKey = discoveryCacheInternals.getStorageKey();
        discoveryCache.upsertProfile({
            pubkey: "d".repeat(64),
            name: "Dave",
            inviteCode: "OBSCUR-DAVE",
        });

        expect(travelKey).not.toBe(defaultKey);
        expect(discoveryCache.resolveInviteCode("OBSCUR-CAROL")).toBeNull();
        expect(discoveryCache.resolveInviteCode("OBSCUR-DAVE")?.pubkey).toBe("d".repeat(64));

        ProfileRegistryService.switchProfile("default");
        expect(discoveryCache.resolveInviteCode("OBSCUR-CAROL")?.pubkey).toBe("c".repeat(64));
        expect(discoveryCache.resolveInviteCode("OBSCUR-DAVE")).toBeNull();
    });
});
