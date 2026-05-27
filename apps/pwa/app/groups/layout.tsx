import type React from "react";
import { GroupRouteSuspenseBoundary } from "./group-route-suspense-boundary";

export default function GroupsLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>): React.JSX.Element {
  return (
    <GroupRouteSuspenseBoundary
      title="Loading community"
      detail="Preparing membership, relay hints, and community tools..."
    >
      {children}
    </GroupRouteSuspenseBoundary>
  );
}
