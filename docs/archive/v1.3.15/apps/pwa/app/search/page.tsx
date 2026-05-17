import type React from "react";
import dynamic from "next/dynamic";
import { AppLoadingScreen } from "@/app/components/app-loading-screen";

const SearchPageClient = dynamic(() => import("./search-page-client"), {
  loading: () => (
    <AppLoadingScreen
      fullScreen={false}
      title="Loading discovery"
      detail="Preparing search tools and local route data..."
      className="min-h-[320px]"
    />
  ),
});

export default function SearchPage(): React.JSX.Element {
  return <SearchPageClient />;
}
