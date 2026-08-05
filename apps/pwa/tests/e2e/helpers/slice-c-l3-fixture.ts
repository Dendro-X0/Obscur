import type { Page } from "@playwright/test";
import { derivePublicKeyHex } from "@dweb/crypto/derive-public-key-hex";
import type { PrivateKeyHex } from "@dweb/crypto/private-key-hex";
import { TESTER1 } from "./dev-test-accounts";

export const SLICE_C_L3_GROUP_ID = "b93f53e23d8c4456835afd3f4d3a627b" as const;
export const SLICE_C_L3_GROUP_NAME = "NewTest 2" as const;
export const SLICE_C_L3_RELAY_URL = "ws://localhost:7000" as const;

/** Dev fixture stores private key hex as publicKeyHex — derive the real secp256k1 pubkey. */
export const TESTER1_DERIVED_PUBLIC_KEY_HEX = derivePublicKeyHex(
  TESTER1.privateKeyHex as PrivateKeyHex,
);

export type SliceCL3LedgerSnapshot = Readonly<{
  communityId: string | null;
  joined: boolean;
  roomKeyHex: string | null;
  localRoomKeyCount: number;
  profileScope: string;
}>;

export type SliceCL3EventSnapshot = Readonly<{
  resolveEvents: ReadonlyArray<Record<string, unknown>>;
  materializedEvents: ReadonlyArray<Record<string, unknown>>;
  blockedEvents: ReadonlyArray<Record<string, unknown>>;
}>;

export const readSliceCL3LedgerSnapshot = async (
  page: Page,
  groupId = SLICE_C_L3_GROUP_ID,
): Promise<SliceCL3LedgerSnapshot> => (
  page.evaluate(({ targetGroupId }) => {
    const profileScope = localStorage.getItem("obscur.profile.active.v1")
      ?? localStorage.getItem("obscur.profile.active")
      ?? "default";

    const readRoomKeyMap = (): Record<string, { roomKeyHex?: string }> => {
      const raw = localStorage.getItem(`obscur:room-keys:v1:${profileScope}`)
        ?? localStorage.getItem("obscur:room-keys:v1:default");
      if (!raw) {
        return {};
      }
      try {
        return JSON.parse(raw) as Record<string, { roomKeyHex?: string }>;
      } catch {
        return {};
      }
    };

    const roomKeyMap = readRoomKeyMap();
    const roomKeyHex = roomKeyMap[targetGroupId]?.roomKeyHex?.trim() || null;
    // L3 cares that the *target* group key is absent — other groups may retain keys.
    const localRoomKeyCount = roomKeyHex ? 1 : 0;

    const ledgerKeys = Object.keys(localStorage).filter((key) => (
      key.includes("obscur.group.membership_ledger.v1")
    ));

    let communityId: string | null = null;
    let joined = false;
    for (const ledgerKey of ledgerKeys) {
      try {
        const raw = localStorage.getItem(ledgerKey);
        if (!raw) {
          continue;
        }
        const parsed: unknown = JSON.parse(raw);
        const entries = Array.isArray(parsed)
          ? parsed
          : (
            parsed && typeof parsed === "object" && Array.isArray((parsed as { entries?: unknown }).entries)
              ? (parsed as { entries: ReadonlyArray<{
                status?: string;
                groupId?: string;
                communityId?: string;
                relayUrl?: string;
              }> }).entries
              : []
          );
        const entry = entries.find((row) => (
          row.status === "joined" && row.groupId?.trim() === targetGroupId
        ));
        if (entry) {
          joined = true;
          const existing = entry.communityId?.trim() ?? "";
          if (existing) {
            communityId = existing;
          } else {
            const relay = entry.relayUrl?.trim() || "ws://localhost:7000";
            communityId = `${targetGroupId}:${relay}`;
          }
          break;
        }
      } catch {
        // try next ledger key
      }
    }

    return {
      communityId,
      joined,
      roomKeyHex,
      localRoomKeyCount,
      profileScope,
    };
  }, { targetGroupId: groupId })
);

