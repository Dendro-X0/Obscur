"use client";

import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  type KeyboardEvent,
} from "react";
import type { FeatureCard } from "./site-content";

type FeatureStageTheaterProps = Readonly<{
  features: readonly FeatureCard[];
}>;

function padIndex(n: number): string {
  return String(n).padStart(2, "0");
}

export function FeatureStageTheater({ features }: FeatureStageTheaterProps) {
  const listId = useId();
  const [active, setActive] = useState(0);
  const [reducedMotion, setReducedMotion] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const count = features.length;
  const feature = features[active] ?? features[0];

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const sync = () => setReducedMotion(mq.matches);
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !feature || feature.media.kind !== "mp4") return;
    if (reducedMotion) {
      video.pause();
      return;
    }
    video.load();
    const play = video.play();
    if (play && typeof play.catch === "function") {
      play.catch(() => {
        /* autoplay may be blocked; poster still shows */
      });
    }
  }, [active, feature, reducedMotion]);

  const select = useCallback(
    (index: number) => {
      if (index < 0 || index >= count) return;
      setActive(index);
      const cue = document.getElementById(`${listId}-cue-${index}`);
      cue?.scrollIntoView({ block: "nearest", behavior: reducedMotion ? "auto" : "smooth" });
    },
    [count, listId, reducedMotion],
  );

  const onKeyDown = useCallback(
    (event: KeyboardEvent<HTMLDivElement>) => {
      if (event.key === "ArrowDown" || event.key === "ArrowRight") {
        event.preventDefault();
        select((active + 1) % count);
      } else if (event.key === "ArrowUp" || event.key === "ArrowLeft") {
        event.preventDefault();
        select((active - 1 + count) % count);
      } else if (event.key === "Home") {
        event.preventDefault();
        select(0);
      } else if (event.key === "End") {
        event.preventDefault();
        select(count - 1);
      }
    },
    [active, count, select],
  );

  if (!feature || count === 0) {
    return null;
  }

  const showPosterOnly = reducedMotion && Boolean(feature.media.posterUrl);
  const isMp4 = feature.media.kind === "mp4";

  return (
    <div
      className="stage-theater"
      data-reveal
      tabIndex={0}
      onKeyDown={onKeyDown}
      role="region"
      aria-roledescription="carousel"
      aria-label="Product demo stages"
    >
      <div className="stage-theater-stage">
        <div
          key={feature.title}
          className={`stage-theater-media${reducedMotion ? "" : " stage-theater-media--fade"}`}
        >
          {showPosterOnly ? (
            // eslint-disable-next-line @next/next/no-img-element -- reduced-motion poster
            <img
              className="stage-theater-frame"
              src={feature.media.posterUrl}
              alt={feature.gifAlt}
            />
          ) : isMp4 ? (
            <video
              ref={videoRef}
              key={feature.media.url}
              className="stage-theater-frame"
              muted
              loop
              playsInline
              autoPlay={!reducedMotion}
              preload="metadata"
              poster={feature.media.posterUrl ?? undefined}
              aria-label={feature.gifAlt}
            >
              <source src={feature.media.url} type="video/mp4" />
            </video>
          ) : (
            // eslint-disable-next-line @next/next/no-img-element -- GIF fallback
            <img className="stage-theater-frame" src={feature.media.url} alt={feature.gifAlt} />
          )}
        </div>

        <div className="stage-theater-caption">
          <p className="stage-theater-progress" aria-live="polite">
            <span className="stage-theater-progress-num">{padIndex(active + 1)}</span>
            <span className="stage-theater-progress-sep" aria-hidden="true">
              /
            </span>
            <span>{padIndex(count)}</span>
          </p>
          <h3 id={`${listId}-title`}>{feature.title}</h3>
          <p className="stage-theater-summary">{feature.summary}</p>
          <a className="feature-guide-link" href={feature.guideHref}>
            Open in guide
          </a>
        </div>
      </div>

      <nav className="stage-theater-index" aria-label="Demo stages">
        <ol className="stage-theater-list" id={listId}>
          {features.map((item, index) => {
            const isActive = index === active;
            return (
              <li key={item.title}>
                <button
                  type="button"
                  id={`${listId}-cue-${index}`}
                  className={`stage-theater-cue${isActive ? " is-active" : ""}`}
                  aria-current={isActive ? "true" : undefined}
                  aria-label={`${padIndex(index + 1)} ${item.title}`}
                  onClick={() => select(index)}
                >
                  <span className="stage-theater-cue-num" aria-hidden="true">
                    {padIndex(index + 1)}
                  </span>
                  <span className="stage-theater-cue-label">{item.title}</span>
                </button>
              </li>
            );
          })}
        </ol>
      </nav>
    </div>
  );
}
