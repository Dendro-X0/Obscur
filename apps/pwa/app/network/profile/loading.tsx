import type React from "react";
import { RouteLoadingFallback } from "@/app/components/experience";

export default function NetworkProfileLoading(): React.JSX.Element {
  return (
    <RouteLoadingFallback
      title="Loading profile"
      detail="Fetching contact details…"
      surface="network"
      className="min-h-[320px]"
    />
  );
}
