"use client";

/**
 * Gate for full route client chunk imports during navigation warm-up.
 * Contract: docs/program/navigation-performance-contract.md
 */

import { logAppEvent } from "@/app/shared/log-app-event";

const CONTRACT_DOC = "docs/program/navigation-performance-contract.md";

let heldAuthorityGeneration = 0;
let nextAuthorityGeneration = 0;

export const runWithNavigationChunkLoadAuthority = async <T>(
  run: () => Promise<T>,
): Promise<T> => {
  const generation = ++nextAuthorityGeneration;
  heldAuthorityGeneration = generation;
  try {
    return await run();
  } finally {
    if (heldAuthorityGeneration === generation) {
      heldAuthorityGeneration = 0;
    }
  }
};

export const assertNavigationChunkLoadAuthorized = (
  caller: string,
  mode: "shell-only" | "full",
): void => {
  if (mode === "shell-only" || heldAuthorityGeneration > 0) {
    return;
  }
  if (process.env.NODE_ENV === "production") {
    return;
  }

  logAppEvent({
    name: "navigation.chunk_load_unauthorized",
    level: "warn",
    scope: { feature: "navigation", action: "chunk_load_authority" },
    context: {
      caller,
      contractDoc: CONTRACT_DOC,
    },
  });

  console.warn(
    `[Obscur navigation] Unauthorized full chunk load from "${caller}". `
    + `See ${CONTRACT_DOC}. Use prefetchRouteShell on intent; warm-up only via coordinator.`,
  );
};
