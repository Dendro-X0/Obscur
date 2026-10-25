import { describe, expect, it } from "vitest";
import {
  CALL_UI_PREVIEW_SCENES,
  isDevUiLabRoute,
  nextCallUiPreviewSceneId,
  resolveCallUiPreviewScene,
} from "./call-ui-preview-scenes";

describe("call-ui-preview-scenes", () => {
  it("resolves known scenes and falls back for unknown ids", () => {
    expect(resolveCallUiPreviewScene("video_connected_fullscreen").presentation).toBe("fullscreen");
    expect(resolveCallUiPreviewScene("nope").id).toBe(CALL_UI_PREVIEW_SCENES[0]!.id);
  });

  it("cycles through every scene without stalling", () => {
    let current = CALL_UI_PREVIEW_SCENES[0]!.id;
    const seen = new Set<string>();
    for (let i = 0; i < CALL_UI_PREVIEW_SCENES.length; i += 1) {
      seen.add(current);
      current = nextCallUiPreviewSceneId(current);
    }
    expect(seen.size).toBe(CALL_UI_PREVIEW_SCENES.length);
    expect(current).toBe(CALL_UI_PREVIEW_SCENES[0]!.id);
  });

  it("recognizes lab routes for unlock bypass", () => {
    expect(isDevUiLabRoute("/lab/call-ui-preview")).toBe(true);
    expect(isDevUiLabRoute("/network")).toBe(false);
  });
});