export const clearSliceCL3LocalRoomKey = async (
  page: Page,
  groupId = SLICE_C_L3_GROUP_ID,
): Promise<Readonly<{ cleared: boolean; localRoomKeyCount: number }>> => (
  page.evaluate(({ targetGroupId }) => {
    const profileScope = localStorage.getItem("obscur.profile.active.v1")
      ?? localStorage.getItem("obscur.profile.active")
      ?? "default";
    const storageKey = `obscur:room-keys:v1:${profileScope}`;
    const raw = localStorage.getItem(storageKey) ?? localStorage.getItem("obscur:room-keys:v1:default");
    if (!raw) {
      return { cleared: false, localRoomKeyCount: 0 };
    }
    try {
      const parsed = JSON.parse(raw) as Record<string, unknown>;
      delete parsed[targetGroupId];
      localStorage.setItem(storageKey, JSON.stringify(parsed));
      const remainingTarget = (() => {
        const entry = parsed[targetGroupId];
        if (!entry || typeof entry !== "object") {
          return 0;
        }
        const hex = (entry as { roomKeyHex?: string }).roomKeyHex?.trim() ?? "";
        return hex.length > 0 ? 1 : 0;
      })();
      return { cleared: true, localRoomKeyCount: remainingTarget };
    } catch {
      return { cleared: false, localRoomKeyCount: 0 };
    }
  }, { targetGroupId: groupId })
);

export const assertSliceCL3Tester1Identity = async (page: Page): Promise<string> => {
  const expected = TESTER1_DERIVED_PUBLIC_KEY_HEX.toLowerCase();
  // Phase 3: Dev Lab gone — read identity from local session surfaces, not obscurDevLab.
  const pubkey = await page.evaluate((expectedHex) => {
    const normalize = (value: unknown): string | null => {
      if (typeof value !== "string") {
        return null;
      }
      const trimmed = value.trim().toLowerCase();
      return /^[0-9a-f]{64}$/.test(trimmed) ? trimmed : null;
    };

    const fromDiagnostics = normalize(
      window.obscurDeliveryDiagnostics?.getSnapshot?.()?.myPublicKeyHex,
    );
    if (fromDiagnostics) {
      return fromDiagnostics;
    }

    const bound = normalize(localStorage.getItem("obscur.profile_window.last_bound_account::default"));
    if (bound) {
      return bound;
    }

    for (const key of ["obscur.identity.record::default", "identity::default"] as const) {
      const raw = localStorage.getItem(key);
      if (!raw) {
        continue;
      }
      try {
        const parsed = JSON.parse(raw) as { publicKeyHex?: string };
        const fromRecord = normalize(parsed.publicKeyHex);
        if (fromRecord) {
          return fromRecord;
        }
      } catch {
        // ignore
      }
    }

    const body = (document.body?.innerText ?? "").toLowerCase();
    if (body.includes(expectedHex.slice(0, 8)) && body.includes(expectedHex.slice(-8))) {
      return expectedHex;
    }
    return null;
  }, expected);
  if (!pubkey || pubkey !== expected) {
    throw new Error(
      `Expected Tester1 pubkey …${expected.slice(-8)}; got ${pubkey ? pubkey.slice(-8) : "none"}. `
      + "Unlock Tester1 in Tauri before running Slice C L3.",
    );
  }
  return pubkey;
};

export const captureSliceCL3DigestEvents = async (
  page: Page,
  windowSize = 500,
): Promise<SliceCL3EventSnapshot> => (
  page.evaluate((size) => {
    const digest = window.obscurAppEvents?.getCrossDeviceSyncDigest?.(size) as {
      events?: Record<string, ReadonlyArray<Record<string, unknown>>>;
    } | null;
    const events = digest?.events ?? {};
    return {
      resolveEvents: events["groups.coordination_room_key_resolve"] ?? [],
      materializedEvents: events["groups.coordination_room_key_materialized"] ?? [],
      blockedEvents: events["groups.room_key_missing_send_blocked"] ?? [],
    };
  }, windowSize)
);

export const readSliceCL3InvalidEntries = async (page: Page): Promise<number | null> => (
  page.evaluate(() => {
    const digest = window.obscurAppEvents?.getCrossDeviceSyncDigest?.(600) as {
      events?: Record<string, ReadonlyArray<{ context?: Record<string, unknown> }>>;
    } | null;
    const loads = digest?.events?.["groups.membership_ledger_load"] ?? [];
    const latest = loads[loads.length - 1]?.context;
    const invalidEntries = latest?.invalidEntries;
    return typeof invalidEntries === "number" ? invalidEntries : null;
  })
);

