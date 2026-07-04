import type React from "react";
import { RouteLoadingFallback } from "@/app/components/experience";

export default function GroupsLoading(): React.JSX.Element {
  return (
    <RouteLoadingFallback
      title="Loading community"
      detail="Preparing group workspace…"
      surface="groups"
      className="min-h-[320px]"
    />
  );
}
