"use client";

import React, { useState, useEffect, useCallback } from "react";
import {
    Shield,
    ShieldAlert,
    ShieldCheck,
    RefreshCw,
    Users,
    AlertTriangle,
    CheckCircle,
    X,
    ChevronDown,
    ChevronRight,
    Database,
    Activity,
    FileJson,
} from "lucide-react";
import { Button } from "../../../components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../../../components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "../../../components/ui/dialog";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "../../../components/ui/collapsible";
import { Badge } from "../../../components/ui/badge";
import { cn } from "../../../lib/cn";
import { toast } from "../../../components/ui/toast";
import { useGroups } from "../providers/group-provider";
import {
    checkAllGroupsIntegrity,
    attemptGroupRepair,
} from "../services/community-integrity-monitor";
import {
    validateLedgerEntries,
} from "../services/community-ledger-validator";

import {
    loadCommunityMembershipLedger,
    type CommunityMembershipLedgerEntry,
} from "../services/community-membership-ledger";
import { useIdentity } from "@/app/features/auth/hooks/use-identity";
import { getResolvedProfileId } from "@/app/features/profiles/services/profile-runtime-scope";

type IntegritySeverity = "healthy" | "warning" | "critical";
type LedgerValidationResult = ReturnType<typeof validateLedgerEntries>;

interface HealthPanelProps {
    isOpen: boolean;
    onClose: () => void;
}

interface IntegrityIssue {
    severity: 'critical' | 'warning';
    message: string;
    details?: string;
}

interface GroupIntegrityResult {
    groupId: string;
    groupName: string;
    severity: 'healthy' | 'warning' | 'critical';
    issues: IntegrityIssue[];
    metadata: {
        memberCount: number;
        ledgerStatus: 'joined' | 'left' | 'unknown';
    };
}

interface HealthSummary {
    totalGroups: number;
    healthyGroups: number;
    warningGroups: number;
    criticalGroups: number;
    ledgerValidation: LedgerValidationResult | null;
    integrityResults: GroupIntegrityResult[];
    lastChecked: number;
}

