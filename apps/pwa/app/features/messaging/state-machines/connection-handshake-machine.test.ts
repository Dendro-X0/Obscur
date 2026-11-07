import { describe, expect, it } from "vitest";
import { transitionHandshake } from "./connection-handshake-machine";

describe("transitionHandshake", () => {
  it("demotes accepted to canceled on CANCEL (remote remove notify)", () => {
    expect(
      transitionHandshake(
        { status: "accepted", isOutgoing: false },
        { type: "CANCEL" },
      ),
    ).toEqual({ status: "canceled", isOutgoing: false });
  });

  it("still allows RESET from accepted", () => {
    expect(
      transitionHandshake(
        { status: "accepted", isOutgoing: true },
        { type: "RESET" },
      ),
    ).toEqual({ status: "none", isOutgoing: false });
  });
});
