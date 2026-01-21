"use client";

import { useDeepLink } from "../../lib/desktop/use-deep-link";

/**
 * Component that handles deep links in desktop mode
 * Must be mounted in the app layout
 */
export function DeepLinkHandler() {
  useDeepLink();
  return null;
}
