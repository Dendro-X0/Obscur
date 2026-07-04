import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import en from "@/app/lib/i18n/locales/en.json";

const mocks = vi.hoisted(() => ({
  hasNativeRuntime: vi.fn(() => true),
  pathname: "/profiles",
  searchTab: null as string | null,
  getObscurDataRootConfig: vi.fn(async () => ({
    version: 1,
    defaultPath: "C:/Users/test/AppData/Roaming/app.obscur.desktop",
    customPath: "K:/obscur/app.obscur.desktop",
    effectivePath: "K:/obscur/app.obscur.desktop",
    requiresRestart: false,
    exportsPath: "K:/obscur/app.obscur.desktop/workspace-exports",
    profileArchivesPath: "K:/obscur/app.obscur.desktop/profile-archives",
    vaultMediaPath: "K:/obscur/app.obscur.desktop/vault-media",
    canImportFromDefault: false,
    authoritySource: "junction",
    pointerHealed: false,
    appDataPath: "C:/Users/test/AppData/Roaming/app.obscur.desktop",
    storageMode: "junction",
    physicalPathAvailable: false,
    physicalPathIssue: "Data folder is not reachable at K:/obscur/app.obscur.desktop.",
    physicalPathSlow: false,
  })),
  pickObscurDataRootPath: vi.fn(async () => "E:/"),
  resolveObscurDataRootPick: vi.fn(async () => ({
    targetPath: "E:/app.obscur.desktop",
    parentPath: "E:/",
    subfolderName: "app.obscur.desktop",
    showSubfolderDialog: false,
  })),
  planObscurDataRootChange: vi.fn(async () => ({
    targetPath: "E:/app.obscur.desktop",
    sourcePath: "K:/obscur/app.obscur.desktop",
    anchorPath: "C:/Users/test/AppData/Roaming/app.obscur.desktop",
    targetHasObscurData: false,
    anchorHasObscurData: false,
    anchorWouldBeReplaced: true,
    pathsEquivalent: false,
    recommendedAction: "migrate",
  })),
  bindObscurDataRootForRecovery: vi.fn(async () => ({
    version: 1,
    defaultPath: "",
    customPath: "E:/app.obscur.desktop",
    effectivePath: "E:/app.obscur.desktop",
    requiresRestart: true,
    exportsPath: "",
    profileArchivesPath: "",
    vaultMediaPath: "",
    canImportFromDefault: false,
    authoritySource: "junction",
    pointerHealed: false,
    appDataPath: "",
    storageMode: "junction",
    physicalPathAvailable: true,
    physicalPathSlow: false,
  })),
  reconnectObscurDataRootPath: vi.fn(async () => ({
    version: 1,
    defaultPath: "",
    customPath: null,
    effectivePath: "",
    requiresRestart: false,
    exportsPath: "",
    profileArchivesPath: "",
    vaultMediaPath: "",
    canImportFromDefault: false,
    authoritySource: "default_appdata",
    pointerHealed: false,
    appDataPath: "",
    storageMode: "appdata",
    physicalPathAvailable: true,
    physicalPathSlow: false,
  })),
  requestNativeAppRestart: vi.fn(async () => ({ ok: true, value: null })),
  markDesktopShellBootReady: vi.fn(),
  routerPush: vi.fn(),
}));

vi.mock("@/app/features/runtime/runtime-capabilities", () => ({
  hasNativeRuntime: () => mocks.hasNativeRuntime(),
}));

vi.mock("@/app/features/profiles/services/obscur-data-root-service", () => ({
  getObscurDataRootConfig: mocks.getObscurDataRootConfig,
  pickObscurDataRootPath: mocks.pickObscurDataRootPath,
  resolveObscurDataRootPick: mocks.resolveObscurDataRootPick,
  planObscurDataRootChange: mocks.planObscurDataRootChange,
  bindObscurDataRootForRecovery: mocks.bindObscurDataRootForRecovery,
  buildObscurDataRootTargetPath: vi.fn(async (parent: string, child: string) => `${parent}/${child}`),
  validateObscurDataSubfolderName: vi.fn(() => null),
  DEFAULT_OBSCUR_DATA_SUBFOLDER: "app.obscur.desktop",
}));

vi.mock("@/app/features/runtime/native-adapters", () => ({
  requestNativeAppRestart: mocks.requestNativeAppRestart,
}));

vi.mock("@/app/features/profiles/services/desktop-window-boot", () => ({
  markDesktopShellBootReady: () => mocks.markDesktopShellBootReady(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: (href: string) => mocks.routerPush(href),
  }),
  usePathname: () => mocks.pathname,
  useSearchParams: () => ({
    get: (key: string) => (key === "tab" ? mocks.searchTab : null),
  }),
}));

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, options?: Record<string, unknown>) => {
      const template = (en.translation as Record<string, string | undefined>)[key] ?? key;
      return template.replace(/\{\{(.*?)\}\}/g, (_match, token: string) => String(options?.[token.trim()] ?? ""));
    },
  }),
}));

import { DataRootUnavailableGate } from "./data-root-unavailable-recovery";

describe("DataRootUnavailableGate", () => {
  it("shows recovery UI when physical path unavailable", async () => {
    render(
      <DataRootUnavailableGate>
        <div>APP</div>
      </DataRootUnavailableGate>,
    );

    expect(await screen.findByText("Data folder unavailable")).toBeInTheDocument();
    expect(screen.queryByText("APP")).not.toBeInTheDocument();
    expect(mocks.markDesktopShellBootReady).toHaveBeenCalled();
  });

  it("routes to storage settings", async () => {
    render(
      <DataRootUnavailableGate>
        <div>APP</div>
      </DataRootUnavailableGate>,
    );

    const settings = await screen.findByText("Open Storage settings");
    fireEvent.click(settings);
    expect(mocks.routerPush).toHaveBeenCalledWith("/settings?tab=storage");
  });

  it("allows storage settings route through the gate", async () => {
    mocks.pathname = "/settings";
    mocks.searchTab = "storage";
    render(
      <DataRootUnavailableGate>
        <div>STORAGE SETTINGS</div>
      </DataRootUnavailableGate>,
    );

    expect(await screen.findByText("STORAGE SETTINGS")).toBeInTheDocument();
    mocks.pathname = "/profiles";
    mocks.searchTab = null;
  });

  it("binds a new empty folder without migration", async () => {
    render(
      <DataRootUnavailableGate>
        <div>APP</div>
      </DataRootUnavailableGate>,
    );

    await screen.findByText("Data folder unavailable");
    fireEvent.click(screen.getByText("Choose new data folder"));
    await waitFor(() => {
      expect(mocks.pickObscurDataRootPath).toHaveBeenCalled();
    });

    const confirm = await screen.findByText("Use this folder");
    fireEvent.click(confirm);

    await waitFor(() => {
      expect(mocks.bindObscurDataRootForRecovery).toHaveBeenCalledWith("E:/app.obscur.desktop", false);
      expect(mocks.requestNativeAppRestart).toHaveBeenCalled();
    });
  });

  it("retry calls get config again", async () => {
    render(
      <DataRootUnavailableGate>
        <div>APP</div>
      </DataRootUnavailableGate>,
    );

    await screen.findByText("Data folder unavailable");
    const callsBefore = mocks.getObscurDataRootConfig.mock.calls.length;
    fireEvent.click(screen.getByText("Retry"));
    await waitFor(() => {
      expect(mocks.getObscurDataRootConfig.mock.calls.length).toBeGreaterThan(callsBefore);
    });
  });
});
