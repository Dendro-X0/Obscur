import ContactProfileView from "@/app/features/contacts/components/contact-profile-view";

export function generateStaticParams() {
    return [{ pubkey: "placeholder" }];
}

export default function Page() {
    return <ContactProfileView />;
}
