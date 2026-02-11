"use client";

import React, { useState } from "react";
import { Ghost, Bot, Zap, Settings, ChevronUp, ChevronDown, Trash2, Play } from "lucide-react";
import { Button } from "@/app/components/ui/button";
import { Card } from "@/app/components/ui/card";
import { useDevMode } from "../hooks/use-dev-mode";
import { SCENARIOS } from "../scenarios";
import { cn } from "@/app/lib/cn";

export const DevPanel = () => {
    const { isDevMode, toggleDevMode, botEngine, mockPool } = useDevMode();
    const [isOpen, setIsOpen] = useState(false);
    const [activeScenario, setActiveScenario] = useState<string | null>(null);
    const [stopScenario, setStopScenario] = useState<(() => void) | null>(null);

    if (!isDevMode && process.env.NODE_ENV !== "development") {
        return null;
    }

    const handleRunScenario = async (scenarioId: string) => {
        if (stopScenario) {
            stopScenario();
        }

        const scenario = SCENARIOS.find(s => s.id === scenarioId);
        if (scenario) {
            setActiveScenario(scenarioId);
            const stop = await scenario.execute(botEngine);
            setStopScenario(() => stop);
        }
    };

    const handleStopScenario = () => {
        if (stopScenario) {
            stopScenario();
            setStopScenario(null);
            setActiveScenario(null);
        }
    };

    const handleClearBots = () => {
        handleStopScenario();
        botEngine.clearBots();
    };

    return (
        <div className="fixed bottom-4 right-4 z-[9999] flex flex-col items-end gap-2">
            {!isOpen && (
                <Button
                    variant="secondary"
                    size="icon"
                    onClick={() => setIsOpen(true)}
                    className="h-12 w-12 rounded-full border-2 border-purple-500/50 bg-white/80 shadow-lg backdrop-blur-md dark:bg-black/80"
                    title="Ghost Protocol (Dev Mode)"
                >
                    <Ghost className="h-6 w-6 text-purple-600 dark:text-purple-400" />
                </Button>
            )}

            {isOpen && (
                <Card className="w-80 overflow-hidden rounded-2xl border-2 border-purple-500/30 bg-white/90 p-0 shadow-2xl backdrop-blur-xl dark:bg-black/90">
                    <div className="flex items-center justify-between bg-gradient-primary px-4 py-2 text-white">
                        <div className="flex items-center gap-2 font-bold">
                            <Ghost className="h-4 w-4" />
                            <span>Ghost Protocol</span>
                        </div>
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setIsOpen(false)}
                            className="h-8 w-8 p-0 text-white hover:bg-white/20"
                        >
                            <ChevronDown className="h-4 w-4" />
                        </Button>
                    </div>

                    <div className="flex flex-col gap-4 p-4">
                        {/* Simulation Status */}
                        <div>
                            <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-wider text-zinc-500">
                                <span>Simulation Status</span>
                                <span className={cn(
                                    "rounded-full px-1.5 py-0.5",
                                    isDevMode ? "bg-emerald-500/20 text-emerald-600" : "bg-zinc-500/20 text-zinc-600"
                                )}>
                                    {isDevMode ? "Active (Mock Pool)" : "Inactive"}
                                </span>
                            </div>
                            <div className="mt-2 grid grid-cols-2 gap-2">
                                <div className="rounded-xl bg-zinc-100 p-2 dark:bg-zinc-800/50">
                                    <div className="text-[10px] text-zinc-500">Active Bots</div>
                                    <div className="text-lg font-bold">{botEngine.getBots().length}</div>
                                </div>
                                <div className="rounded-xl bg-zinc-100 p-2 dark:bg-zinc-800/50">
                                    <div className="text-[10px] text-zinc-500">Scenario</div>
                                    <div className="truncate text-sm font-bold">{activeScenario || "None"}</div>
                                </div>
                            </div>
                        </div>

                        {/* Scenarios */}
                        <div>
                            <div className="text-[10px] font-bold uppercase tracking-wider text-zinc-500">Run Scenario</div>
                            <div className="mt-2 flex flex-col gap-2">
                                {SCENARIOS.map(scenario => (
                                    <Button
                                        key={scenario.id}
                                        variant={activeScenario === scenario.id ? "primary" : "secondary"}
                                        size="sm"
                                        className="justify-start gap-2"
                                        onClick={() => handleRunScenario(scenario.id)}
                                    >
                                        <Play className="h-3 w-3" />
                                        <div className="flex flex-col items-start leading-tight">
                                            <span className="text-xs">{scenario.name}</span>
                                        </div>
                                    </Button>
                                ))}
                                {activeScenario && (
                                    <Button variant="danger" size="sm" onClick={handleStopScenario}>
                                        Stop Simulation
                                    </Button>
                                )}
                            </div>
                        </div>

                        {/* Quick Actions */}
                        <div>
                            <div className="text-[10px] font-bold uppercase tracking-wider text-zinc-500">Quick Actions</div>
                            <div className="mt-2 flex flex-wrap gap-2">
                                <Button variant="outline" size="sm" className="h-8 gap-1.5" onClick={() => botEngine.spawnBot("Ghost Bot")}>
                                    <Bot className="h-3 w-3" />
                                    <span>Spawn Bot</span>
                                </Button>
                                <Button variant="outline" size="sm" className="h-8 gap-1.5 border-red-500/30 text-red-500 hover:bg-red-500/10" onClick={handleClearBots}>
                                    <Trash2 className="h-3 w-3" />
                                    <span>Clear Bots</span>
                                </Button>
                            </div>
                        </div>

                        {/* System Info */}
                        <div className="border-t pt-4 dark:border-white/10">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2 text-xs text-zinc-500">
                                    <Settings className="h-3 w-3" />
                                    <span>Dev Mode</span>
                                </div>
                                <Button
                                    variant={isDevMode ? "danger" : "primary"}
                                    size="sm"
                                    className="h-7 text-[10px]"
                                    onClick={toggleDevMode}
                                >
                                    {isDevMode ? "Disable & Reload" : "Enable Dev Mode"}
                                </Button>
                            </div>
                        </div>
                    </div>
                </Card>
            )}
        </div>
    );
};
