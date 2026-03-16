"use client";

import { useSyncExternalStore } from "react";
import { accountProjectionRuntime } from "../services/account-projection-runtime";

const getServerSnapshot = () => accountProjectionRuntime.getSnapshot();

export const useAccountProjectionSnapshot = () => (
  useSyncExternalStore(
    accountProjectionRuntime.subscribe,
    accountProjectionRuntime.getSnapshot,
    getServerSnapshot
  )
);
