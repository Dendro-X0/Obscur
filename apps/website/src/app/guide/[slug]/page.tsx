import type { Metadata } from "next";
import { notFound } from "next/navigation";
import {
  getGuideSection,
  getGuideSectionNeighbors,
  loadGuideSections,
} from "../../site-content";
import { GuideFeatureShell } from "../guide-docs-shell";

type GuideSlugPageProps = Readonly<{
  params: Promise<{ slug: string }>;
}>;

export async function generateStaticParams() {
  const sections = await loadGuideSections();
  return sections.map((section) => ({ slug: section.id }));
}

export async function generateMetadata({ params }: GuideSlugPageProps): Promise<Metadata> {
  const { slug } = await params;
  const section = await getGuideSection(slug);
  if (!section) {
    return { title: "Guide | Obscur" };
  }
  return {
    title: `${section.title} | Obscur Guide`,
    description: section.summary,
  };
}

export default async function GuideSlugPage({ params }: GuideSlugPageProps) {
  const { slug } = await params;
  const [sections, section, neighbors] = await Promise.all([
    loadGuideSections(),
    getGuideSection(slug),
    getGuideSectionNeighbors(slug),
  ]);

  if (!section || neighbors.index < 0) {
    notFound();
  }

  return (
    <main className="site-shell site-shell--guide">
      <GuideFeatureShell
        sections={sections}
        section={section}
        prev={neighbors.prev}
        next={neighbors.next}
        pageIndex={neighbors.index}
        pageTotal={neighbors.total}
      />
    </main>
  );
}
