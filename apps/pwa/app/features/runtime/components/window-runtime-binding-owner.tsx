"use client";

import { useEffect } from "react";
import { startWindowRuntimeBinding } from "@/app/features/runtime/services/window-runtime-binding";

/** Root-only owner: one binding subscription for the whole app tree. */
export function WindowRuntimeBindingOwner() {
  useEffect(() => startWindowRuntimeBinding(), []);
  return null;
}
