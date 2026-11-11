/**
 * Cut 13.2 — Continuity M6 private-home backfill report (opaque envelopes).
 * ≠ Continuity Pass · ≠ Soft L3 CRM invent · Soft L3 paused.
 * @see specs/backend/cut13-continuity-m6-home-backfill-design-2026-11-10.md
 */

import {
  listPrivateDcHomeConversations,
  listPrivateDcHomeMessageEnvelopesDetailed,
  type PrivateDcHomeCipherEnvelope,
  type PrivateDcHomeSession,
} from "@obscur/private-trust-engine";

export const CONTINUITY_M6_BACKFILL_STORAGE_PREFIX = "obscur.continuity.m6_backfill.v1";

export type ContinuityM6BackfillReport = Readonly<{
  profileId: string;
  ranAtUnixMs: number;
  conversationCount: number;
  envelopeCount: number;
  droppedPlaintextCount: number;
  cursorUnixMs: number;
  envelopeIds: ReadonlyArray<string>;
  honestyNote: "opaque_envelopes_only";
}>;

export const getContinuityM6BackfillStorageKey = (profileId: string): string => (
  `${CONTINUITY_M6_BACKFILL_STORAGE_PREFIX}::${profileId}`
);

const isRecord = (value: unknown): value is Record<string, unknown> => (
  typeof value === "object" && value !== null
);

export const parseContinuityM6BackfillReport = (
  value: unknown,
): ContinuityM6BackfillReport | null => {
  if (!isRecord(value)) {
    return null;
  }
  if (
    typeof value.profileId !== "string"
    || typeof value.ranAtUnixMs !== "number"
    || typeof value.conversationCount !== "number"
    || typeof value.envelopeCount !== "number"
    || typeof value.droppedPlaintextCount !== "number"
    || typeof value.cursorUnixMs !== "number"
    || value.honestyNote !== "opaque_envelopes_only"
  ) {
    return null;
  }
  const envelopeIds = Array.isArray(value.envelopeIds)
    ? value.envelopeIds.filter((row): row is string => typeof row === "string")
    : [];
  return {
    profileId: value.profileId,
    ranAtUnixMs: value.ranAtUnixMs,
    conversationCount: value.conversationCount,
    envelopeCount: value.envelopeCount,
    droppedPlaintextCount: value.droppedPlaintextCount,
    cursorUnixMs: value.cursorUnixMs,
    envelopeIds,
    honestyNote: "opaque_envelopes_only",
  };
};

export const readContinuityM6BackfillReport = (
  profileId: string,
): ContinuityM6BackfillReport | null => {
  if (typeof window === "undefined") {
    return null;
  }
  const raw = window.localStorage.getItem(getContinuityM6BackfillStorageKey(profileId));
  if (!raw) {
    return null;
  }
  try {
    return parseContinuityM6BackfillReport(JSON.parse(raw));
  } catch {
    return null;
  }
};

export const writeContinuityM6BackfillReport = (
  report: ContinuityM6BackfillReport,
): void => {
  if (typeof window === "undefined") {
    return;
  }
  window.localStorage.setItem(
    getContinuityM6BackfillStorageKey(report.profileId),
    JSON.stringify(report),
  );
};

export type RunContinuityM6HomeBackfillParams = Readonly<{
  profileId: string;
  session: PrivateDcHomeSession;
  sinceUnixMs?: number;
  nowUnixMs?: number;
  perConversationLimit?: number;
  fetchImpl?: typeof fetch;
}>;

export type ContinuityM6HomeBackfillResult = Readonly<{
  ok: boolean;
  report?: ContinuityM6BackfillReport;
  envelopes?: ReadonlyArray<PrivateDcHomeCipherEnvelope>;
  error?: string;
  reasonCode?:
    | "home_unavailable"
    | "backfill_failed";
}>;

/**
 * Pull opaque envelopes from private home. Does not invent CRM / Soft L3 trust.
 */
export const runContinuityM6HomeBackfill = async (
  params: RunContinuityM6HomeBackfillParams,
): Promise<ContinuityM6HomeBackfillResult> => {
  const fetchImpl = params.fetchImpl ?? fetch;
  const prior = readContinuityM6BackfillReport(params.profileId);
  const since = params.sinceUnixMs
    ?? prior?.cursorUnixMs
    ?? 0;
  try {
    const conversations = await listPrivateDcHomeConversations(params.session, fetchImpl);
    const envelopes: PrivateDcHomeCipherEnvelope[] = [];
    let droppedPlaintextCount = 0;
    for (const conversation of conversations) {
      const listed = await listPrivateDcHomeMessageEnvelopesDetailed(
        params.session,
        {
          conversationId: conversation.id,
          since,
          limit: params.perConversationLimit,
        },
        fetchImpl,
      );
      envelopes.push(...listed.envelopes);
      droppedPlaintextCount += listed.droppedPlaintextCount;
    }
    const cursorUnixMs = envelopes.reduce(
      (max, row) => (row.sentAtUnixMs > max ? row.sentAtUnixMs : max),
      since,
    );
    const report: ContinuityM6BackfillReport = {
      profileId: params.profileId,
      ranAtUnixMs: params.nowUnixMs ?? Date.now(),
      conversationCount: conversations.length,
      envelopeCount: envelopes.length,
      droppedPlaintextCount,
      cursorUnixMs,
      envelopeIds: envelopes.map((row) => row.id).slice(0, 200),
      honestyNote: "opaque_envelopes_only",
    };
    writeContinuityM6BackfillReport(report);
    return {
      ok: true,
      report,
      envelopes,
    };
  } catch (error) {
    return {
      ok: false,
      reasonCode: "backfill_failed",
      error: error instanceof Error ? error.message : "Continuity M6 home backfill failed",
    };
  }
};
