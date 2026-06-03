import type React from "react";
import { Suspense } from "react";
import { RouteLoadingFallback } from "@/app/components/experience";

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
        <RouteLoadingFallback
          title={title}
          detail={detail}
          surface="groups"
          className="min-h-[320px]"
        />
      )}
    >
      {children}
    </Suspense>
  );
}
