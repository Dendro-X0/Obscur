import type React from "react";
import GroupPageClient from "./page-client";

type PageProps = {
  params: Promise<{ groupId: string }>;
};

export async function generateStaticParams() {
  return [{ groupId: "placeholder" }];
}

export default async function GroupPage(props: PageProps): Promise<React.JSX.Element> {
  const params = await props.params;
  return <GroupPageClient groupId={params.groupId} />;
}
