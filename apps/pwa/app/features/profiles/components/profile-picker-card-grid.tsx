"use client";

import type React from "react";
import { useCallback, useEffect, useRef, useState } from "react";
import Image from "next/image";
import { MoreHorizontal, Plus } from "lucide-react";
import { motion } from "framer-motion";
import { useTranslation } from "react-i18next";
import { Button } from "@dweb/ui-kit/button";
import { UserAvatar } from "@/app/components/user-avatar";
import { LanguageSelector } from "@/app/components/language-selector";
import { cn } from "@/app/lib/utils";
import type { DesktopProfileMenuEntry } from "@/app/features/profiles/services/desktop-profile-switcher-view";
import { resolveDesktopProfileAccountPresenceLabelKey } from "@/app/features/profiles/services/desktop-profile-account-presence-label";
import { resolveDesktopProfileCardDisplay } from "@/app/features/profiles/services/desktop-profile-card-display";
import { ProfilePickerShowOnStartupFooter } from "./profile-picker-show-on-startup-footer";
import { canRemoveDesktopProfileEntry } from "@/app/features/profiles/services/can-remove-desktop-profile";
import { isMobileShellProduct } from "@/app/features/runtime/shell-contract";

type Props = Readonly<{
  entries: ReadonlyArray<DesktopProfileMenuEntry>;
  onLaunchProfile: (profileId: string) => void;
  onSwitchHere: (profileId: string) => void;
  onRemoveProfile: (profileId: string) => void;
  onAddProfile: () => void;
  onAdvancedManagement: () => void;
}>;

const CAROUSEL_VIEWPORT_QUERY = "(max-width: 640px)";
const SLIDE_SPRING = { type: "spring" as const, stiffness: 380, damping: 32, mass: 0.7 };

const readMobilePreviewRuntimeFlag = (): boolean => {
  if (typeof window === "undefined") {
    return false;
  }
  const flagged = (window as Window & { __OBSCUR_MOBILE_PREVIEW__?: boolean }).__OBSCUR_MOBILE_PREVIEW__ === true;
  return flagged || document.documentElement.getAttribute("data-obscur-mobile-preview") === "1";
};

