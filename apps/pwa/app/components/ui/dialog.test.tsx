import React from "react";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@dweb/ui-kit";

describe("Dialog", () => {
  it("renders centered content with a higher stack layer than the overlay", () => {
    render(
      <Dialog open onOpenChange={() => undefined}>
        <DialogContent showCloseButton={false} className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Test dialog title</DialogTitle>
            <DialogDescription>Test dialog description</DialogDescription>
          </DialogHeader>
        </DialogContent>
      </Dialog>,
    );

    expect(screen.getByText("Test dialog title")).toBeInTheDocument();
    expect(screen.getByText("Test dialog description")).toBeInTheDocument();

    const overlay = document.querySelector('[data-slot="dialog-overlay"]');
    const content = document.querySelector('[data-slot="dialog-content"]');

    expect(overlay).not.toBeNull();
    expect(content).not.toBeNull();
    expect(overlay?.className).toContain("z-[5000]");
    expect(content?.className).toContain("z-[5001]");
    expect(content?.className).toContain("top-1/2");
    expect(content?.className).toContain("-translate-x-1/2");
    expect(content?.className).toContain("-translate-y-1/2");
  });
});
