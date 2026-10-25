"use client";

import { Suspense } from "react";
import { CallUiPreviewClient } from "./call-ui-preview-client";

export default function CallUiPreviewPage() {
  return (
    <Suspense
      fallback={(
        <div className="flex min-h-screen items-center justify-center bg-zinc-950 text-sm text-zinc-400">
          Loading call UI lab…
        </div>
      )}
    >
      <CallUiPreviewClient />
    </Suspense>
  );
}
