import type { Metadata } from "next";
import { notFound } from "next/navigation";
import {
  Shield,
  Radio,
  Phone,
  Users,
  Lock,
  Globe,
  Server,
  Smartphone,
  Zap,
  Fingerprint,
  Eye,
  Clock,
} from "lucide-react";

const features = {
  privacy: {
    title: "Privacy-First Architecture",
    description: "Your conversations belong to you. No servers, no data mining, no compromises.",
    icon: Shield,
    sections: [
      {
        title: "End-to-End Encryption",
        description:
          "Every message is encrypted with keys that only you and your contacts control. Not even the relay operators can read your messages.",
        icon: Lock,
      },
      {
        title: "Self-Custody Identity",
        description:
          "Your identity keys are generated and stored locally on your device. No account creation, no email required, no central authority.",
        icon: Fingerprint,
      },
      {
        title: "Routing Metadata Honesty",
        description:
          "Message bodies are end-to-end encrypted on your device. Public relays still see routing metadata — sender keys, timestamps, and event structure — so choose your relay stack accordingly.",
        icon: Eye,
      },
      {
        title: "Open Source",
        description:
          "Our code is publicly auditable. Security researchers and the community can verify our claims.",
        icon: Globe,
      },
    ],
  },
  relay: {
    title: "Decentralized Relay Network",
    description:
      "Built on Nostr-style relays you choose — public pools for reach, or private operator stacks for stronger control.",
    icon: Radio,
    sections: [
      {
        title: "Choose Your Relays",
        description:
          "Connect to any compatible relay or run your own. You're never locked into a single landlord.",
        icon: Server,
      },
      {
        title: "Switch When Blocked",
        description:
          "If one relay refuses you, point the client elsewhere. Propagation still depends on which relays peers actually use.",
        icon: Zap,
      },
      {
        title: "Clearnet First · Tor Optional",
        description:
          "Basic connectivity uses clearnet relays. Tor is an optional routing underlay — not required for private-trust demos, and not the product identity.",
        icon: Globe,
      },
      {
        title: "Offline-First",
        description:
          "Your messages are stored locally. Even if all relays go down, you keep your history.",
        icon: Clock,
      },
    ],
  },
  voice: {
    title: "Encrypted Voice Calls",
    description:
      "1:1 audio calls and voice notes with the same client-side encryption stance as messaging. Video conferencing is not shipped.",
    icon: Phone,
    sections: [
      {
        title: "Peer-to-Peer Audio",
        description:
          "Voice calls connect directly between devices when possible, minimizing latency.",
        icon: Zap,
      },
      {
        title: "Relay Fallback",
        description:
          "When direct connection isn't possible, signaling may use relays; media paths stay honest about what is encrypted.",
        icon: Server,
      },
      {
        title: "No Central Call Archive",
        description:
          "Obscur does not host a cloud call-recording service. Local devices may still keep call history you own.",
        icon: Eye,
      },
      {
        title: "Audio Today",
        description:
          "Desktop voice notes and 1:1 voice are the supported path. Camera / multiparty conference is a later roadmap band.",
        icon: Smartphone,
      },
    ],
  },
  groups: {
    title: "Private Communities",
    description:
      "Encrypted group chat with two honest modes — egalitarian sovereign rooms and operator-managed workspaces.",
    icon: Users,
    sections: [
      {
        title: "Sovereign Rooms",
        description:
          "Relay-backed groups with peer governance. Exact live roster parity across devices is best-effort on public relays.",
        icon: Globe,
      },
      {
        title: "Managed Workspaces",
        description:
          "Private relay + coordination stacks for organizations that need stronger membership controls on infra they trust.",
        icon: Lock,
      },
      {
        title: "Vote-Driven Changes",
        description:
          "Where the mode supports it, membership and room changes require quorum — not silent unilateral admin theater on public relays.",
        icon: Users,
      },
      {
        title: "Portable Identity",
        description:
          "Your keys travel with you across groups. Cross-community delivery still depends on shared relay reachability.",
        icon: Radio,
      },
    ],
  },
};

export function generateStaticParams() {
  return Object.keys(features).map((slug) => ({ slug }));
}

export function generateMetadata({ params }: { params: { slug: string } }): Metadata {
  const feature = features[params.slug as keyof typeof features];
  if (!feature) {
    return {
      title: "Feature Not Found | Obscur",
    };
  }
  return {
    title: `${feature.title} | Obscur Features`,
    description: feature.description,
  };
}

export default function FeaturePage({ params }: { params: { slug: string } }) {
  const feature = features[params.slug as keyof typeof features];
  if (!feature) {
    notFound();
  }

  const Icon = feature.icon;

  return (
    <main className="min-h-screen bg-black text-white">
      {/* Hero Section */}
      <section className="relative overflow-hidden py-24 sm:py-32">
        <div className="absolute inset-0 bg-gradient-to-b from-blue-900/20 to-black" />
        <div className="relative mx-auto max-w-7xl px-6 lg:px-8">
          <div className="mx-auto max-w-2xl text-center">
            <div className="mb-8 inline-flex items-center justify-center rounded-2xl bg-blue-500/10 p-4">
              <Icon className="h-12 w-12 text-blue-400" />
            </div>
            <h1 className="text-4xl font-bold tracking-tight text-white sm:text-6xl">
              {feature.title}
            </h1>
            <p className="mt-6 text-lg leading-8 text-zinc-300">
              {feature.description}
            </p>
          </div>
        </div>
      </section>

      {/* Feature Sections */}
      <section className="py-24 sm:py-32">
        <div className="mx-auto max-w-7xl px-6 lg:px-8">
          <div className="grid grid-cols-1 gap-x-8 gap-y-12 md:grid-cols-2 lg:grid-cols-2">
            {feature.sections.map((section) => {
              const SectionIcon = section.icon;
              return (
                <div
                  key={section.title}
                  className="group relative rounded-3xl bg-zinc-900/50 p-8 ring-1 ring-white/10 transition-all hover:bg-zinc-900/80 hover:ring-white/20"
                >
                  <div className="mb-6 inline-flex items-center justify-center rounded-xl bg-blue-500/10 p-3">
                    <SectionIcon className="h-6 w-6 text-blue-400" />
                  </div>
                  <h3 className="text-xl font-semibold text-white">
                    {section.title}
                  </h3>
                  <p className="mt-4 text-zinc-400 leading-relaxed">
                    {section.description}
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-24 sm:py-32">
        <div className="mx-auto max-w-7xl px-6 lg:px-8">
          <div className="relative isolate overflow-hidden rounded-3xl bg-gradient-to-r from-blue-600 to-purple-600 px-6 py-24 text-center shadow-2xl sm:px-16">
            <h2 className="mx-auto max-w-2xl text-3xl font-bold tracking-tight text-white sm:text-4xl">
              Ready to experience {feature.title.toLowerCase()}?
            </h2>
            <p className="mx-auto mt-6 max-w-xl text-lg leading-8 text-blue-100">
              Download Obscur today and join the privacy revolution.
            </p>
            <div className="mt-10 flex items-center justify-center gap-x-6">
              <a
                href="/download"
                className="rounded-full bg-white px-8 py-4 text-sm font-semibold text-blue-600 shadow-sm hover:bg-blue-50 transition-colors"
              >
                Download Now
              </a>
              <a
                href="/"
                className="text-sm font-semibold leading-6 text-white hover:text-blue-100"
              >
                Learn More <span aria-hidden="true">→</span>
              </a>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
