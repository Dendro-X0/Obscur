"use client";

import { useEffect, useRef } from "react";
import { useIdentity } from "@/app/features/auth/hooks/use-identity";
import { useOptionalProfileRuntime } from "@/app/features/profiles/providers/profile-runtime-provider";
import { chatStateStoreService } from "@/app/features/messaging/services/chat-state-store";
import {
  accountScopeKeysEqual,
  emitAccountScopeBoundaryChanged,
  toAccountScopeKey,
  type AccountScopeKey,
} from "@/app/features/runtime/services/account-scope-boundary";

/**
 * Hard boundary between profile+identity scopes.
 * Flushes pending writes and purges in-memory chat/group caches when either dimension changes
 * so User A storage never bleeds into User B in the same process.
 */
export function AccountScopeBoundaryOwner(): null {
  const profileRuntime = useOptionalProfileRuntime();
  const identity = useIdentity();
  const previousScopeRef = useRef<AccountScopeKey | null>(null);

  const profileId = profileRuntime?.profileId ?? null;
  const publicKeyHex = identity.state.publicKeyHex
    ?? identity.state.stored?.publicKeyHex
    ?? null;
  const identityReady = identity.state.status === "unlocked" || identity.state.status === "locked";

  useEffect(() => {
    if (!profileId || !identityReady) {
      return;
    }
    const nextScope = toAccountScopeKey(profileId, publicKeyHex);
    const previousScope = previousScopeRef.current;

    if (accountScopeKeysEqual(previousScope, nextScope)) {
      return;
    }

    chatStateStoreService.flushAllPending();
    if (nextScope) {
      chatStateStoreService.purgeMemoryExcept(nextScope.profileId, nextScope.publicKeyHex);
    } else {
      chatStateStoreService.purgeAllMemory();
    }

    emitAccountScopeBoundaryChanged({ previous: previousScope, next: nextScope });
    previousScopeRef.current = nextScope;
  }, [identityReady, profileId, publicKeyHex]);

  return null;
}
