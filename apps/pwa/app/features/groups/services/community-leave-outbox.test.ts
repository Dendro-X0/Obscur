/**
 * M3 Leave Intent And Reliability Outbox Tests
 *
 * AB-05 extension: relay rate limiting must not undo local/private leave.
 *
 * Covers:
 *   1. Outbox enqueue creates a durable pending item.
 *   2. Successful publish removes the outbox item.
 *   3. Rate-limited publish sets status + retryAfterUnixMs.
 *   4. Rejected publish sets status + rejectedReasonCode.
 *   5. getPendingCommunityLeaveOutboxItems respects retryAfterUnixMs.
 *   6. Rate-limit string classification (various relay error messages).
 *   7. Local ledger "left" is preserved regardless of outbox status.
 *   8. Fresh-window restore sees private leave (ledger is truth, not outbox).
 *   9. Profile-scoped outbox isolation — profile-A outbox does not leak to B.
 */

import { beforeEach, describe, expect, it } from "vitest";
import {
  enqueueCommunityLeaveOutboxItem,
  updateCommunityLeaveOutboxItem,
  removeCommunityLeaveOutboxItem,
  readCommunityLeaveOutbox,
  getPendingCommunityLeaveOutboxItems,
  classifyLeavePublishFailure,
  recordCommunityLeaveRelayPublishOutcome,
} from "./community-leave-outbox";
import {
  communityMembershipLedgerInternals,
  loadCommunityMembershipLedger,
} from "./community-membership-ledger";
import { setProfileScopeOverride } from "@/app/features/profiles/services/profile-scope";

const PUBLIC_KEY = "aabbccdd11223344aabbccdd11223344aabbccdd11223344aabbccdd11223344";
const GROUP_ID = "test-group-m3";
const RELAY_URL = "wss://relay.test";
const { setCommunityMembershipStatus } = communityMembershipLedgerInternals;

beforeEach(() => {
  localStorage.clear();
  setProfileScopeOverride(null);
});

// ---------------------------------------------------------------------------
// Outbox enqueue / update / remove
// ---------------------------------------------------------------------------

