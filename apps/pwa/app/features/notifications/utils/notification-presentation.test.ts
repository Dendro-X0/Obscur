import { describe, expect, it } from "vitest";
import {
  buildConversationNotificationHref,
  buildIncomingCallNotificationPresentation,
  buildMessageNotificationPresentation,
} from "./notification-presentation";

describe("notification-presentation", () => {
  it("builds conversation deep-links for notification click-through", () => {
    expect(buildConversationNotificationHref("dm:self:peer-1"))
      .toBe("/?convId=dm%3Aself%3Apeer-1");
  });

  it("formats message notifications with context and exact href", () => {
    expect(buildMessageNotificationPresentation({
      senderName: "Tester2",
      preview: "hello there",
      conversationId: "dm:self:peer-2",
      contextLabel: "Direct message",
      timestampLabel: "10:24 AM",
    })).toEqual({
      title: "New message from Tester2",
      body: "Direct message • 10:24 AM\nhello there",
      href: "/?convId=dm%3Aself%3Apeer-2",
    });
  });

  it("formats incoming call notifications with follow-up hint copy", () => {
    expect(buildIncomingCallNotificationPresentation({
      displayName: "Tester2",
      href: "/?convId=dm%3Aself%3Apeer-2",
    })).toEqual({
      title: "Incoming voice call from Tester2",
      body: "Open chat in Obscur to respond.",
      href: "/?convId=dm%3Aself%3Apeer-2",
    });
  });
});
