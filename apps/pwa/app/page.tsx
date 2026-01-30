
"use client";

import { Suspense } from "react";
import MainShell from "@/app/features/main-shell/main-shell";

export default function Page() {
  return (
    <Suspense fallback={null}>
      <MainShell />
    </Suspense>
  );
}
