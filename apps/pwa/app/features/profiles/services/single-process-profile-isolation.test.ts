import { createProfileMessageBus } from "@dweb/core/profile-message-bus";
import { afterEach, describe, expect, it } from "vitest";
import { setProfileScopeOverride } from "./profile-scope";
import { getResolvedProfileId, setProfileRuntimeScope } from "./profile-runtime-scope";

/**
 * Phase 1 same-process / multi-profile guardrails (see docs/v1.5.0-phase1-execution.md).
 * Complements bus unit tests with runtime-scope + isolation checks.
 */
describe("single-process profile isolation (Phase 1)", () => {
    afterEach(() => {
        setProfileRuntimeScope(null);
        setProfileScopeOverride(null);
    });

    it("getResolvedProfileId reflects injected ProfileRuntime scope when set", () => {
        const bus = createProfileMessageBus({ profileId: "scoped-profile-test" });
        setProfileRuntimeScope({ profileId: "scoped-profile-test", bus });
        expect(getResolvedProfileId()).toBe("scoped-profile-test");
    });

    it("profile-scoped buses do not deliver chat-state-replaced across profiles", () => {
        const busA = createProfileMessageBus({ profileId: "a" });
        const busB = createProfileMessageBus({ profileId: "b" });
        const hits: string[] = [];
        busB.subscribeTo("chat-state-replaced", () => {
            hits.push("b");
        });
        busA.publish({
            type: "chat-state-replaced",
            profileId: "a",
            publicKeyHex: "ab".repeat(32),
        });
        expect(hits).toHaveLength(0);
    });

    it("profile bus drops chat-state-replaced when event profileId disagrees with bus owner", () => {
        const bus = createProfileMessageBus({ profileId: "owner" });
        const hits: string[] = [];
        bus.subscribeTo("chat-state-replaced", () => {
            hits.push("hit");
        });
        bus.publish({
            type: "chat-state-replaced",
            profileId: "intruder",
            publicKeyHex: "aa".repeat(32),
        });
        expect(hits).toHaveLength(0);
        bus.publish({
            type: "chat-state-replaced",
            profileId: "owner",
            publicKeyHex: "aa".repeat(32),
        });
        expect(hits).toHaveLength(1);
    });

    it("profile-scoped buses do not deliver notification-target-preference-changed across separate buses", () => {
        const busA = createProfileMessageBus({ profileId: "a" });
        const busB = createProfileMessageBus({ profileId: "b" });
        const hits: string[] = [];
        busB.subscribeTo("notification-target-preference-changed", () => {
            hits.push("b");
        });
        busA.publish({ type: "notification-target-preference-changed" });
        expect(hits).toHaveLength(0);
    });

    it("profile-scoped buses do not deliver voice-call-overlay-action across separate buses", () => {
        const busA = createProfileMessageBus({ profileId: "a" });
        const busB = createProfileMessageBus({ profileId: "b" });
        const hits: string[] = [];
        busB.subscribeTo("voice-call-overlay-action", () => {
            hits.push("b");
        });
        busA.publish({ type: "voice-call-overlay-action", detail: { action: "accept" } });
        expect(hits).toHaveLength(0);
    });

    it("profile bus drops community-membership-ledger-updated when detail.profileId disagrees with bus owner", () => {
        const bus = createProfileMessageBus({ profileId: "owner" });
        const hits: string[] = [];
        bus.subscribeTo("community-membership-ledger-updated", () => {
            hits.push("hit");
        });
        bus.publish({
            type: "community-membership-ledger-updated",
            detail: { publicKeyHex: "aa".repeat(32), profileId: "other" },
        });
        expect(hits).toHaveLength(0);
        bus.publish({
            type: "community-membership-ledger-updated",
            detail: { publicKeyHex: "aa".repeat(32), profileId: "owner" },
        });
        expect(hits).toHaveLength(1);
    });

    it("profile bus drops community-operation-log-updated when detail.profileId disagrees with bus owner", () => {
        const bus = createProfileMessageBus({ profileId: "owner" });
        const hits: string[] = [];
        bus.subscribeTo("community-operation-log-updated", () => {
            hits.push("hit");
        });
        bus.publish({
            type: "community-operation-log-updated",
            detail: { publicKeyHex: "aa".repeat(32), count: 1, profileId: "other" },
        });
        expect(hits).toHaveLength(0);
        bus.publish({
            type: "community-operation-log-updated",
            detail: { publicKeyHex: "aa".repeat(32), count: 1, profileId: "owner" },
        });
        expect(hits).toHaveLength(1);
    });

    it("profile bus drops community-state-updated when detail.profileId disagrees with bus owner", () => {
        const bus = createProfileMessageBus({ profileId: "owner" });
        const hits: string[] = [];
        bus.subscribeTo("community-state-updated", () => {
            hits.push("hit");
        });
        bus.publish({
            type: "community-state-updated",
            detail: { communityId: "c1", state: {}, operation: {}, profileId: "intruder" },
        });
        expect(hits).toHaveLength(0);
        bus.publish({
            type: "community-state-updated",
            detail: { communityId: "c1", state: {}, operation: {}, profileId: "owner" },
        });
        expect(hits).toHaveLength(1);
    });

    it("profile bus drops peer-interaction-updated when detail.profileId disagrees with bus owner", () => {
        const bus = createProfileMessageBus({ profileId: "owner" });
        const hits: string[] = [];
        bus.subscribeTo("peer-interaction-updated", () => {
            hits.push("hit");
        });
        bus.publish({
            type: "peer-interaction-updated",
            detail: { publicKeyHex: "cc".repeat(32), profileId: "other" },
        });
        expect(hits).toHaveLength(0);
        bus.publish({
            type: "peer-interaction-updated",
            detail: { publicKeyHex: "cc".repeat(32), profileId: "owner" },
        });
        expect(hits).toHaveLength(1);
    });

    it("profile bus drops messages-index-rebuilt when detail.profileId disagrees with bus owner", () => {
        const bus = createProfileMessageBus({ profileId: "owner" });
        const hits: string[] = [];
        bus.subscribeTo("messages-index-rebuilt", () => {
            hits.push("hit");
        });
        bus.publish({
            type: "messages-index-rebuilt",
            detail: { publicKeyHex: "dd".repeat(32), profileId: "other", messageCount: 1 },
        });
        expect(hits).toHaveLength(0);
        bus.publish({
            type: "messages-index-rebuilt",
            detail: { publicKeyHex: "dd".repeat(32), profileId: "owner", messageCount: 2 },
        });
        expect(hits).toHaveLength(1);
    });

    it("profile bus drops account-restore materialization events when detail.profileId disagrees with bus owner", () => {
        const bus = createProfileMessageBus({ profileId: "owner" });
        const hits: string[] = [];
        bus.subscribeTo("account-restore-materialization-completed", () => {
            hits.push("hit");
        });
        bus.publish({
            type: "account-restore-materialization-completed",
            detail: { publicKeyHex: "bb".repeat(32), profileId: "other" },
        });
        expect(hits).toHaveLength(0);
        bus.publish({
            type: "account-restore-materialization-completed",
            detail: { publicKeyHex: "bb".repeat(32), profileId: "owner" },
        });
        expect(hits).toHaveLength(1);
    });
});
