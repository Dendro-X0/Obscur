import { describe, expect, it } from "vitest";
import { normalizeLocalMediaDisplayFileName } from "./local-media-store";

describe("normalizeLocalMediaDisplayFileName", () => {
  it("strips legacy hashed cache prefixes", () => {
    expect(
      normalizeLocalMediaDisplayFileName("1773599289052-7c5c224c67561c473a5fd14c-kontraa-no-sleep-hiphop-music-473847.mp3"),
    ).toBe("kontraa-no-sleep-hiphop-music-473847.mp3");
  });

  it("keeps regular file names unchanged", () => {
    expect(normalizeLocalMediaDisplayFileName("meeting-notes.pdf")).toBe("meeting-notes.pdf");
  });
});
