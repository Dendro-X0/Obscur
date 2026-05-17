import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { MessageContent } from "./message-content";

describe("MessageContent", () => {
  it("returns null for blank content", () => {
    const { container } = render(<MessageContent content={"   \n  "} isOutgoing={false} />);
    expect(container.firstChild).toBeNull();
  });

  it("keeps long unbroken content wrap-safe inside message bubbles", () => {
    const longUrl = `https://example.com/${"a".repeat(240)}`;
    const { container } = render(<MessageContent content={longUrl} isOutgoing={false} />);

    const paragraph = container.querySelector("p");
    expect(paragraph).not.toBeNull();
    expect(paragraph?.className).toContain("break-words");
    expect(paragraph?.className).toContain("[overflow-wrap:anywhere]");

    const link = screen.getByRole("link", { name: longUrl });
    expect(link.getAttribute("href")).toBe(longUrl);
    expect(link.className).toContain("break-words");
    expect(link.className).toContain("[overflow-wrap:anywhere]");
  });
});