/** Mobile shell, phone-preview harness, or narrow viewport → horizontal carousel. */
const useProfilePickerCarousel = (): boolean => {
  const [enabled, setEnabled] = useState(() => isMobileShellProduct());

  useEffect(() => {
    const sync = () => {
      const narrow = typeof window.matchMedia === "function"
        && window.matchMedia(CAROUSEL_VIEWPORT_QUERY).matches;
      setEnabled(isMobileShellProduct() || readMobilePreviewRuntimeFlag() || narrow);
    };
    sync();
    const media = window.matchMedia(CAROUSEL_VIEWPORT_QUERY);
    media.addEventListener("change", sync);
    return () => media.removeEventListener("change", sync);
  }, []);

  return enabled;
};

  export function ProfilePickerCardGrid(props: Props): React.JSX.Element {
  const { t } = useTranslation();
  const useCarousel = useProfilePickerCarousel();
  const [isMobilePreview, setIsMobilePreview] = useState(false);
  const slideCount = props.entries.length + 1;
  const scrollerRef = useRef<HTMLDivElement | null>(null);
  const [activeIndex, setActiveIndex] = useState(0);

  useEffect(() => {
    setIsMobilePreview(readMobilePreviewRuntimeFlag());
  }, []);

  const syncActiveFromScroll = useCallback(() => {
    const scroller = scrollerRef.current;
    if (!scroller) {
      return;
    }
    const slides = scroller.querySelectorAll<HTMLElement>("[data-picker-slide]");
    if (slides.length === 0) {
      return;
    }
    const center = scroller.scrollLeft + scroller.clientWidth / 2;
    let bestIndex = 0;
    let bestDistance = Number.POSITIVE_INFINITY;
    slides.forEach((slide, index) => {
      const slideCenter = slide.offsetLeft + slide.offsetWidth / 2;
      const distance = Math.abs(slideCenter - center);
      if (distance < bestDistance) {
        bestDistance = distance;
        bestIndex = index;
      }
    });
    setActiveIndex(bestIndex);
  }, []);

  useEffect(() => {
    if (!useCarousel) {
      return;
    }
    const scroller = scrollerRef.current;
    if (!scroller) {
      return;
    }
    syncActiveFromScroll();
    scroller.addEventListener("scroll", syncActiveFromScroll, { passive: true });
    window.addEventListener("resize", syncActiveFromScroll);
    return () => {
      scroller.removeEventListener("scroll", syncActiveFromScroll);
      window.removeEventListener("resize", syncActiveFromScroll);
    };
  }, [useCarousel, slideCount, syncActiveFromScroll]);

  const scrollToIndex = (index: number) => {
    const scroller = scrollerRef.current;
    if (!scroller) {
      return;
    }
    const slide = scroller.querySelectorAll<HTMLElement>("[data-picker-slide]")[index];
    slide?.scrollIntoView({ behavior: "smooth", inline: "center", block: "nearest" });
  };

  const addCard = (carousel: boolean) => (
    <motion.button
      type="button"
      whileTap={carousel ? { scale: 0.97 } : undefined}
      transition={SLIDE_SPRING}
      className={cn(
        "flex flex-col items-center rounded-2xl border-2 border-dashed border-zinc-300 bg-white/40 p-4 text-left transition hover:border-violet-400 hover:bg-violet-500/5 dark:border-zinc-700 dark:bg-zinc-900/30 dark:hover:border-violet-500/60",
        carousel ? "h-full w-full min-h-[15rem] px-5 py-6" : "w-[10.5rem]",
      )}
      onClick={props.onAddProfile}
    >
      <div className="flex w-full items-center justify-between text-xs font-semibold text-zinc-500 dark:text-zinc-400">
        {t("profiles.picker.add")}
      </div>
      <div className="mt-6 flex flex-1 flex-col items-center justify-center">
        <div
          className={cn(
            "flex items-center justify-center rounded-full bg-zinc-200/80 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-300",
            carousel ? "h-24 w-24" : "h-20 w-20",
          )}
        >
          <Plus className={carousel ? "h-10 w-10" : "h-8 w-8"} />
        </div>
      </div>
      <div className="mt-4 w-full truncate text-center text-sm font-medium text-zinc-600 dark:text-zinc-300">
        {t("profiles.picker.newProfile")}
      </div>
    </motion.button>
  );

  return (
    <div className="relative flex min-h-full flex-col items-center px-4 py-8 md:py-12">
      <div className="absolute top-6 right-6 z-[160]">
        <LanguageSelector variant="minimal" />
      </div>

      <div className="flex flex-col items-center text-center">
        <Image src="/obscur-logo-light.svg" alt="Obscur" width={48} height={48} className="dark:hidden" />
        <Image src="/obscur-logo-dark.svg" alt="Obscur" width={48} height={48} className="hidden dark:block" />
        <h1 className="mt-6 text-2xl font-black tracking-tight text-zinc-900 dark:text-zinc-50 md:text-3xl">
          {t("profiles.picker.title")}
        </h1>
        <p className="mt-3 max-w-xl text-sm leading-6 text-zinc-500 dark:text-zinc-400">
          {t(useCarousel ? "profiles.picker.subtitleMobile" : "profiles.picker.subtitle")}
        </p>
        {isMobilePreview ? (
          <p
            className="mt-3 max-w-xl rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-left text-[11px] leading-relaxed text-amber-950 dark:text-amber-100"
            role="status"
            data-testid="profile-picker-mobile-preview-isolation"
          >
            {t("profiles.picker.mobilePreviewIsolation")}
          </p>
        ) : null}
      </div>

      {useCarousel ? (
        <div className="mt-8 flex w-full max-w-lg flex-col items-center">
          <div
            ref={scrollerRef}
            role="region"
            aria-roledescription="carousel"
            aria-label={t("profiles.picker.title")}
            tabIndex={0}
            className="mobile-scroll-region flex w-full snap-x snap-mandatory gap-3 overflow-x-auto overscroll-x-contain px-[12%] pb-3 pt-2 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
            onKeyDown={(event) => {
              if (event.key === "ArrowRight") {
                event.preventDefault();
                scrollToIndex(Math.min(activeIndex + 1, slideCount - 1));
              } else if (event.key === "ArrowLeft") {
                event.preventDefault();
                scrollToIndex(Math.max(activeIndex - 1, 0));
              }
            }}
          >
            {props.entries.map((entry, index) => {
              const active = index === activeIndex;
              return (
                <motion.div
                  key={entry.profileId}
                  data-picker-slide
                  className="w-[70vw] max-w-[15.5rem] shrink-0 snap-center origin-center"
                  aria-roledescription="slide"
                  animate={{
                    scale: active ? 1 : 0.9,
                    opacity: active ? 1 : 0.55,
                    y: active ? 0 : 6,
                  }}
                  transition={SLIDE_SPRING}
                >
                  <ProfilePickerCard
                    entry={entry}
                    size="carousel"
                    onPrimaryAction={() => {
                      props.onLaunchProfile(entry.profileId);
                    }}
                    onSwitchHere={() => props.onSwitchHere(entry.profileId)}
                    onRemoveProfile={() => props.onRemoveProfile(entry.profileId)}
                  />
                </motion.div>
              );
            })}
            <motion.div
              data-picker-slide
              className="w-[70vw] max-w-[15.5rem] shrink-0 snap-center origin-center"
              aria-roledescription="slide"
              animate={{
                scale: activeIndex === props.entries.length ? 1 : 0.9,
                opacity: activeIndex === props.entries.length ? 1 : 0.55,
                y: activeIndex === props.entries.length ? 0 : 6,
              }}
              transition={SLIDE_SPRING}
            >
              {addCard(true)}
            </motion.div>
          </div>

          <div
            className="mt-3 flex items-center justify-center gap-2"
            role="tablist"
            aria-label={t("profiles.picker.carouselDots")}
          >
            {Array.from({ length: slideCount }, (_, index) => (
              <motion.button
                key={`dot-${index}`}
                type="button"
                role="tab"
                aria-selected={index === activeIndex}
                aria-label={t("profiles.picker.carouselDot", { index: index + 1, total: slideCount })}
                className="h-2 rounded-full bg-zinc-400/50 dark:bg-zinc-600"
                animate={{
                  width: index === activeIndex ? 24 : 8,
                  backgroundColor: index === activeIndex
                    ? "rgb(139 92 246)"
                    : "rgba(161, 161, 170, 0.5)",
                }}
                transition={SLIDE_SPRING}
                onClick={() => scrollToIndex(index)}
              />
            ))}
          </div>
        </div>
      ) : (
        <div className="mt-10 flex w-full max-w-5xl flex-wrap items-stretch justify-center gap-5">
          {props.entries.map((entry) => (
            <ProfilePickerCard
              key={entry.profileId}
              entry={entry}
              onPrimaryAction={() => {
                props.onLaunchProfile(entry.profileId);
              }}
              onSwitchHere={() => props.onSwitchHere(entry.profileId)}
              onRemoveProfile={() => props.onRemoveProfile(entry.profileId)}
            />
          ))}
          {addCard(false)}
        </div>
      )}

      <div className="mt-8">
        <Button type="button" variant="outline" size="sm" onClick={props.onAdvancedManagement}>
          {t("profiles.picker.advancedManagement")}
        </Button>
      </div>

      <div className="mt-auto w-full max-w-5xl">
        <ProfilePickerShowOnStartupFooter />
      </div>
    </div>
  );
}

