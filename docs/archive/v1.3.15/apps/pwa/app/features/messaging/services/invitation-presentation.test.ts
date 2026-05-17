import { describe, expect, it } from "vitest";

import {
  getDirectInvitationStatusCopy,
  getDirectInvitationToastCopy,
  getInvitationInboxStatusCopy,
  getInvitationOutboxStatusCopy,
} from "./invitation-presentation";
import type { ContactRequestRecord } from "@/app/features/search/types/discovery";

const baseRecord: ContactRequestRecord = {
  id: "record-1",
  peerPubkey: "peer",
  status: "queued",
  retries: 0,
  createdAtUnixMs: 1000,
  updatedAtUnixMs: 1000,
};

describe("invitation presentation", () => {
  it("maps queued direct delivery to a clear waiting state", () => {
    expect(getDirectInvitationStatusCopy("queued")).toEqual({
      badge: "Waiting for connection",
      title: "Obscur could not finish delivery yet.",
      detail: "It will retry when your relay connection looks healthier.",
      tone: "warning",
    });
  });

  it("maps direct delivery to one canonical success toast", () => {
    expect(getDirectInvitationToastCopy("ok")).toEqual({
      message: "Invitation delivered.",
      tone: "success",
    });
  });

  it("maps outbox retry windows to plain-language detail", () => {
    const result = getInvitationOutboxStatusCopy(
      {
        ...baseRecord,
        status: "failed",
        nextRetryAtUnixMs: 31_000,
      },
      1_000
    );

    expect(result.badge).toBe("Needs attention");
    expect(result.detail).toContain("Obscur will retry automatically");
  });

  it("maps inbox pending state to invitation language", () => {
    expect(getInvitationInboxStatusCopy("pending")).toEqual({
      badge: "New invitation",
      title: "Someone wants to connect with you.",
      detail: "Read their note, then decide whether to accept, ignore, or block.",
      tone: "info",
    });
  });

  it("maps outgoing pending state to sender-safe language", () => {
    expect(getInvitationInboxStatusCopy("pending", true)).toEqual({
      badge: "Invitation sent",
      title: "Obscur is waiting for their response.",
      detail: "You do not need to accept your own invitation.",
      tone: "info",
    });
  });
});
