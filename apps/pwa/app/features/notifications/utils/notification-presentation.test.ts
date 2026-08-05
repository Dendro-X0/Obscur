import { describe, expect, it } from "vitest";
import {
  buildConversationNotificationHref,
  buildIncomingCallNotificationPresentation,
  buildMessageNotificationPresentation,
} from "./notification-presentation";
import {
  notificationContentKindEmoji,
  resolveNotificationContentKindFromPreview,
} from "./notification-content-kind";

describe("notification-presentation", () => {
  it("builds conversation deep-links for notification click-through", () => {
    expect(buildConversationNotificationHref("dm:self:peer-1"))
      .toBe("/?convId=dm%3Aself%3Apeer-1");
  });

  it("formats message notifications with title sans emoji and single body glyph", () => {
    const presentation = buildMessageNotificationPresentation({
      senderName: "Tester2",
      preview: "hello there",
      conversationId: "dm:self:peer-2",
      contextLabel: "Direct message",
      timestampLabel: "10:24 AM",
    });
    expect(presentation.contentKind).toBe("text");
    expect(presentation.title).toBe("New message from Tester2");
    expect(presentation.title).not.toContain(notificationContentKindEmoji("text"));
    expect(presentation.body).toBe(
      `${notificationContentKindEmoji("text")} Direct message • 10:24 AM\nhello there`,
    );
    expect(presentation.href).toBe("/?convId=dm%3Aself%3Apeer-2");
    expect(presentation.icon).toMatch(/^data:image\/svg\+xml/);
  });

  it("classifies image previews for notification glyphs", () => {
    expect(resolveNotificationContentKindFromPreview(
      "Image (garrett-parker-DlkF4-dbCOU-unsplash.jpg)",
    )).toBe("image");
    const presentation = buildMessageNotificationPresentation({
      senderName: "Tester2",
      preview: "Image (photo.jpg)",
      conversationId: "dm:self:peer-2",
      timestampLabel: "2:43 AM",
    });
    expect(presentation.contentKind).toBe("image");
    expect(presentation.title).toBe("New message from Tester2");
    expect(presentation.body.startsWith(notificationContentKindEmoji("image"))).toBe(true);
  });

  it("formats incoming call notifications with name title and single preview body", () => {
    const presentation = buildIncomingCallNotificationPresentation({
      displayName: "Tester2",
      href: "/?convId=dm%3Aself%3Apeer-2",
    });
    expect(presentation.contentKind).toBe("call");
    expect(presentation.title).toBe("Tester2");
    expect(presentation.body).toBe("Incoming voice call");
    expect(presentation.body).not.toContain(notificationContentKindEmoji("call"));
    expect(presentation.title).not.toContain(notificationContentKindEmoji("call"));
    expect(presentation.href).toBe("/?convId=dm%3Aself%3Apeer-2");
    expect(presentation.icon).toMatch(/^data:image\/svg\+xml/);
  });

  it("prefers peer avatar URL over content-kind SVG for message and call", () => {
    const avatar = "https://cdn.example.com/peer.png";
    const message = buildMessageNotificationPresentation({
      senderName: "Tester2",
      preview: "hello",
      conversationId: "dm:self:peer-2",
      iconUrl: avatar,
    });
    expect(message.icon).toBe(avatar);
    const call = buildIncomingCallNotificationPresentation({
      displayName: "Tester2",
      iconUrl: avatar,
    });
    expect(call.icon).toBe(avatar);
  });
});