export const CommunityDataHealthPanel: React.FC<HealthPanelProps> = ({
    isOpen,
    onClose,
}) => {
    const { createdGroups } = useGroups();
    const { state: identityState } = useIdentity();
    const publicKeyHex = identityState.status === "unlocked" ? identityState.publicKeyHex : undefined;
    const [isLoading, setIsLoading] = useState(false);
    const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
    const [healthSummary, setHealthSummary] = useState<HealthSummary>({
        totalGroups: 0,
        healthyGroups: 0,
        warningGroups: 0,
        criticalGroups: 0,
        ledgerValidation: null,
        integrityResults: [],
        lastChecked: 0,
    });

    const runHealthCheck = useCallback(async () => {
        if (!publicKeyHex) return;

        setIsLoading(true);
        try {
            // Load ledger entries
            const profileId = getResolvedProfileId();
            const ledgerEntries = loadCommunityMembershipLedger(publicKeyHex, { profileId });

            // Validate ledger
            const ledgerValidation = validateLedgerEntries(ledgerEntries);

            // Run integrity check on all groups
            const integrityCheckResult = checkAllGroupsIntegrity(
                createdGroups,
                ledgerEntries
            );

            // Map integrity results to UI format
            const integrityResults: GroupIntegrityResult[] = integrityCheckResult.results.map(result => ({
                groupId: result.groupId,
                groupName: result.checks.displayNameValid ? "Group" : "Unknown Group",
                severity: result.severity === 'ok' ? 'healthy' : result.severity,
                issues: result.discrepancies.map(d => ({
                    severity: result.severity === 'ok' ? 'warning' : result.severity,
                    message: d,
                })),
                metadata: {
                    memberCount: 0, // Would need to fetch from persisted group
                    ledgerStatus: 'unknown',
                },
            }));

            // Calculate summary
            const healthy = integrityResults.filter(r => r.severity === "healthy").length;
            const warnings = integrityResults.filter(r => r.severity === "warning").length;
            const critical = integrityResults.filter(r => r.severity === "critical").length;

            setHealthSummary({
                totalGroups: createdGroups.length,
                healthyGroups: healthy,
                warningGroups: warnings,
                criticalGroups: critical,
                ledgerValidation,
                integrityResults,
                lastChecked: Date.now(),
            });
        } catch (error) {
            console.error("[CommunityDataHealthPanel] Health check failed:", error);
            toast.error("Failed to run health check");
        } finally {
            setIsLoading(false);
        }
    }, [publicKeyHex, createdGroups]);

    useEffect(() => {
        if (isOpen) {
            runHealthCheck();
        }
    }, [isOpen, runHealthCheck]);

    const handleRepair = async (groupId: string) => {
        if (!publicKeyHex) return;

        setIsLoading(true);
        try {
            const profileId = getResolvedProfileId();
            const ledgerEntries = loadCommunityMembershipLedger(publicKeyHex, { profileId });
            const ledgerEntry = ledgerEntries.find(e => e.groupId === groupId);
            const persistedGroup = createdGroups.find(g => g.groupId === groupId);
            const result = attemptGroupRepair(groupId, ledgerEntry, persistedGroup, publicKeyHex);
            if (result.success) {
                toast.success(`Repaired ${result.actions.length} issues for group: ${result.actions.join(', ')}`);
                // Re-run health check
                await runHealthCheck();
            } else {
                toast.info(`No repairs needed: ${result.actions.join(', ')}`);
            }
        } catch (error) {
            console.error("[CommunityDataHealthPanel] Repair failed:", error);
            toast.error("Failed to repair group");
        } finally {
            setIsLoading(false);
        }
    };

    const handleRepairAll = async () => {
        if (!publicKeyHex) return;

        setIsLoading(true);
        try {
            const profileId = getResolvedProfileId();
            const ledgerEntries = loadCommunityMembershipLedger(publicKeyHex, { profileId });
            const criticalGroups = healthSummary.integrityResults.filter(
                r => r.severity === "critical"
            );

            let totalRepairs = 0;
            for (const group of criticalGroups) {
                const ledgerEntry = ledgerEntries.find(e => e.groupId === group.groupId);
                const persistedGroup = createdGroups.find(g => g.groupId === group.groupId);
                const result = attemptGroupRepair(group.groupId, ledgerEntry, persistedGroup, publicKeyHex);
                if (result.success) {
                    totalRepairs += result.actions.length;
                }
            }

            if (totalRepairs > 0) {
                toast.success(`Repaired ${totalRepairs} issues across all critical groups`);
                await runHealthCheck();
            } else {
                toast.info("No repairs needed");
            }
        } catch (error) {
            console.error("[CommunityDataHealthPanel] Bulk repair failed:", error);
            toast.error("Failed to repair groups");
        } finally {
            setIsLoading(false);
        }
    };

    const toggleGroup = (groupId: string) => {
        setExpandedGroups(prev => {
            const next = new Set(prev);
            if (next.has(groupId)) {
                next.delete(groupId);
            } else {
                next.add(groupId);
            }
            return next;
        });
    };

    const getSeverityIcon = (severity: IntegritySeverity) => {
        switch (severity) {
            case "healthy":
                return <ShieldCheck className="h-5 w-5 text-green-500" />;
            case "warning":
                return <ShieldAlert className="h-5 w-5 text-yellow-500" />;
            case "critical":
                return <Shield className="h-5 w-5 text-red-500" />;
            default:
                return <Shield className="h-5 w-5 text-gray-500" />;
        }
    };

    const getSeverityBadge = (severity: IntegritySeverity) => {
        const variants = {
            healthy: "bg-green-500/10 text-green-500 border-green-500/20",
            warning: "bg-yellow-500/10 text-yellow-500 border-yellow-500/20",
            critical: "bg-red-500/10 text-red-500 border-red-500/20",
        };

        return (
            <Badge variant="outline" className={cn("text-xs", variants[severity])}>
                {severity.toUpperCase()}
            </Badge>
        );
    };

    return (
        <Dialog
            open={isOpen}
            onOpenChange={(nextOpen) => {
                if (!nextOpen) {
                    onClose();
                }
            }}
        >
            <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <Activity className="h-5 w-5" />
                        Community Data Health
                    </DialogTitle>
                </DialogHeader>

                <div className="space-y-6">
                    {/* Health Summary Cards */}
                    <div className="grid grid-cols-2 gap-3">
                        <Card>
                            <CardContent className="p-4">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                        <Database className="h-4 w-4 text-muted-foreground" />
                                        <span className="text-sm text-muted-foreground">Total Groups</span>
                                    </div>
                                    <span className="text-2xl font-bold">{healthSummary.totalGroups}</span>
                                </div>
                            </CardContent>
                        </Card>

                        <Card>
                            <CardContent className="p-4">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                        <ShieldCheck className="h-4 w-4 text-green-500" />
                                        <span className="text-sm text-muted-foreground">Healthy</span>
                                    </div>
                                    <span className="text-2xl font-bold text-green-500">
                                        {healthSummary.healthyGroups}
                                    </span>
                                </div>
                            </CardContent>
                        </Card>

                        <Card>
                            <CardContent className="p-4">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                        <ShieldAlert className="h-4 w-4 text-yellow-500" />
                                        <span className="text-sm text-muted-foreground">Warnings</span>
                                    </div>
                                    <span className="text-2xl font-bold text-yellow-500">
                                        {healthSummary.warningGroups}
                                    </span>
                                </div>
                            </CardContent>
                        </Card>

                        <Card>
                            <CardContent className="p-4">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                        <AlertTriangle className="h-4 w-4 text-red-500" />
                                        <span className="text-sm text-muted-foreground">Critical</span>
                                    </div>
                                    <span className="text-2xl font-bold text-red-500">
                                        {healthSummary.criticalGroups}
                                    </span>
                                </div>
                            </CardContent>
                        </Card>
                    </div>

                    {/* Ledger Validation Status */}
                    {healthSummary.ledgerValidation && (
                        <Card>
                            <CardHeader className="pb-3">
                                <CardTitle className="text-sm font-medium flex items-center gap-2">
                                    <FileJson className="h-4 w-4" />
                                    Ledger Validation
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="pt-0">
                                <div className="flex items-center gap-4 text-sm">
                                    <div className="flex items-center gap-1">
                                        <CheckCircle className="h-4 w-4 text-green-500" />
                                        <span>{healthSummary.ledgerValidation.valid} valid</span>
                                    </div>
                                    {healthSummary.ledgerValidation.invalid > 0 && (
                                        <div className="flex items-center gap-1 text-red-500">
                                            <X className="h-4 w-4" />
                                            <span>{healthSummary.ledgerValidation.invalid} invalid</span>
                                        </div>
                                    )}
                                </div>
                            </CardContent>
                        </Card>
                    )}

                    {/* Action Buttons */}
                    <div className="flex gap-2">
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={runHealthCheck}
                            disabled={isLoading}
                            className="flex items-center gap-2"
                        >
                            <RefreshCw className={cn("h-4 w-4", isLoading && "animate-spin")} />
                            Refresh Check
                        </Button>

                        {healthSummary.criticalGroups > 0 && (
                            <Button
                                variant="danger"
                                size="sm"
                                onClick={handleRepairAll}
                                disabled={isLoading}
                                className="flex items-center gap-2"
                            >
                                <Shield className="h-4 w-4" />
                                Repair Critical ({healthSummary.criticalGroups})
                            </Button>
                        )}
                    </div>

                    {/* Group Details List */}
                    <div className="space-y-2">
                        <h3 className="text-sm font-medium text-muted-foreground">Group Details</h3>

                        {healthSummary.integrityResults.length === 0 ? (
                            <p className="text-sm text-muted-foreground text-center py-8">
                                No groups to check
                            </p>
                        ) : (
                            healthSummary.integrityResults.map((result) => (
                                <Collapsible
                                    key={result.groupId}
                                    open={expandedGroups.has(result.groupId)}
                                    onOpenChange={() => toggleGroup(result.groupId)}
                                >
                                    <Card className={cn(
                                        "overflow-hidden",
                                        result.severity === "critical" && "border-red-500/30",
                                        result.severity === "warning" && "border-yellow-500/30"
                                    )}>
                                        <CollapsibleTrigger asChild>
                                            <CardContent className="p-3 cursor-pointer hover:bg-muted/50 transition-colors">
                                                <div className="flex items-center justify-between">
                                                    <div className="flex items-center gap-3">
                                                        {getSeverityIcon(result.severity)}
                                                        <div>
                                                            <p className="font-medium text-sm">{result.groupName}</p>
                                                            <p className="text-xs text-muted-foreground">
                                                                {result.issues.length} issues
                                                            </p>
                                                        </div>
                                                    </div>
                                                    <div className="flex items-center gap-2">
                                                        {getSeverityBadge(result.severity)}
                                                        {result.severity === "critical" && (
                                                            <Button
                                                                variant="ghost"
                                                                size="sm"
                                                                className="h-7 text-xs"
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    handleRepair(result.groupId);
                                                                }}
                                                                disabled={isLoading}
                                                            >
                                                                Repair
                                                            </Button>
                                                        )}
                                                        {expandedGroups.has(result.groupId) ? (
                                                            <ChevronDown className="h-4 w-4 text-muted-foreground" />
                                                        ) : (
                                                            <ChevronRight className="h-4 w-4 text-muted-foreground" />
                                                        )}
                                                    </div>
                                                </div>
                                            </CardContent>
                                        </CollapsibleTrigger>

                                        <CollapsibleContent>
                                            <CardContent className="pt-0 pb-3 px-3">
                                                <div className="space-y-2 pl-8">
                                                    {result.issues.map((issue: IntegrityIssue, idx) => (
                                                        <div
                                                            key={idx}
                                                            className={cn(
                                                                "text-xs p-2 rounded-md",
                                                                issue.severity === "critical" && "bg-red-500/10 text-red-600",
                                                                issue.severity === "warning" && "bg-yellow-500/10 text-yellow-600"
                                                            )}
                                                        >
                                                            <p className="font-medium">{issue.message}</p>
                                                            {issue.details && (
                                                                <p className="text-muted-foreground mt-1">{issue.details}</p>
                                                            )}
                                                        </div>
                                                    ))}
                                                </div>

                                                {/* Metadata */}
                                                <div className="mt-3 pl-8 text-xs text-muted-foreground space-y-1">
                                                    <div className="flex items-center gap-2">
                                                        <Users className="h-3 w-3" />
                                                        <span>Members: {result.metadata.memberCount}</span>
                                                    </div>
                                                    <div>
                                                        Ledger Status: <span className={cn(
                                                            result.metadata.ledgerStatus === "joined" && "text-green-600",
                                                            result.metadata.ledgerStatus === "left" && "text-red-600",
                                                            result.metadata.ledgerStatus === "unknown" && "text-gray-600"
                                                        )}>
                                                            {result.metadata.ledgerStatus}
                                                        </span>
                                                    </div>
                                                </div>
                                            </CardContent>
                                        </CollapsibleContent>
                                    </Card>
                                </Collapsible>
                            ))
                        )}
                    </div>

                    {/* Last Checked */}
                    {healthSummary.lastChecked > 0 && (
                        <p className="text-xs text-muted-foreground text-center">
                            Last checked: {new Date(healthSummary.lastChecked).toLocaleString()}
                        </p>
                    )}
                </div>
            </DialogContent>
        </Dialog>
    );
};

export default CommunityDataHealthPanel;
