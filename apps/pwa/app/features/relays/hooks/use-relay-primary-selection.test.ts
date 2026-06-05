import { describe, expect, it } from "vitest";
import { act, renderHook } from "@testing-library/react";
import { useRelayPrimarySelection } from "./use-relay-primary-selection";
import type { RelayHealthHint } from "../services/relay-primary-selector";

const URLS = ["wss://relay.damus.io", "ws://localhost:7000"] as const;

const hintsFor = (primaryOpen: boolean, standbyOpen: boolean): ReadonlyArray<RelayHealthHint> => ([
  {
    url: URLS[0],
    isOpen: primaryOpen,
    isWritable: primaryOpen,
    isCircuitOpen: false,
    listIndex: 0,
    latencyMs: 120,
  },
  {
    url: URLS[1],
    isOpen: standbyOpen,
    isWritable: standbyOpen,
    isCircuitOpen: false,
    listIndex: 1,
    latencyMs: 40,
  },
]);

describe("useRelayPrimarySelection", () => {
  it("does not auto-reconcile when health hints change (supervisor-owned failover)", () => {
    const initialHints = hintsFor(true, false);
    const { result, rerender } = renderHook(
      ({ hints }) => useRelayPrimarySelection(URLS, hints),
      { initialProps: { hints: initialHints } },
    );

    const initialPrimary = result.current.selection.primaryUrl;
    expect(initialPrimary).toBe(URLS[0]);

    rerender({ hints: hintsFor(false, true) });

    expect(result.current.selection.primaryUrl).toBe(initialPrimary);
  });

  it("switches primary only on explicit triggerFailover", () => {
    const { result, rerender } = renderHook(
      ({ hints }) => useRelayPrimarySelection(URLS, hints),
      { initialProps: { hints: hintsFor(true, false) } },
    );

    expect(result.current.selection.primaryUrl).toBe(URLS[0]);

    act(() => {
      result.current.triggerFailover(hintsFor(false, true));
    });

    expect(result.current.selection.primaryUrl).toBe(URLS[1]);

    rerender({ hints: hintsFor(false, true) });
    expect(result.current.selection.primaryUrl).toBe(URLS[1]);
  });
});
