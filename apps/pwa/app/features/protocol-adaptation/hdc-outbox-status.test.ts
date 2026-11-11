import { describe, expect, it } from "vitest";
import {
  assertHomeAckNotDelivered,
  isValidHdcStatusTransition,
  mapHomeAckToStatus,
} from "./hdc-outbox-status";

describe("hdc-outbox-status (Cut 0.7)", () => {
  it("maps home ACK wire statuses to accepted (never delivered)", () => {
    expect(mapHomeAckToStatus("accepted")).toBe("accepted");
    expect(mapHomeAckToStatus("sent")).toBe("accepted");
    expect(mapHomeAckToStatus("delivered")).toBe("accepted");
    expect(mapHomeAckToStatus(null)).toBe("accepted");
    expect(mapHomeAckToStatus("rejected")).toBe("rejected");
    expect(mapHomeAckToStatus("failed")).toBe("failed");
  });

  it("forbids sending → delivered local transition", () => {
    expect(isValidHdcStatusTransition("sending", "delivered")).toBe(false);
    expect(isValidHdcStatusTransition("sending", "accepted")).toBe(true);
    expect(isValidHdcStatusTransition("accepted", "delivered")).toBe(true);
  });

  it("assertHomeAckNotDelivered throws on delivered", () => {
    expect(() => assertHomeAckNotDelivered("accepted")).not.toThrow();
    expect(() => assertHomeAckNotDelivered("delivered")).toThrow(
      /hdc_home_ack_must_not_be_delivered/,
    );
  });
});
