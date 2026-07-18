"use client";

import { useEffect, useState } from "react";
import type { GuideMedia } from "./site-content";

type AmbientDemoVideoProps = Readonly<{
  media: GuideMedia;
  className?: string;
}>;

/** Muted looping demo; prefers static poster when reduced-motion is set. */
export function AmbientDemoVideo({ media, className }: AmbientDemoVideoProps) {
  const [reducedMotion, setReducedMotion] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const sync = () => setReducedMotion(mq.matches);
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);

  if (reducedMotion && media.posterUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element -- static poster for reduced motion
      <img className={className} src={media.posterUrl} alt={media.alt} />
    );
  }

  return (
    <video
      className={className}
      muted
      loop
      playsInline
      autoPlay={!reducedMotion}
      preload="metadata"
      poster={media.posterUrl ?? undefined}
      aria-label={media.alt}
    >
      <source src={media.url} type="video/mp4" />
    </video>
  );
}
