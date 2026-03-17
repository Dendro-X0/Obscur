
"use client";

import { Suspense } from "react";
import MainShell from "@/app/features/main-shell/main-shell";
import { AppLoadingScreen } from "@/app/components/app-loading-screen";

export default function Page() {
  return (
    <Suspense fallback={<AppLoadingScreen title="Opening workspace" detail="Loading chats and account state..." />}>
      <MainShell />
    </Suspense>
  );
}
