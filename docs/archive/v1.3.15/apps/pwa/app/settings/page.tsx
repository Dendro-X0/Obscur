import type React from "react";
import dynamic from "next/dynamic";
import { AppLoadingScreen } from "@/app/components/app-loading-screen";

const SettingsPageClient = dynamic(() => import("./settings-page-client"), {
  loading: () => (
    <AppLoadingScreen
      fullScreen={false}
      title="Loading settings"
      detail="Preparing local preferences, relay controls, and account tools..."
      className="min-h-[320px]"
    />
  ),
});

export default function SettingsPage(): React.JSX.Element {
  return <SettingsPageClient />;
}
