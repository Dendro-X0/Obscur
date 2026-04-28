import type React from "react";
import dynamic from "next/dynamic";
import { AppLoadingScreen } from "@/app/components/app-loading-screen";

const VaultPageClient = dynamic(() => import("./vault-page-client"), {
  loading: () => (
    <AppLoadingScreen
      fullScreen={false}
      title="Loading vault"
      detail="Preparing local media inventory, storage tools, and secure actions..."
      className="min-h-[320px]"
    />
  ),
});

export default function VaultPage(): React.JSX.Element {
  return <VaultPageClient />;
}
