import GroupHomePageClient from "./group-home-page-client";

export function generateStaticParams() {
    return [{ id: ["placeholder"] }];
}

export default function Page() {
    return <GroupHomePageClient />;
}
