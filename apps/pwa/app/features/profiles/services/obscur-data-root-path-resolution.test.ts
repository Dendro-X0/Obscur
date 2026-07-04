import { describe, expect, it } from "vitest";
import {
  DEFAULT_OBSCUR_DATA_SUBFOLDER,
  isWindowsDriveRoot,
  resolveObscurDataRootAfterPick,
  validateObscurDataSubfolderName,
  type ObscurDataRootPathApi,
} from "./obscur-data-root-path-resolution";

const mockPathApi = (overrides?: Partial<ObscurDataRootPathApi>): ObscurDataRootPathApi => ({
  dirname: async (path) => {
    const normalized = path.replace(/[\\/]+$/, "");
    const match = normalized.match(/^(.*)[\\/][^\\/]+$/);
    if (!match) {
      return normalized;
    }
    return match[1] ?? normalized;
  },
  basename: async (path) => {
    const normalized = path.replace(/[\\/]+$/, "");
    const segments = normalized.split(/[\\/]/).filter(Boolean);
    return segments[segments.length - 1] ?? normalized;
  },
  join: async (parent, child) => `${parent.replace(/[\\/]+$/, "")}\\${child}`,
  ...overrides,
});

describe("validateObscurDataSubfolderName", () => {
  it("accepts the default folder name", () => {
    expect(validateObscurDataSubfolderName(DEFAULT_OBSCUR_DATA_SUBFOLDER)).toBeNull();
  });

  it("rejects empty and illegal characters", () => {
    expect(validateObscurDataSubfolderName("")).toMatch(/required/i);
    expect(validateObscurDataSubfolderName("bad/name")).toMatch(/cannot contain/i);
  });
});

describe("isWindowsDriveRoot", () => {
  it("detects drive roots", () => {
    expect(isWindowsDriveRoot("K:\\")).toBe(true);
    expect(isWindowsDriveRoot("K:")).toBe(true);
    expect(isWindowsDriveRoot("K:\\Backups")).toBe(false);
  });
});

describe("resolveObscurDataRootAfterPick", () => {
  it("uses the default subfolder under a selected drive root for migration", async () => {
    const resolution = await resolveObscurDataRootAfterPick("K:\\", "change", {
      probeHasObscurData: async () => false,
      pathApi: mockPathApi(),
    });

    expect(resolution).toEqual({
      targetPath: "K:\\app.obscur.desktop",
      parentPath: "K:\\",
      subfolderName: DEFAULT_OBSCUR_DATA_SUBFOLDER,
      showSubfolderDialog: true,
    });
  });

  it("reconnects to the default subfolder when data exists there", async () => {
    const resolution = await resolveObscurDataRootAfterPick("K:\\", "reconnect", {
      probeHasObscurData: async (path) => path.endsWith("app.obscur.desktop"),
      pathApi: mockPathApi(),
    });

    expect(resolution.targetPath).toBe("K:\\app.obscur.desktop");
    expect(resolution.showSubfolderDialog).toBe(false);
  });

  it("uses a selected default-named folder directly", async () => {
    const resolution = await resolveObscurDataRootAfterPick("K:\\app.obscur.desktop", "change", {
      probeHasObscurData: async () => false,
      pathApi: mockPathApi(),
    });

    expect(resolution.targetPath).toBe("K:\\app.obscur.desktop");
    expect(resolution.parentPath.replace(/[\\/]+$/, "")).toBe("K:");
    expect(resolution.showSubfolderDialog).toBe(true);
  });

  it("reconnects directly when the selected folder already has data", async () => {
    const resolution = await resolveObscurDataRootAfterPick("K:\\", "reconnect", {
      probeHasObscurData: async (path) => path === "K:\\",
      pathApi: mockPathApi(),
    });

    expect(resolution.targetPath).toBe("K:\\");
    expect(resolution.showSubfolderDialog).toBe(false);
  });
});
