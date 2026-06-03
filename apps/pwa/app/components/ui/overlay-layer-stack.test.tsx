import React from "react";
import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  UI_OVERLAY_Z_CLASS,
} from "@dweb/ui-kit";

describe("UI overlay layer stack", () => {
  it("documents canonical z-index class literals", () => {
    expect(UI_OVERLAY_Z_CLASS.dialogBackdrop).toBe("z-[5000]");
    expect(UI_OVERLAY_Z_CLASS.dialogPanel).toBe("z-[5001]");
    expect(UI_OVERLAY_Z_CLASS.popover).toBe("z-[5100]");
    expect(UI_OVERLAY_Z_CLASS.toast).toBe("z-[5200]");
  });

  it("keeps dropdown menus above dialog backdrop", () => {
    render(
      <>
        <Dialog open onOpenChange={() => undefined}>
          <DialogContent showCloseButton={false}>
            <DialogTitle>Layer probe</DialogTitle>
          </DialogContent>
        </Dialog>
        <DropdownMenu open onOpenChange={() => undefined}>
          <DropdownMenuTrigger asChild>
            <button type="button">Open menu</button>
          </DropdownMenuTrigger>
          <DropdownMenuContent>
            <DropdownMenuItem>Item</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </>,
    );

    const overlay = document.querySelector('[data-slot="dialog-overlay"]');
    const content = document.querySelector('[data-slot="dialog-content"]');
    const menu = document.querySelector("[data-radix-menu-content]");

    expect(overlay?.className).toContain("z-[5000]");
    expect(content?.className).toContain("z-[5001]");
    expect(menu?.className).toContain("z-[5100]");
  });
});
