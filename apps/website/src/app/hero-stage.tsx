"use client";

import { useEffect, useState } from "react";
import type { GuideMedia } from "./site-content";

type HeroStageProps = Readonly<{
  media: GuideMedia;
  hasAudio: boolean;
}>;

/**
 * Full-bleed hero media.
 * - hasAudio: controls + user-initiated play (sound only after click)
 * - ambient: muted loop; reduced-motion → static poster
 */
export function HeroStage({ media, hasAudio }: HeroStageProps) {
  const [reducedMotion, setReducedMotion] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const sync = () => setReducedMotion(mq.matches);
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);

  const poster = media.posterUrl;

  if (hasAudio) {
    return (
      <div className="hero-theater-media">
        <video
          className="hero-theater-video"
          controls
          playsInline
          preload="metadata"
          poster={poster ?? undefined}
          aria-label={media.alt}
        >
          <source src={media.url} type="video/mp4" />
        </video>
      </div>
    );
  }

  if (reducedMotion && poster) {
    return (
      <div className="hero-theater-media">
        {/* eslint-disable-next-line @next/next/no-img-element -- static poster for reduced motion */}
        <img className="hero-theater-poster" src={poster} alt={media.alt} />
      </div>
    );
  }

  return (
    <div className="hero-theater-media hero-theater-media--ambient">
      <video
        className="hero-theater-video"
        muted
        loop
        playsInline
        autoPlay
        preload="metadata"
        poster={poster ?? undefined}
        aria-label={media.alt}
      >
        <source src={media.url} type="video/mp4" />
      </video>
    </div>
  );
}
