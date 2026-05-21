import { describe, expect, it } from "vitest";
import { shouldMountGroupManagementDialog } from "./group-management-mount-policy";

describe("shouldMountGroupManagementDialog", () => {
    it("returns false when closed", () => {
        expect(shouldMountGroupManagementDialog(false)).toBe(false);
    });

    it("returns true when open", () => {
        expect(shouldMountGroupManagementDialog(true)).toBe(true);
    });
});
