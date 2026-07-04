import { describe, expect, it } from "vitest";
import {
  NATIVE_DM_SKIP_HYDRATE_RETRY_TRIGGERS,
  shouldNativeDmSkipHydrateRetryTrigger,
} from "@/app/features/messaging/services/native-dm-conversation-hydrate-port";

describe("native-dm-conversation-hydrate-owner", () => {
  it("skips web-only hydrate retry triggers on native", () => {
    expect(NATIVE_DM_SKIP_HYDRATE_RETRY_TRIGGERS.has("chat_route_active")).toBe(true);
    expect(NATIVE_DM_SKIP_HYDRATE_RETRY_TRIGGERS.has("stale_empty_retry")).toBe(false);
    expect(NATIVE_DM_SKIP_HYDRATE_RETRY_TRIGGERS.has("partial_direction_retry")).toBe(true);
    expect(shouldNativeDmSkipHydrateRetryTrigger("messages_index_rebuilt")).toBe(false);
    expect(shouldNativeDmSkipHydrateRetryTrigger("stale_empty_retry")).toBe(false);
  });
});
