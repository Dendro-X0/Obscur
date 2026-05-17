import { describe, expect, it } from "vitest";
import {
  DM_DELETE_FOR_EVERYONE_UI_ENABLED,
  DM_HIDE_PRESERVE_TIMELINE_FOR_SHOW_AGAIN,
  DM_LOCAL_VISIBILITY_COPY,
  DM_RECALL_FOR_EVERYONE_UI_ENABLED,
} from "./dm-local-visibility-product";

describe("dm-local-visibility-product", () => {
  it("keeps cooperative delete/recall UI disabled for v1.5.1", () => {
    expect(DM_DELETE_FOR_EVERYONE_UI_ENABLED).toBe(false);
    expect(DM_RECALL_FOR_EVERYONE_UI_ENABLED).toBe(false);
  });

  it("uses honest hide copy", () => {
    expect(DM_LOCAL_VISIBILITY_COPY.hideOnThisDevice).toMatch(/Hide on this device/i);
    expect(DM_LOCAL_VISIBILITY_COPY.showAgainOnThisDevice).toMatch(/Show again/i);
    expect(DM_LOCAL_VISIBILITY_COPY.batchScopeHelper).toMatch(/this device only/i);
  });

  it("preserves timeline for show-again reversal", () => {
    expect(DM_HIDE_PRESERVE_TIMELINE_FOR_SHOW_AGAIN).toBe(true);
  });
});
