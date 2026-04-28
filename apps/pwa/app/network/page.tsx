import type React from "react";
import dynamic from "next/dynamic";
import { AppLoadingScreen } from "@/app/components/app-loading-screen";

const NetworkPageClient = dynamic(() => import("./network-page-client"), {
  loading: () => (
    <AppLoadingScreen
      fullScreen={false}
      title="Loading network"
      detail="Preparing contacts, communities, and local relationship data..."
      className="min-h-[320px]"
    />
  ),
});

export default function NetworkPage(): React.JSX.Element {
  return <NetworkPageClient />;
}