type CardProps = Readonly<{
  entry: DesktopProfileMenuEntry;
  onPrimaryAction: () => void;
  onSwitchHere: () => void;
  onRemoveProfile: () => void;
  size?: "grid" | "carousel";
}>;

function ProfilePickerCard(props: CardProps): React.JSX.Element {
  const { t } = useTranslation();
  const [menuOpen, setMenuOpen] = useState(false);
  const display = resolveDesktopProfileCardDisplay(props.entry);
  const presenceLabel = t(resolveDesktopProfileAccountPresenceLabelKey(props.entry));
  const canRemove = canRemoveDesktopProfileEntry(props.entry);
  const showMenu = true;
  const carousel = props.size === "carousel";

  return (
    <div className={cn("relative", carousel ? "w-full" : "w-[10.5rem]")}>
      <motion.button
        type="button"
        whileTap={carousel ? { scale: 0.97 } : undefined}
        transition={SLIDE_SPRING}
        className={cn(
          "flex w-full flex-col rounded-2xl border bg-white/70 p-4 text-left shadow-sm dark:bg-zinc-900/50",
          carousel && "min-h-[15rem] px-5 py-6 shadow-lg shadow-black/20",
          !carousel && "transition hover:-translate-y-0.5 hover:shadow-md",
          props.entry.shouldFocusExistingWindow
            ? "border-violet-400 ring-2 ring-violet-400/40 shadow-violet-500/10"
            : "border-black/10 dark:border-white/10",
        )}
        onClick={props.onPrimaryAction}
      >
        <div className="flex min-h-[1.25rem] w-full items-center justify-end gap-2">
          {showMenu ? (
            <span
              role="button"
              tabIndex={0}
              className="rounded-md p-1 text-zinc-400 hover:bg-black/5 hover:text-zinc-600 dark:hover:bg-white/10 dark:hover:text-zinc-200"
              onClick={(event) => {
                event.stopPropagation();
                setMenuOpen((current) => !current);
              }}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  event.stopPropagation();
                  setMenuOpen((current) => !current);
                }
              }}
            >
              <MoreHorizontal className="h-4 w-4" />
            </span>
          ) : null}
        </div>
        <div className="mt-2 flex flex-1 items-center justify-center">
          <UserAvatar
            username={display.avatarName}
            avatarUrl={display.avatarUrl}
            sizePx={carousel ? 96 : 80}
          />
        </div>
        {display.showAccountIdentity && display.displayName ? (
          <div className="mt-4 truncate text-center text-sm font-medium text-zinc-800 dark:text-zinc-100">
            {display.displayName}
          </div>
        ) : (
          <div className="mt-4 text-center text-sm font-medium text-zinc-500 dark:text-zinc-400">
            {t("profiles.picker.profileSlot")}
          </div>
        )}
        <div className="mt-1 truncate text-center text-[11px] text-zinc-400 dark:text-zinc-500">
          {presenceLabel}
        </div>
      </motion.button>
      {menuOpen && showMenu ? (
        <div className="absolute right-0 top-10 z-20 min-w-[11rem] rounded-xl border border-black/10 bg-white p-1 shadow-lg dark:border-white/10 dark:bg-zinc-900">
          <button
            type="button"
            className="block w-full rounded-lg px-3 py-2 text-left text-sm hover:bg-zinc-100 dark:hover:bg-zinc-800"
            onClick={() => {
              setMenuOpen(false);
              props.onSwitchHere();
            }}
          >
            {t("profiles.picker.useInThisWindow")}
          </button>
          {canRemove ? (
            <button
              type="button"
              className="block w-full rounded-lg px-3 py-2 text-left text-sm text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950/30"
              onClick={() => {
                setMenuOpen(false);
                props.onRemoveProfile();
              }}
            >
              {t("profiles.picker.removeProfile")}
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
