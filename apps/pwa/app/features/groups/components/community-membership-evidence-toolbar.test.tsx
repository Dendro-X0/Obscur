import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { CommunityMembershipEvidenceToolbar } from "./community-membership-evidence-toolbar";

vi.mock("react-i18next", () => ({
    useTranslation: () => ({
        t: (_key: string, fallback: string) => fallback,
    }),
}));

vi.mock("@/app/components/ui/confirm-dialog", () => ({
    ConfirmDialog: ({
        isOpen,
        onConfirm,
        title,
    }: {
        isOpen: boolean;
        onConfirm: () => void;
        title: string;
    }) => (isOpen ? (
        <div data-testid="confirm-dialog">
            <p>{title}</p>
            <button type="button" onClick={onConfirm}>
                Confirm
            </button>
        </div>
    ) : null),
}));

describe("CommunityMembershipEvidenceToolbar", () => {
    it("shows clear terminal only when terminalRecordCount > 0", () => {
        const { rerender } = render(
            <CommunityMembershipEvidenceToolbar
                terminalRecordCount={0}
                onReconcile={vi.fn()}
                onClearTerminalConfirmed={vi.fn()}
            />,
        );
        expect(screen.queryByText(/clear terminal cache/i)).not.toBeInTheDocument();
        rerender(
            <CommunityMembershipEvidenceToolbar
                terminalRecordCount={2}
                onReconcile={vi.fn()}
                onClearTerminalConfirmed={vi.fn()}
            />,
        );
        expect(screen.getByText(/clear terminal cache/i)).toBeInTheDocument();
    });

    it("requires confirm before clearing terminal cache", () => {
        const onClear = vi.fn();
        render(
            <CommunityMembershipEvidenceToolbar
                terminalRecordCount={1}
                onReconcile={vi.fn()}
                onClearTerminalConfirmed={onClear}
            />,
        );
        fireEvent.click(screen.getByText(/clear terminal cache/i));
        expect(onClear).not.toHaveBeenCalled();
        fireEvent.click(screen.getByRole("button", { name: /confirm/i }));
        expect(onClear).toHaveBeenCalledTimes(1);
    });

    it("calls onReconcile without confirm dialog", () => {
        const onReconcile = vi.fn();
        render(
            <CommunityMembershipEvidenceToolbar
                terminalRecordCount={0}
                onReconcile={onReconcile}
                onClearTerminalConfirmed={vi.fn()}
            />,
        );
        fireEvent.click(screen.getByText(/reconcile membership/i));
        expect(onReconcile).toHaveBeenCalledTimes(1);
    });
});
