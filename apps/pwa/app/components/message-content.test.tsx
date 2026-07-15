import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
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

  it("prompts before opening suspicious links", () => {
    const openSpy = vi.spyOn(window, "open").mockImplementation(() => null);
    render(<MessageContent content="Verify at http://bit.ly/secure-account-reset" isOutgoing={false} />);

    fireEvent.click(screen.getByRole("link"));
    expect(screen.getByTestId("link-open-confirm-dialog")).toBeInTheDocument();
    expect(openSpy).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "security.linkSafety.confirm" }));
    expect(openSpy).toHaveBeenCalledWith(
      "http://bit.ly/secure-account-reset",
      "_blank",
      "noopener,noreferrer",
    );
    openSpy.mockRestore();
  });
});
