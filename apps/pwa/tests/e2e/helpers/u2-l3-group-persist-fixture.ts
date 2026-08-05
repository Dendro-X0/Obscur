import type { Page } from "@playwright/test";
import { SLICE_C_L3_GROUP_ID } from "./slice-c-l3-fixture";

export const U2_L3_GROUP_ID = SLICE_C_L3_GROUP_ID;
export const U2_L3_PROFILE_ID = process.env.OBSCUR_U2_L3_PROFILE_ID?.trim() || "default";

export type U2L3EngineInvokeResult = Readonly<{
  ok: boolean;
  data?: unknown;
  errorCode?: string | null;
  errorMessage?: string | null;
  invokeError?: string | null;
}>;

export const invokeWorkspaceEngine = async (
  page: Page,
  method: string,
  payload: Record<string, unknown> | null,
  profileId = U2_L3_PROFILE_ID,
): Promise<U2L3EngineInvokeResult> => (
  page.evaluate(
    async ({ methodName, requestPayload, scopeProfileId }) => {
      const invoke =
        (window as Window & {
          __TAURI_INTERNALS__?: { invoke?: (cmd: string, args?: Record<string, unknown>) => Promise<unknown> };
          __TAURI__?: { core?: { invoke?: (cmd: string, args?: Record<string, unknown>) => Promise<unknown> } };
        }).__TAURI_INTERNALS__?.invoke
        ?? (window as Window & {
          __TAURI__?: { core?: { invoke?: (cmd: string, args?: Record<string, unknown>) => Promise<unknown> } };
        }).__TAURI__?.core?.invoke;
      if (typeof invoke !== "function") {
        return { ok: false, invokeError: "no Tauri invoke" };
      }
      try {
        const result = await invoke("engine_invoke", {
          request: {
            engine: "workspace",
            method: methodName,
            scope: { profileId: scopeProfileId },
            ...(requestPayload ? { payload: requestPayload } : { payload: {} }),
          },
        }) as {
          ok?: boolean;
          data?: unknown;
          errorCode?: string;
          errorMessage?: string;
          error_code?: string;
          error_message?: string;
        };
        return {
          ok: result?.ok === true,
          data: result?.data,
          errorCode: result?.errorCode ?? result?.error_code ?? null,
          errorMessage: result?.errorMessage ?? result?.error_message ?? null,
          invokeError: null,
        };
      } catch (error) {
        return {
          ok: false,
          invokeError: error instanceof Error ? error.message : String(error),
        };
      }
    },
    { methodName: method, requestPayload: payload, scopeProfileId: profileId },
  )
);

export const listWorkspaceGroupsViaEngine = async (
  page: Page,
  profileId = U2_L3_PROFILE_ID,
): Promise<Readonly<{
  ok: boolean;
  rows: ReadonlyArray<{ id?: string; name?: string }>;
  errorMessage?: string | null;
}>> => {
  const result = await invokeWorkspaceEngine(page, "listGroups", {}, profileId);
  if (!result.ok || !Array.isArray(result.data)) {
    return {
      ok: result.ok,
      rows: [],
      errorMessage: result.errorMessage ?? result.invokeError ?? null,
    };
  }
  return {
    ok: true,
    rows: result.data as ReadonlyArray<{ id?: string; name?: string }>,
    errorMessage: null,
  };
};

export const upsertWorkspaceGroupViaEngine = async (
  page: Page,
  params: Readonly<{
    groupId?: string;
    name?: string;
    relayUrl?: string;
    profileId?: string;
  }> = {},
): Promise<U2L3EngineInvokeResult> => (
  invokeWorkspaceEngine(
    page,
    "upsertGroup",
    {
      id: params.groupId ?? U2_L3_GROUP_ID,
      profile_id: params.profileId ?? U2_L3_PROFILE_ID,
      name: params.name ?? "NewTest 2",
      relay_url: params.relayUrl ?? "ws://localhost:7000",
      kind: "invite-only",
      joined_at: Date.now(),
    },
    params.profileId ?? U2_L3_PROFILE_ID,
  )
);

export const listWorkspaceGroupMessagesViaEngine = async (
  page: Page,
  params: Readonly<{ groupId?: string; limit?: number; profileId?: string }> = {},
): Promise<Readonly<{
  ok: boolean;
  rows: ReadonlyArray<{ event_id?: string; plaintext?: string; group_id?: string }>;
  errorMessage?: string | null;
}>> => {
  const result = await invokeWorkspaceEngine(
    page,
    "listGroupMessages",
    {
      groupId: params.groupId ?? U2_L3_GROUP_ID,
      limit: params.limit ?? 50,
    },
    params.profileId ?? U2_L3_PROFILE_ID,
  );
  if (!result.ok || !Array.isArray(result.data)) {
    return {
      ok: result.ok,
      rows: [],
      errorMessage: result.errorMessage ?? result.invokeError ?? null,
    };
  }
  return {
    ok: true,
    rows: result.data as ReadonlyArray<{ event_id?: string; plaintext?: string; group_id?: string }>,
    errorMessage: null,
  };
};

/** Non-UUID event id so appendGroupThreadMessage durability path is not suspended. */
export const insertWorkspaceGroupMessageViaEngine = async (
  page: Page,
  params: Readonly<{
    groupId?: string;
    plaintext: string;
    senderPubkey: string;
    profileId?: string;
    eventId?: string;
  }>,
): Promise<U2L3EngineInvokeResult> => {
  const now = Date.now();
  const eventId = params.eventId?.trim()
    || `u2l3${now.toString(16)}${"0".repeat(48)}`.slice(0, 64);
  return invokeWorkspaceEngine(
    page,
    "insertGroupMessage",
    {
      event_id: eventId,
      group_id: params.groupId ?? U2_L3_GROUP_ID,
      profile_id: params.profileId ?? U2_L3_PROFILE_ID,
      sender_pubkey: params.senderPubkey,
      plaintext: params.plaintext,
      created_at: Math.floor(now / 1000),
      received_at: now,
    },
    params.profileId ?? U2_L3_PROFILE_ID,
  );
};

export const waitForWorkspaceGroupMessageMarker = async (
  page: Page,
  params: Readonly<{
    messageText: string;
    groupId?: string;
    timeoutMs?: number;
  }>,
): Promise<Readonly<{
  hit: boolean;
  rows: ReadonlyArray<{ event_id?: string; plaintext?: string; group_id?: string }>;
  ok: boolean;
  errorMessage?: string | null;
}>> => {
  const deadline = Date.now() + (params.timeoutMs ?? 45_000);
  let last = await listWorkspaceGroupMessagesViaEngine(page, {
    groupId: params.groupId,
    limit: 100,
  });
  while (Date.now() < deadline) {
    const hit = last.rows.some((row) => (row.plaintext ?? "").includes(params.messageText));
    if (hit) {
      return { hit: true, rows: last.rows, ok: last.ok, errorMessage: last.errorMessage };
    }
    await page.waitForTimeout(1500);
    last = await listWorkspaceGroupMessagesViaEngine(page, {
      groupId: params.groupId,
      limit: 100,
    });
  }
  return {
    hit: last.rows.some((row) => (row.plaintext ?? "").includes(params.messageText)),
    rows: last.rows,
    ok: last.ok,
    errorMessage: last.errorMessage,
  };
};

export const writeU2L3Report = async (
  reportPath: string,
  payload: Record<string, unknown>,
): Promise<void> => {
  const fs = await import("node:fs");
  const path = await import("node:path");
  fs.mkdirSync(path.dirname(reportPath), { recursive: true });
  fs.writeFileSync(reportPath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
};
