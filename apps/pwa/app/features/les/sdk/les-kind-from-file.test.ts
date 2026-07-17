import { describe, expect, it } from "vitest";
import { lesKindFromFile } from "./les-kind-from-file";

describe("lesKindFromFile", () => {
  it("maps mime and extension to LES kinds", () => {
    expect(lesKindFromFile({ name: "a.png", type: "image/png" })).toBe("image");
    expect(lesKindFromFile({ name: "b.mp4", type: "video/mp4" })).toBe("video");
    expect(lesKindFromFile({ name: "c.ogg", type: "audio/ogg" })).toBe("audio");
    expect(lesKindFromFile({ name: "notes.pdf", type: "application/pdf" })).toBe("file");
  });
});
