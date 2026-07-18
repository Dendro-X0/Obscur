import { loadGuideSections } from "../site-content";
import { GuideIndexShell } from "./guide-docs-shell";

export default async function GuideIndexPage() {
  const sections = await loadGuideSections();
  return (
    <main className="site-shell site-shell--guide">
      <GuideIndexShell sections={sections} />
    </main>
  );
}
