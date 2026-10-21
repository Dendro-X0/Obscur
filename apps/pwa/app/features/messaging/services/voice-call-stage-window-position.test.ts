import { describe, expect, it } from "vitest";
import {
  clampStageWindowPosition,
  resolveDefaultStageWindowPosition,
} from "./voice-call-stage-window-position";

describe("resolveDefaultStageWindowPosition", () => {
  it("defaults to bottom-right with margin", () => {
    expect(resolveDefaultStageWindowPosition({
      viewport: { width: 1280, height: 800 },
      size: { width: 576, height: 448 },
      marginPx: 16,
    })).toEqual({ left: 1280 - 576 - 16, top: 800 - 448 - 16 });
  });

  it("supports bottom-left anchor", () => {
    expect(resolveDefaultStageWindowPosition({
      viewport: { width: 1000, height: 700 },
      size: { width: 400, height: 300 },
      anchor: "bottom-left",
      marginPx: 20,
    })).toEqual({ left: 20, top: 700 - 300 - 20 });
  });
});

describe("clampStageWindowPosition", () => {
  it("keeps the window inside the viewport", () => {
    expect(clampStageWindowPosition({
      point: { left: -40, top: 900 },
      viewport: { width: 800, height: 600 },
      size: { width: 400, height: 300 },
      marginPx: 16,
    })).toEqual({ left: 16, top: 600 - 300 - 16 });
  });
});
