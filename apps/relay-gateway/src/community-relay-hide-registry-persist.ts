import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import type { CommunityRelayHideRegistry } from "./community-relay-hide-suppress.js";

export type HideRegistrySnapshot = Readonly<{
  hiddenEventIds: ReadonlyArray<string>;
  updatedAt: string;
}>;

export const loadHideRegistrySnapshot = (filePath: string): ReadonlySet<string> => {
  if (!existsSync(filePath)) {
    return new Set();
  }
  try {
    const parsed = JSON.parse(readFileSync(filePath, "utf8")) as HideRegistrySnapshot;
    const ids = Array.isArray(parsed.hiddenEventIds) ? parsed.hiddenEventIds : [];
    return new Set(ids.filter((id) => typeof id === "string" && id.trim().length > 0));
  } catch {
    return new Set();
  }
};

export const saveHideRegistrySnapshot = (
  filePath: string,
  hiddenEventIds: ReadonlySet<string>,
): void => {
  const dir = dirname(filePath);
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
  const body: HideRegistrySnapshot = {
    hiddenEventIds: Array.from(hiddenEventIds).sort(),
    updatedAt: new Date().toISOString(),
  };
  writeFileSync(filePath, `${JSON.stringify(body, null, 2)}\n`, "utf8");
};

export const hydrateHideRegistry = (
  registry: CommunityRelayHideRegistry,
  hiddenEventIds: ReadonlySet<string>,
): void => {
  for (const id of hiddenEventIds) {
    registry.recordHideEvent({
      id: `hydrate-${id}`,
      kind: 5,
      tags: [["e", id]],
    });
  }
};
