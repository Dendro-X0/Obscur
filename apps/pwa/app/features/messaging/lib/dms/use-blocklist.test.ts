import { renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { useBlocklist } from "./use-blocklist";

describe("useBlocklist", () => {
  it("does not throw when called without params", () => {
    const { result } = renderHook(() => useBlocklist());
    expect(result.current.state.blockedPublicKeys).toEqual([]);
  });

  it("does not throw when publicKeyHex is null", () => {
    const { result } = renderHook(() => useBlocklist({ publicKeyHex: null }));
    expect(result.current.state.blockedPublicKeys).toEqual([]);
  });
});
