import { afterEach, describe, expect, it, vi } from "vitest";
import {
  SEARCH_TARGET_FLASH_CLASS,
  discoverySearchResultElementId,
  flashSearchTargetElement,
  focusSearchTargetById,
  scrollToSearchTargetElement,
  settingsTabPanelElementId,
} from "./search-target-highlight";

describe("search-target-highlight", () => {
  afterEach(() => {
    document.body.innerHTML = "";
  });

  it("builds stable discovery result element ids", () => {
    expect(discoverySearchResultElementId("abc:def")).toBe("discovery-search-result-abc-def");
    expect(settingsTabPanelElementId("relays")).toBe("settings-tab-panel-relays");
  });

  it("scrolls a resolved element", () => {
    const element = document.createElement("section");
    const scrollIntoView = vi.fn();
    element.scrollIntoView = scrollIntoView;
    scrollToSearchTargetElement(element, { block: "center" });
    expect(scrollIntoView).toHaveBeenCalledWith({ behavior: "smooth", block: "center" });
  });

  it("retries focus until the target element mounts", () => {
    vi.useFakeTimers();
    const cleanup = focusSearchTargetById("settings-target-late", {
      scrollDelayMs: 0,
      maxResolveAttempts: 4,
      resolveRetryMs: 50,
      flashDurationMs: 500,
    });

    let element = document.getElementById("settings-target-late");
    expect(element).toBeNull();

    vi.advanceTimersByTime(60);
    element = document.createElement("section");
    element.id = "settings-target-late";
    document.body.appendChild(element);
    const scrollIntoView = vi.fn();
    element.scrollIntoView = scrollIntoView;

    vi.advanceTimersByTime(50);
    expect(scrollIntoView).toHaveBeenCalled();
    expect(element.classList.contains(SEARCH_TARGET_FLASH_CLASS)).toBe(true);

    cleanup();
    vi.useRealTimers();
  });

  it("removes flash class after duration", () => {
    vi.useFakeTimers();
    const element = document.createElement("div");
    document.body.appendChild(element);

    const cleanup = flashSearchTargetElement(element, { durationMs: 500 });
    expect(element.classList.contains(SEARCH_TARGET_FLASH_CLASS)).toBe(true);

    vi.advanceTimersByTime(500);
    expect(element.classList.contains(SEARCH_TARGET_FLASH_CLASS)).toBe(false);

    cleanup();
    vi.useRealTimers();
  });
});
