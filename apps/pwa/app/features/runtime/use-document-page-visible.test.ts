import { describe, expect, it } from "vitest";
import { isDocumentPageVisible } from "./use-document-page-visible";

describe("isDocumentPageVisible", () => {
  it("returns true when document is undefined (SSR)", () => {
    expect(isDocumentPageVisible()).toBe(true);
  });
});