export const waitForSliceCL3InvalidEntries = async (
  page: Page,
  options?: Readonly<{ timeoutMs?: number }>,
): Promise<number> => {
  const timeoutMs = options?.timeoutMs ?? 60_000;
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const invalidEntries = await readSliceCL3InvalidEntries(page);
    if (invalidEntries !== null) {
      return invalidEntries;
    }
    await page.waitForTimeout(1000);
  }
  return 0;
};

export const navigateSliceCL3Shell = async (
  page: Page,
  target: "network" | "chats",
): Promise<void> => {
  const label = target === "network" ? "Network" : "Chats";
  const link = page.getByRole("link", { name: label, exact: true });
  if (await link.isVisible().catch(() => false)) {
    await link.click();
    await page.waitForLoadState("domcontentloaded");
  }
};

export const openSliceCL3NewTest2Chat = async (page: Page): Promise<void> => {
  const chatsLink = page.getByRole("link", { name: "Chats", exact: true });
  if (await chatsLink.isVisible().catch(() => false)) {
    await chatsLink.click();
    await page.waitForLoadState("domcontentloaded");
  } else if (!page.url().endsWith("/") && !page.url().includes("/?")) {
    await page.evaluate(() => {
      window.location.assign(`${window.location.origin}/`);
    });
    await page.waitForLoadState("domcontentloaded");
  }

  const groupTab = page.getByRole("button", { name: /^group$/i });
  await groupTab.waitFor({ state: "visible", timeout: 60_000 });
  await groupTab.click();
  await page.waitForTimeout(1000);

  // Rejoin / kernel preview may persist "Community <prefix>" instead of the original display name.
  const byName = page.getByRole("button", { name: new RegExp(SLICE_C_L3_GROUP_NAME, "i") });
  const byIdPrefix = page.getByRole("button", {
    name: new RegExp(`Community\\s+${SLICE_C_L3_GROUP_ID.slice(0, 8)}`, "i"),
  });
  const byGroupId = page.getByRole("button", { name: new RegExp(SLICE_C_L3_GROUP_ID.slice(0, 8), "i") });
  const sidebarButton = byName.or(byIdPrefix).or(byGroupId).first();
  await sidebarButton.waitFor({ state: "visible", timeout: 60_000 });
  await sidebarButton.click();
  await page.waitForLoadState("domcontentloaded");
  await page.waitForTimeout(1500);
};

export const sendSliceCL3GroupMessage = async (page: Page, text: string): Promise<void> => {
  const textarea = page.getByPlaceholder(/type a message|message/i).first();
  await textarea.waitFor({ state: "visible", timeout: 60_000 });
  await textarea.fill(text);

  // Amber relay toasts sit in pointer-events-auto overlays and block Send clicks.
  // Do NOT match generic "Close" — that can hit the title-bar / window control and exit Tauri.
  const dismissToast = page.getByRole("button", { name: /^dismiss$/i })
    .or(page.getByRole("button", { name: /^retry$/i }))
    .first();
  if (await dismissToast.isVisible().catch(() => false)) {
    await dismissToast.click({ force: true }).catch(() => undefined);
    await page.waitForTimeout(300).catch(() => undefined);
  }
  await page.evaluate(() => {
    document.querySelectorAll(".fixed.bottom-4.right-4").forEach((node) => {
      if (node instanceof HTMLElement) {
        node.style.pointerEvents = "none";
      }
    });
  }).catch(() => undefined);

  await textarea.press("Enter");
  const sendButton = page.getByRole("button", { name: /^send$/i }).last();
  const stillPending = await textarea.inputValue().catch(() => text);
  if (stillPending.trim() === text.trim()) {
    await sendButton.click({ force: true });
  }
  await page.waitForTimeout(2500);
};

export const writeSliceCL3Report = async (
  reportPath: string,
  payload: Record<string, unknown>,
): Promise<void> => {
  const fs = await import("node:fs");
  const path = await import("node:path");
  fs.mkdirSync(path.dirname(reportPath), { recursive: true });
  fs.writeFileSync(reportPath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
};
