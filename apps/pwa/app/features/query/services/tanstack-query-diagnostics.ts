"use client";

type TanstackQueryRuntimePath = "legacy" | "tanstack";

type TanstackQueryDiagnosticsState = Readonly<{
  enabled: boolean;
  cacheScopeKey: string;
  profileId: string;
  publicKeyHex: string;
  lastUpdatedAtUnixMs: number;
  paths: Readonly<Record<string, TanstackQueryRuntimePath>>;
}>;

type TanstackQueryDiagnosticsTools = Readonly<{
  getState: () => TanstackQueryDiagnosticsState;
  clearPaths: () => void;
}>;

const createDefaultState = (): TanstackQueryDiagnosticsState => ({
  enabled: false,
  cacheScopeKey: "default::anonymous",
  profileId: "default",
  publicKeyHex: "anonymous",
  lastUpdatedAtUnixMs: Date.now(),
  paths: {},
});

let diagnosticsState: TanstackQueryDiagnosticsState = createDefaultState();

declare global {
  interface Window {
    obscurTanstackQueryDiagnostics?: TanstackQueryDiagnosticsTools;
  }
}

const installTools = (): void => {
  if (typeof window === "undefined") {
    return;
  }
  window.obscurTanstackQueryDiagnostics = {
    getState: () => diagnosticsState,
    clearPaths: () => {
      diagnosticsState = {
        ...diagnosticsState,
        paths: {},
        lastUpdatedAtUnixMs: Date.now(),
      };
      installTools();
    },
  };
};

export const updateTanstackQueryDiagnostics = (params: Readonly<{
  enabled: boolean;
  cacheScopeKey: string;
  profileId: string;
  publicKeyHex: string;
}>): void => {
  diagnosticsState = {
    ...diagnosticsState,
    enabled: params.enabled,
    cacheScopeKey: params.cacheScopeKey,
    profileId: params.profileId,
    publicKeyHex: params.publicKeyHex,
    lastUpdatedAtUnixMs: Date.now(),
  };
  installTools();
};

export const markTanstackQueryPath = (feature: string, path: TanstackQueryRuntimePath): void => {
  if (feature.trim().length === 0) {
    return;
  }
  const nextPaths = {
    ...diagnosticsState.paths,
    [feature]: path,
  };
  diagnosticsState = {
    ...diagnosticsState,
    paths: nextPaths,
    lastUpdatedAtUnixMs: Date.now(),
  };
  installTools();
};

export const tanstackQueryDiagnosticsInternals = {
  getState: (): TanstackQueryDiagnosticsState => diagnosticsState,
  resetForTests: (): void => {
    diagnosticsState = createDefaultState();
  },
};

