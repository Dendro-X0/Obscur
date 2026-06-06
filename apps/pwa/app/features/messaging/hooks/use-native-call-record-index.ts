"use client";

import { useEffect, useState } from "react";
import { getResolvedProfileId } from "@/app/features/profiles/services/profile-runtime-scope";
import { requiresSqlitePersistence } from "@/app/features/runtime/native-persistence-policy";
import type { VoiceCallRoomRenderSummary } from "../components/message-list-render-meta";
import { loadNativeCallRecordSummaryIndex } from "../services/call-record-sqlite-store";

export const useNativeCallRecordIndex = (
  profileId: string = getResolvedProfileId(),
): ReadonlyMap<string, VoiceCallRoomRenderSummary> => {
  const [index, setIndex] = useState<ReadonlyMap<string, VoiceCallRoomRenderSummary>>(new Map());

  useEffect((): (() => void) | void => {
    if (!requiresSqlitePersistence()) {
      setIndex(new Map());
      return;
    }
    let cancelled = false;
    void loadNativeCallRecordSummaryIndex(profileId).then((nextIndex) => {
      if (!cancelled) {
        setIndex(nextIndex);
      }
    }).catch(() => {
      if (!cancelled) {
        setIndex(new Map());
      }
    });
    return (): void => {
      cancelled = true;
    };
  }, [profileId]);

  return index;
};
