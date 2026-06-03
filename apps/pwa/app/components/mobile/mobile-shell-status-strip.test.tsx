import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import {
  buildMobileShellStatusItems,
  type BuildMobileShellStatusItemsInput,
} from "./mobile-shell-status-items";
import { MobileShellStatusStrip } from "./mobile-shell-status-strip";

function baseInput(
  overrides: Partial<BuildMobileShellStatusItemsInput> = {},
): BuildMobileShellStatusItemsInput {
  return {
    showRestoreProgress: false,
    showMissingSharedDataWarning: false,
    showHistorySyncNotice: false,
    showProjectionScopeMismatchNotice: false,
    ...overrides,
  };
}

describe("MobileShellStatusStrip", () => {
  it("renders nothing when there are no status items", () => {
    const { container } = render(<MobileShellStatusStrip items={[]} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("renders a single status row without expand control", () => {
    const items = buildMobileShellStatusItems(baseInput({
      showHistorySyncNotice: true,
    }));
    render(<MobileShellStatusStrip items={items} />);
    expect(screen.getByTestId("mobile-shell-status-strip")).toBeInTheDocument();
    expect(screen.getByText("Syncing account history")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /status/i })).not.toBeInTheDocument();
  });

  it("collapses multiple statuses until expanded", () => {
    const items = buildMobileShellStatusItems(baseInput({
      showRestoreProgress: true,
      showHistorySyncNotice: true,
    }));
    render(<MobileShellStatusStrip items={items} />);

    expect(screen.getByText(/1 more/i)).toBeInTheDocument();
    expect(screen.queryByText(/Syncing account history/i)).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /status/i }));
    expect(screen.getByText("Syncing account history")).toBeInTheDocument();
  });

  it("calls onOpenProfiles for scope mismatch action", () => {
    const onOpenProfiles = vi.fn();
    const items = buildMobileShellStatusItems(baseInput({
      showProjectionScopeMismatchNotice: true,
    }));
    render(<MobileShellStatusStrip items={items} onOpenProfiles={onOpenProfiles} />);

    fireEvent.click(screen.getByRole("button", { name: /open profiles/i }));
    expect(onOpenProfiles).toHaveBeenCalledTimes(1);
  });
});
