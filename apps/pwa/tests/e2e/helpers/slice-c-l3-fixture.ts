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
    const localRoomKeyCount = Object.values(roomKeyMap).filter(
      (record) => typeof record?.roomKeyHex === "string" && record.roomKeyHex.trim().length > 0,
    ).length;

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
      const remaining = Object.values(parsed).filter(
        (record) => (
          typeof record === "object"
          && record !== null
          && typeof (record as { roomKeyHex?: string }).roomKeyHex === "string"
          && ((record as { roomKeyHex?: string }).roomKeyHex ?? "").trim().length > 0
        ),
      ).length;
      return { cleared: true, localRoomKeyCount: remaining };
    } catch {
      return { cleared: false, localRoomKeyCount: 0 };
    }
  }, { targetGroupId: groupId })
);

export const assertSliceCL3Tester1Identity = async (page: Page): Promise<string> => {
  const pubkey = await page.evaluate(() => window.obscurDevLab?.getMyPublicKeyHex?.() ?? null);
  const expected = TESTER1_DERIVED_PUBLIC_KEY_HEX.toLowerCase();
  if (!pubkey || pubkey.trim().toLowerCase() !== expected) {
    throw new Error(
      `Expected Tester1 pubkey …${expected.slice(-8)}; got ${pubkey ? pubkey.slice(-8) : "none"}. `
      + "Unlock Tester1 in Tauri before running Slice C L3.",
    );
  }
  return pubkey.trim().toLowerCase();
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

  const sidebarButton = page.getByRole("button", { name: new RegExp(SLICE_C_L3_GROUP_NAME, "i") }).first();
  await sidebarButton.waitFor({ state: "visible", timeout: 60_000 });
  await sidebarButton.click();
  await page.waitForLoadState("domcontentloaded");
  await page.waitForTimeout(1500);
};

export const sendSliceCL3GroupMessage = async (page: Page, text: string): Promise<void> => {
  const textarea = page.getByPlaceholder(/type a message|message/i).first();
  await textarea.waitFor({ state: "visible", timeout: 60_000 });
  await textarea.fill(text);
  const sendButton = page.getByRole("button", { name: /^send$/i }).last();
  await sendButton.click();
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
