"use client";

import React from "react";
import { Scale } from "lucide-react";
import { Button } from "@/app/components/ui/button";
import type { PublicKeyHex } from "@dweb/crypto/public-key-hex";
import type { GovernanceProposalRecord } from "../../../services/community-governance-reducer";
import { mgmtSectionClass } from "../constants";

export function GroupManagementGovernancePanel({
    proposals,
    myPublicKeyHex,
    describeProposal,
    onVote,
    managedWorkspaceActionsBlocked = false,
}: Readonly<{
    proposals: ReadonlyArray<GovernanceProposalRecord>;
    myPublicKeyHex: PublicKeyHex | null;
    describeProposal: (proposal: GovernanceProposalRecord) => string;
    onVote: (params: Readonly<{ proposalId: string; vote: "approve" | "reject" }>) => void;
    managedWorkspaceActionsBlocked?: boolean;
}>): React.JSX.Element {
    if (proposals.length === 0) {
        return (
            <div className={`${mgmtSectionClass} text-center`}>
                <Scale className="mx-auto h-8 w-8 text-zinc-600" />
                <p className="mt-3 text-sm text-zinc-400">No open proposals.</p>
                <p className="mt-1 text-xs text-zinc-500">
                    Rename and removal proposals from members appear here for a vote.
                </p>
                {managedWorkspaceActionsBlocked ? (
                    <p className="mt-3 text-xs text-zinc-500">
                        New rename or removal proposals require a trusted relay setup (see banner above).
                        You can still vote on proposals already open.
                    </p>
                ) : null}
            </div>
        );
    }

    return (
        <ul className="mx-auto max-w-2xl space-y-3">
            {proposals.map((proposal) => {
                const myVote = myPublicKeyHex ? proposal.votes[myPublicKeyHex] : undefined;
                const approveCount = Object.values(proposal.votes).filter((vote) => vote === "approve").length;
                return (
                    <li key={proposal.proposalId} className={mgmtSectionClass}>
                        <p className="text-sm font-medium text-zinc-900 dark:text-white">{describeProposal(proposal)}</p>
                        <p className="mt-1 text-xs text-zinc-500">
                            {approveCount} / {proposal.quorumThreshold} approvals · by{" "}
                            {proposal.proposerPublicKeyHex.slice(0, 8)}…
                        </p>
                        {!myVote && myPublicKeyHex ? (
                            <div className="mt-3 flex gap-2">
                                <Button
                                    type="button"
                                    size="sm"
                                    className="rounded-lg bg-emerald-600 hover:bg-emerald-500"
                                    onClick={() => onVote({ proposalId: proposal.proposalId, vote: "approve" })}
                                >
                                    Approve
                                </Button>
                                <Button
                                    type="button"
                                    size="sm"
                                    variant="secondary"
                                    className="rounded-lg"
                                    onClick={() => onVote({ proposalId: proposal.proposalId, vote: "reject" })}
                                >
                                    Reject
                                </Button>
                            </div>
                        ) : myVote ? (
                            <p className="mt-2 text-xs text-zinc-500">Your vote: {myVote}</p>
                        ) : null}
                    </li>
                );
            })}
        </ul>
    );
}