describe("M3 — community leave outbox lifecycle", () => {
  it("enqueueing creates a pending outbox item", () => {
    const item = enqueueCommunityLeaveOutboxItem({
      publicKeyHex: PUBLIC_KEY,
      groupId: GROUP_ID,
      relayUrl: RELAY_URL,
      intentUnixMs: 1_000,
    });

    expect(item.status).toBe("pending");
    expect(item.attemptCount).toBe(0);
    expect(item.groupId).toBe(GROUP_ID);
    expect(item.relayUrl).toBe(RELAY_URL);
    expect(item.intentUnixMs).toBe(1_000);

    const stored = readCommunityLeaveOutbox(PUBLIC_KEY);
    expect(stored).toHaveLength(1);
    expect(stored[0].status).toBe("pending");
  });

  it("updating to published removes the item from the outbox", () => {
    enqueueCommunityLeaveOutboxItem({
      publicKeyHex: PUBLIC_KEY,
      groupId: GROUP_ID,
      relayUrl: RELAY_URL,
    });

    updateCommunityLeaveOutboxItem({
      publicKeyHex: PUBLIC_KEY,
      groupId: GROUP_ID,
      relayUrl: RELAY_URL,
      outcome: { status: "published" },
    });

    const stored = readCommunityLeaveOutbox(PUBLIC_KEY);
    expect(stored).toHaveLength(0);
  });

  it("updating to rate_limited preserves item with retryAfterUnixMs", () => {
    enqueueCommunityLeaveOutboxItem({
      publicKeyHex: PUBLIC_KEY,
      groupId: GROUP_ID,
      relayUrl: RELAY_URL,
    });

    updateCommunityLeaveOutboxItem({
      publicKeyHex: PUBLIC_KEY,
      groupId: GROUP_ID,
      relayUrl: RELAY_URL,
      outcome: { status: "rate_limited", retryAfterUnixMs: 9_000 },
      nowUnixMs: 1_000,
    });

    const stored = readCommunityLeaveOutbox(PUBLIC_KEY);
    expect(stored).toHaveLength(1);
    expect(stored[0].status).toBe("rate_limited");
    expect(stored[0].retryAfterUnixMs).toBe(9_000);
    expect(stored[0].attemptCount).toBe(1);
  });

  it("updating to rejected preserves item with rejectedReasonCode", () => {
    enqueueCommunityLeaveOutboxItem({
      publicKeyHex: PUBLIC_KEY,
      groupId: GROUP_ID,
      relayUrl: RELAY_URL,
    });

    updateCommunityLeaveOutboxItem({
      publicKeyHex: PUBLIC_KEY,
      groupId: GROUP_ID,
      relayUrl: RELAY_URL,
      outcome: { status: "rejected", rejectedReasonCode: "relay_refused_nip29" },
      nowUnixMs: 1_000,
    });

    const stored = readCommunityLeaveOutbox(PUBLIC_KEY);
    expect(stored).toHaveLength(1);
    expect(stored[0].status).toBe("rejected");
    expect(stored[0].rejectedReasonCode).toBe("relay_refused_nip29");
  });

  it("explicit remove clears the item", () => {
    enqueueCommunityLeaveOutboxItem({
      publicKeyHex: PUBLIC_KEY,
      groupId: GROUP_ID,
      relayUrl: RELAY_URL,
    });
    removeCommunityLeaveOutboxItem({
      publicKeyHex: PUBLIC_KEY,
      groupId: GROUP_ID,
      relayUrl: RELAY_URL,
    });

    expect(readCommunityLeaveOutbox(PUBLIC_KEY)).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// getPendingCommunityLeaveOutboxItems — retry gate
// ---------------------------------------------------------------------------

describe("M3 — getPendingCommunityLeaveOutboxItems respects retryAfterUnixMs", () => {
  it("returns pending items immediately", () => {
    enqueueCommunityLeaveOutboxItem({
      publicKeyHex: PUBLIC_KEY,
      groupId: GROUP_ID,
      relayUrl: RELAY_URL,
      intentUnixMs: 1_000,
    });

    const pending = getPendingCommunityLeaveOutboxItems(PUBLIC_KEY, 1_500);
    expect(pending).toHaveLength(1);
  });

  it("does not return rate_limited items before retryAfterUnixMs", () => {
    enqueueCommunityLeaveOutboxItem({
      publicKeyHex: PUBLIC_KEY,
      groupId: GROUP_ID,
      relayUrl: RELAY_URL,
    });
    updateCommunityLeaveOutboxItem({
      publicKeyHex: PUBLIC_KEY,
      groupId: GROUP_ID,
      relayUrl: RELAY_URL,
      outcome: { status: "rate_limited", retryAfterUnixMs: 10_000 },
    });

    const tooEarly = getPendingCommunityLeaveOutboxItems(PUBLIC_KEY, 5_000);
    expect(tooEarly).toHaveLength(0);

    const afterWindow = getPendingCommunityLeaveOutboxItems(PUBLIC_KEY, 10_001);
    expect(afterWindow).toHaveLength(1);
    expect(afterWindow[0].status).toBe("rate_limited");
  });

  it("does not return rejected or published items", () => {
    enqueueCommunityLeaveOutboxItem({
      publicKeyHex: PUBLIC_KEY,
      groupId: GROUP_ID,
      relayUrl: RELAY_URL,
    });
    updateCommunityLeaveOutboxItem({
      publicKeyHex: PUBLIC_KEY,
      groupId: GROUP_ID,
      relayUrl: RELAY_URL,
      outcome: { status: "rejected", rejectedReasonCode: "refused" },
    });

    expect(getPendingCommunityLeaveOutboxItems(PUBLIC_KEY, Date.now())).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// Rate-limit classification
// ---------------------------------------------------------------------------

describe("M3 — classifyLeavePublishFailure", () => {
  it.each([
    "rate limit exceeded",
    "Rate-Limited by relay",
    "Too Many Requests",
    "429: slow down",
    "throttled: too fast",
  ])("classifies '%s' as rate_limited", (msg: string) => {
    const result = classifyLeavePublishFailure(msg, 1_000);
    expect(result.isRateLimited).toBe(true);
    expect(result.retryAfterUnixMs).toBeGreaterThan(1_000);
  });

  it.each([
    "relay refused nip29",
    "authentication required",
    "permission denied",
    null,
    "",
  ])("does not classify '%s' as rate_limited", (msg: string | null) => {
    const result = classifyLeavePublishFailure(msg, 1_000);
    expect(result.isRateLimited).toBe(false);
    expect(result.retryAfterUnixMs).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// M3 exit criterion 1: relay failure does not undo private leave
// ---------------------------------------------------------------------------

describe("M3 — relay rate limiting does not undo local/private leave", () => {
  it("ledger left status is written independently of outbox status", () => {
    // Write left to ledger (as leaveGroup does before relay publish)
    setCommunityMembershipStatus(PUBLIC_KEY, {
      groupId: GROUP_ID,
      relayUrl: RELAY_URL,
      status: "left",
      updatedAtUnixMs: 1_000,
    });

    // Enqueue outbox and then fail with rate-limit
    enqueueCommunityLeaveOutboxItem({
      publicKeyHex: PUBLIC_KEY,
      groupId: GROUP_ID,
      relayUrl: RELAY_URL,
    });
    updateCommunityLeaveOutboxItem({
      publicKeyHex: PUBLIC_KEY,
      groupId: GROUP_ID,
      relayUrl: RELAY_URL,
      outcome: { status: "rate_limited", retryAfterUnixMs: 99_999 },
    });

    // Ledger must still say left
    const ledger = loadCommunityMembershipLedger(PUBLIC_KEY);
    const entry = ledger.find((e) => e.groupId === GROUP_ID);
    expect(entry?.status).toBe("left");

    // Outbox still pending retry
    const pending = getPendingCommunityLeaveOutboxItems(PUBLIC_KEY, 100_000);
    expect(pending).toHaveLength(1);
    expect(pending[0].status).toBe("rate_limited");
  });

  it("writing joined back after a rate-limited leave does not overwrite left (timestamp precedence)", () => {
    setCommunityMembershipStatus(PUBLIC_KEY, {
      groupId: GROUP_ID,
      relayUrl: RELAY_URL,
      status: "left",
      updatedAtUnixMs: 5_000,
    });

    // Simulate a stale joined write arriving (e.g. from restore) with older timestamp
    setCommunityMembershipStatus(PUBLIC_KEY, {
      groupId: GROUP_ID,
      relayUrl: RELAY_URL,
      status: "joined",
      updatedAtUnixMs: 1_000,
    });

    const ledger = loadCommunityMembershipLedger(PUBLIC_KEY);
    const entry = ledger.find((e) => e.groupId === GROUP_ID);
    // left (ts=5000) must win over joined (ts=1000)
    expect(entry?.status).toBe("left");
  });
});

// ---------------------------------------------------------------------------
// M3 exit criterion 2: fresh-window restore honors private leave
// ---------------------------------------------------------------------------

describe("M3 — fresh-window restore honors private leave", () => {
  it("ledger left status survives across localStorage round-trip", () => {
    setCommunityMembershipStatus(PUBLIC_KEY, {
      groupId: GROUP_ID,
      relayUrl: RELAY_URL,
      status: "left",
      updatedAtUnixMs: 3_000,
    });

    // Simulate fresh read (new window load — same localStorage)
    const restored = loadCommunityMembershipLedger(PUBLIC_KEY);
    const entry = restored.find((e) => e.groupId === GROUP_ID);
    expect(entry?.status).toBe("left");
  });
});

// ---------------------------------------------------------------------------
// M3 exit criterion 3: outbox diagnostics
// ---------------------------------------------------------------------------

describe("recordCommunityLeaveRelayPublishOutcome", () => {
  it("marks outbox published on relay success", () => {
    enqueueCommunityLeaveOutboxItem({
      publicKeyHex: PUBLIC_KEY,
      groupId: GROUP_ID,
      relayUrl: RELAY_URL,
    });
    recordCommunityLeaveRelayPublishOutcome({
      publicKeyHex: PUBLIC_KEY,
      groupId: GROUP_ID,
      relayUrl: RELAY_URL,
      success: true,
    });
    expect(getPendingCommunityLeaveOutboxItems(PUBLIC_KEY)).toHaveLength(0);
  });

  it("marks outbox rate_limited on classified relay failure", () => {
    enqueueCommunityLeaveOutboxItem({
      publicKeyHex: PUBLIC_KEY,
      groupId: GROUP_ID,
      relayUrl: RELAY_URL,
    });
    const now = 50_000;
    recordCommunityLeaveRelayPublishOutcome({
      publicKeyHex: PUBLIC_KEY,
      groupId: GROUP_ID,
      relayUrl: RELAY_URL,
      success: false,
      errorMessage: "HTTP 429 rate limit exceeded",
    });
    const items = readCommunityLeaveOutbox(PUBLIC_KEY);
    expect(items).toHaveLength(1);
    expect(items[0].status).toBe("rate_limited");
    expect(items[0].retryAfterUnixMs).toBeGreaterThan(now);
    const beforeRetry = getPendingCommunityLeaveOutboxItems(PUBLIC_KEY, now);
    expect(beforeRetry).toHaveLength(0);
    const afterRetry = getPendingCommunityLeaveOutboxItems(PUBLIC_KEY, items[0].retryAfterUnixMs ?? now);
    expect(afterRetry).toHaveLength(1);
  });
});

describe("M3 — outbox retry emits accepted/rejected/rate-limited diagnostics", () => {
  it("outbox item records attemptCount increments on each update", () => {
    enqueueCommunityLeaveOutboxItem({
      publicKeyHex: PUBLIC_KEY,
      groupId: GROUP_ID,
      relayUrl: RELAY_URL,
    });

    updateCommunityLeaveOutboxItem({
      publicKeyHex: PUBLIC_KEY,
      groupId: GROUP_ID,
      relayUrl: RELAY_URL,
      outcome: { status: "rate_limited", retryAfterUnixMs: 2_000 },
      nowUnixMs: 1_000,
    });
    updateCommunityLeaveOutboxItem({
      publicKeyHex: PUBLIC_KEY,
      groupId: GROUP_ID,
      relayUrl: RELAY_URL,
      outcome: { status: "rate_limited", retryAfterUnixMs: 3_000 },
      nowUnixMs: 2_001,
    });

    const stored = readCommunityLeaveOutbox(PUBLIC_KEY);
    expect(stored[0].attemptCount).toBe(2);
    expect(stored[0].lastAttemptUnixMs).toBe(2_001);
    expect(stored[0].retryAfterUnixMs).toBe(3_000);
  });
});

// ---------------------------------------------------------------------------
// Profile scope isolation for outbox
// ---------------------------------------------------------------------------

describe("M3 — outbox is profile-scoped", () => {
  it("profile-A outbox does not appear in profile-B reads", () => {
    setProfileScopeOverride("profile-a");
    enqueueCommunityLeaveOutboxItem({
      publicKeyHex: PUBLIC_KEY,
      groupId: GROUP_ID,
      relayUrl: RELAY_URL,
      profileId: "profile-a",
    });

    setProfileScopeOverride("profile-b");
    const profileBItems = readCommunityLeaveOutbox(PUBLIC_KEY, "profile-b");
    expect(profileBItems).toHaveLength(0);

    setProfileScopeOverride("profile-a");
    const profileAItems = readCommunityLeaveOutbox(PUBLIC_KEY, "profile-a");
    expect(profileAItems).toHaveLength(1);
  });
});
