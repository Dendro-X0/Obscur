/** Shared App Router loading UI — keep route `loading.tsx` files one-liners. */
export default function SiteRouteLoading() {
  return (
    <main className="site-shell site-route-loading" aria-busy="true" aria-label="Loading">
      <div className="site-route-loading-block site-route-loading-block--eyebrow" />
      <div className="site-route-loading-block site-route-loading-block--title" />
      <div className="site-route-loading-block site-route-loading-block--lead" />
      <div className="site-route-loading-grid" aria-hidden>
        <div className="site-route-loading-block site-route-loading-block--card" />
        <div className="site-route-loading-block site-route-loading-block--card" />
        <div className="site-route-loading-block site-route-loading-block--card" />
      </div>
    </main>
  );
}
