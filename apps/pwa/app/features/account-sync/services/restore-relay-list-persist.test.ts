import { describe, expect, it } from "vitest";
import { mergeRelayListPreferEnabled } from "./restore-relay-list-persist";

describe("mergeRelayListPreferEnabled", () => {
  it("keeps a URL enabled when either side has enabled true", () => {
    const merged = mergeRelayListPreferEnabled(
      [{ url: "wss://nos.lol", enabled: true }],
      [{ url: "wss://nos.lol", enabled: false }],
    );
    expect(merged).toEqual([{ url: "wss://nos.lol", enabled: true }]);
  });

  it("unions distinct URLs from current and incoming", () => {
    const merged = mergeRelayListPreferEnabled(
      [{ url: "wss://a.example", enabled: true }],
      [{ url: "wss://b.example", enabled: false }],
    );
    expect(merged).toEqual([
      { url: "wss://a.example", enabled: true },
      { url: "wss://b.example", enabled: false },
    ]);
  });

  it("does not let a disabled backup row undo a local re-enable after empty current", () => {
    const merged = mergeRelayListPreferEnabled(
      [
        { url: "wss://nos.lol", enabled: true },
        { url: "wss://relay.damus.io", enabled: true },
      ],
      [
        { url: "wss://nos.lol", enabled: false },
        { url: "wss://relay.damus.io", enabled: false },
        { url: "wss://relay.primal.net", enabled: false },
      ],
    );
    expect(merged.filter((relay) => relay.enabled).map((relay) => relay.url).sort()).toEqual([
      "wss://nos.lol",
      "wss://relay.damus.io",
    ]);
  });
});
