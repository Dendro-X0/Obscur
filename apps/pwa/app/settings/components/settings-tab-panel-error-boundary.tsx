"use client";

import { Component, type ReactNode } from "react";
import type { SettingsTabId } from "@/app/features/settings/services/settings-search-index";
import { Button } from "@dweb/ui-kit";

type SettingsTabPanelErrorBoundaryProps = Readonly<{
  tabId: SettingsTabId;
  children: ReactNode;
  onRetry?: () => void;
}>;

type SettingsTabPanelErrorBoundaryState = Readonly<{
  hasError: boolean;
  errorMessage: string;
}>;

export class SettingsTabPanelErrorBoundary extends Component<
  SettingsTabPanelErrorBoundaryProps,
  SettingsTabPanelErrorBoundaryState
> {
  constructor(props: SettingsTabPanelErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, errorMessage: "" };
  }

  static getDerivedStateFromError(error: Error): SettingsTabPanelErrorBoundaryState {
    return {
      hasError: true,
      errorMessage: error.message || "Unknown settings tab error",
    };
  }

  componentDidCatch(error: Error, errorInfo: unknown): void {
    console.error(`Settings tab "${this.props.tabId}" error:`, error, errorInfo);
  }

  private handleRetry = (): void => {
    this.setState({ hasError: false, errorMessage: "" });
    this.props.onRetry?.();
  };

  render(): ReactNode {
    if (!this.state.hasError) {
      return this.props.children;
    }

    return (
      <div
        className="rounded-2xl border border-rose-500/30 bg-rose-500/5 p-6 space-y-3"
        data-testid={`settings-tab-error-${this.props.tabId}`}
      >
        <h2 className="text-base font-semibold text-rose-600 dark:text-rose-400">
          This settings section failed to load
        </h2>
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          Tab: <span className="font-mono">{this.props.tabId}</span>
          {" — "}
          {this.state.errorMessage}
        </p>
        <p className="text-xs text-zinc-500">
          Other settings tabs remain available. Retry this section or switch tabs.
        </p>
        <Button type="button" variant="outline" size="sm" onClick={this.handleRetry}>
          Retry section
        </Button>
      </div>
    );
  }
}
