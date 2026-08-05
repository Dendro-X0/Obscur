import { describe, expect, it } from "vitest";
import { resolveNotificationPeerIconUrl } from "./notification-peer-icon";

describe("resolveNotificationPeerIconUrl", () => {
  it("prefers group avatar https over sender picture", () => {
    expect(resolveNotificationPeerIconUrl({
      groupAvatar: "https://cdn.example.com/group.png",
      senderPicture: "https://cdn.example.com/peer.png",
    })).toBe("https://cdn.example.com/group.png");
  });

  it("uses sender picture when group avatar missing", () => {
    expect(resolveNotificationPeerIconUrl({
      senderPicture: "https://cdn.example.com/peer.png",
    })).toBe("https://cdn.example.com/peer.png");
  });

  it("rejects non-https and empty candidates", () => {
    expect(resolveNotificationPeerIconUrl({
      groupAvatar: "/uploads/avatar.png",
      senderPicture: "data:image/png;base64,aaa",
    })).toBeUndefined();
    expect(resolveNotificationPeerIconUrl({
      senderPicture: "http://cdn.example.com/peer.png",
    })).toBeUndefined();
    expect(resolveNotificationPeerIconUrl({})).toBeUndefined();
  });

  it("coerces protocol-relative URLs to https", () => {
    expect(resolveNotificationPeerIconUrl({
      senderPicture: "//cdn.example.com/peer.png",
    })).toBe("https://cdn.example.com/peer.png");
  });
});
