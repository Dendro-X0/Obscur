import ContactProfileView from "@/app/features/network/components/network-profile-view";

export function generateStaticParams() {
    return [{ pubkey: "placeholder" }];
}

export default function Page() {
    return <ContactProfileView />;
}
