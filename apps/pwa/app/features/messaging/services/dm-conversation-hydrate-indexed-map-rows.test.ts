import { describe, expect, it } from "vitest";
import type { Message } from "../types";
import { mapIndexedConversationRowsForDisplayableScan } from "./dm-conversation-hydrate-indexed-map-rows";

const mk = (partial: Readonly<{ id: string; kind?: Message["kind"]; ts?: number; content?: string }>): Message => ({
  id: partial.id,
  kind: partial.kind ?? "user",
  content: partial.content ?? "",
  timestamp: new Date(partial.ts ?? 1),
  isOutgoing: false,
  status: "delivered",
});

const isDisplayable = (m: Message): boolean => m.kind !== "command";

describe("mapIndexedConversationRowsForDisplayableScan", () => {
  it("initial_hydrate: applies tombstone then retention/dedupe then displayable filter", () => {
    const suppressed = new Set<string>(["gone"]);
    const rows = [
      { id: "gone", kind: "user", ts: 300, content: "a" },
      { id: "keep", kind: "user", ts: 200, content: "b" },
      { id: "cmd", kind: "command", ts: 100, content: "{}" },
    ];
    const out = mapIndexedConversationRowsForDisplayableScan({
      pipeline: "initial_hydrate",
      rows,
      normalizeRow: (raw: any) => mk({
        id: String(raw.id),
        kind: raw.kind,
        ts: Number(raw.ts),
        content: String(raw.content ?? ""),
      }),
      persistentSuppressedMessageIds: suppressed,
      isDisplayable,
      localMessageRetentionDays: undefined,
    });
    expect(out.map((m) => m.id)).toEqual(["keep"]);
  });

  it("load_earlier: drops non-displayable before dedupe (command never retained)", () => {
    const rows = [
      { id: "u1", kind: "user", ts: 200, content: "x" },
      { id: "c1", kind: "command", ts: 100, content: "{}" },
    ];
    const out = mapIndexedConversationRowsForDisplayableScan({
      pipeline: "load_earlier",
      rows,
      normalizeRow: (raw: any) => mk({
        id: String(raw.id),
        kind: raw.kind,
        ts: Number(raw.ts),
      }),
      persistentSuppressedMessageIds: new Set(),
      isDisplayable,
      localMessageRetentionDays: undefined,
    });
    expect(out).toHaveLength(1);
    expect(out[0]?.id).toBe("u1");
  });

  it("reverses row order before mapping (IDB prev → chronological)", () => {
    const rows = [
      { id: "older", kind: "user", ts: 100, content: "" },
      { id: "newer", kind: "user", ts: 200, content: "" },
    ];
    const order: string[] = [];
    mapIndexedConversationRowsForDisplayableScan({
      pipeline: "initial_hydrate",
      rows,
      normalizeRow: (raw: any) => {
        order.push(String(raw.id));
        return mk({ id: String(raw.id), ts: Number(raw.ts) });
      },
      persistentSuppressedMessageIds: new Set(),
      isDisplayable,
      localMessageRetentionDays: undefined,
    });
    expect(order).toEqual(["newer", "older"]);
  });
});
