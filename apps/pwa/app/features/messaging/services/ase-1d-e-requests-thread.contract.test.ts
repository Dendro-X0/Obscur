import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const read = (relativePath: string): string => (
  readFileSync(resolve(process.cwd(), relativePath), "utf8")
);

describe("ASE-1d-e Requests sandbox thread UI", () => {
  it("uses ContactRequestThreadBanner in chat-view for sandbox threads", () => {
    const source = read("app/features/messaging/components/chat-view.tsx");
    expect(source).toContain("ContactRequestThreadBanner");
    expect(source).toMatch(/contactRequestComposeMode === "sandbox_text"/);
  });

  it("pins identity binding with accept/decline in the thread banner", () => {
    const source = read("app/features/messaging/components/contact-request-thread-banner.tsx");
    expect(source).toContain("IdentityBindingPanel");
    expect(source).toContain("IdentityBindingAcceptDialog");
    expect(source).toMatch(/data-testid="contact-request-thread-banner"/);
  });
});
