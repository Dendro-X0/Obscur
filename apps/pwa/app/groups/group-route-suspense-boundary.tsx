import type React from "react";
import { Suspense } from "react";
import { AppLoadingScreen } from "@/app/components/app-loading-screen";

type GroupRouteSuspenseBoundaryProps = Readonly<{
  title: string;
  detail: string;
  children: React.ReactNode;
}>;

export function GroupRouteSuspenseBoundary({
  title,
  detail,
  children,
}: GroupRouteSuspenseBoundaryProps): React.JSX.Element {
  return (
    <Suspense
      fallback={(
        <AppLoadingScreen
          fullScreen={false}
          title={title}
          detail={detail}
          className="min-h-[320px]"
        />
      )}
    >
      {children}
    </Suspense>
  );
}
