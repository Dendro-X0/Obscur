"use client";

import React, { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, Search, Trash2, Users, X } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "@dweb/ui-kit/button";
import { Input } from "@dweb/ui-kit/input";
import { ConfirmDialog } from "@/app/components/ui/confirm-dialog";
import { cn } from "@dweb/ui-kit/cn";
import type { PublicKeyHex } from "@dweb/crypto/public-key-hex";
import { UserAvatar } from "@/app/features/profile/components/user-avatar";
import { useResolvedProfileMetadata } from "@/app/features/profile/hooks/use-resolved-profile-metadata";
import { useEscapeDismissLayer } from "@/app/lib/use-escape-dismiss-layer";
import { CommunityMembershipEvidenceChip } from "@/app/features/groups/components/community-membership-evidence-chip";
import {
  isCommunityParticipantInContacts,
  summarizeCommunityParticipantContactCoverage,
} from "@/app/features/groups/services/community-participant-contact-read-model";
import {
  buildFindInCommunitySections,
  FIND_IN_COMMUNITY_SECTION_CAP,
} from "@/app/features/groups/services/community-find-in-community-sections";
import {
  resolveCommunityMemberEvidenceTier,
  type CommunityMemberEvidenceTier,
  type CommunityTerminalMemberKind,
} from "@/app/features/groups/utils/community-member-evidence-tier";
import type { MembershipEvidenceUiContext } from "@/app/features/groups/utils/community-membership-evidence-display";

const PAGE_SIZE = 12;

export type CommunityFindInCommunityPickerProps = Readonly<{
  open: boolean;
  onClose: () => void;
  visiblePubkeys: ReadonlyArray<string>;
  authorEvidencePubkeys: ReadonlyArray<string>;
  acceptedPeers: ReadonlyArray<PublicKeyHex>;
  selfPubkey?: PublicKeyHex | null;
  activeMemberPubkeys: ReadonlyArray<PublicKeyHex>;
  provisionalMemberPubkeys: ReadonlyArray<PublicKeyHex>;
  membershipEvidenceUiContext: MembershipEvidenceUiContext;
  terminalEntries: ReadonlyArray<Readonly<{
    pubkey: PublicKeyHex;
    kind: CommunityTerminalMemberKind;
  }>>;
  isPeerOnline?: (pubkey: PublicKeyHex) => boolean;
  /** Optional profile haystack (display name / nip05) for local search. */
  getSearchHaystack?: (pubkey: string) => string;
  onOpenProfile: (pubkey: string) => void;
  onClearTerminalConfirmed?: () => void;
}>;

export function CommunityFindInCommunityPicker(
  props: CommunityFindInCommunityPickerProps,
): React.JSX.Element | null {
  const { t } = useTranslation();
  const [searchQuery, setSearchQuery] = useState("");
  const [everyonePage, setEveryonePage] = useState(1);
  const [isClearTerminalOpen, setIsClearTerminalOpen] = useState(false);

  useEscapeDismissLayer({ enabled: props.open, onClose: props.onClose });

  const normalizedSearch = searchQuery.trim().toLowerCase();
  const isSearching = normalizedSearch.length > 0;

  const localMatchesSearch = React.useCallback((pubkey: string): boolean => {
    if (!isSearching) {
      return true;
    }
    const haystack = [
      pubkey,
      props.getSearchHaystack?.(pubkey) ?? "",
    ].join(" ").toLowerCase();
    return haystack.includes(normalizedSearch);
  }, [isSearching, normalizedSearch, props.getSearchHaystack]);

  const sections = useMemo(() => buildFindInCommunitySections({
    visiblePubkeys: props.visiblePubkeys,
    authorEvidencePubkeys: props.authorEvidencePubkeys,
    acceptedPeers: props.acceptedPeers,
    selfPubkey: props.selfPubkey,
    matchesSearch: localMatchesSearch,
    sectionCap: FIND_IN_COMMUNITY_SECTION_CAP,
  }), [
    localMatchesSearch,
    props.acceptedPeers,
    props.authorEvidencePubkeys,
    props.selfPubkey,
    props.visiblePubkeys,
  ]);

  const contactCoverage = useMemo(() => summarizeCommunityParticipantContactCoverage(
    props.visiblePubkeys,
    props.acceptedPeers,
    props.selfPubkey,
  ), [props.acceptedPeers, props.selfPubkey, props.visiblePubkeys]);

  const filteredTerminal = useMemo(() => (
    props.terminalEntries.filter((entry) => localMatchesSearch(entry.pubkey))
  ), [localMatchesSearch, props.terminalEntries]);

  const everyoneTotalPages = Math.max(1, Math.ceil(sections.everyoneElse.length / PAGE_SIZE));
  const pagedEveryone = useMemo(() => {
    const start = (everyonePage - 1) * PAGE_SIZE;
    return sections.everyoneElse.slice(start, start + PAGE_SIZE);
  }, [everyonePage, sections.everyoneElse]);

  const visibleMatchCount = useMemo(() => {
    const unique = new Set<string>([
      ...sections.recentInChat,
      ...sections.connectionsHere,
      ...sections.everyoneElse,
      ...filteredTerminal.map((entry) => entry.pubkey),
    ]);
    return unique.size;
  }, [filteredTerminal, sections.connectionsHere, sections.everyoneElse, sections.recentInChat]);

  React.useEffect(() => {
    setEveryonePage(1);
  }, [normalizedSearch, props.visiblePubkeys.length]);

  if (!props.open) {
    return null;
  }

  const renderMemberRow = (pubkey: string, keyPrefix: string, options: Readonly<{
    inContacts: boolean;
    showContactStatus: boolean;
  }>) => (
    <FindMemberRow
      key={`${keyPrefix}-${pubkey}`}
      pubkey={pubkey}
      evidenceTier={resolveCommunityMemberEvidenceTier(pubkey, {
        activeMemberPubkeys: props.activeMemberPubkeys,
        provisionalMemberPubkeys: props.provisionalMemberPubkeys,
      })}
      inContacts={options.inContacts}
      showContactStatus={options.showContactStatus}
      online={props.isPeerOnline?.(pubkey as PublicKeyHex) === true}
      membershipEvidenceUiContext={props.membershipEvidenceUiContext}
      onOpenProfile={props.onOpenProfile}
    />
  );

  const showUnifiedEmpty = visibleMatchCount === 0;

  return (
    <div
      data-escape-layer="open"
      data-testid="find-in-community-picker"
      className="fixed inset-0 z-[140] flex items-end justify-center bg-black/60 p-0 backdrop-blur-sm sm:items-center sm:p-4"
      onClick={props.onClose}
    >
      <div
        className="flex max-h-[min(92vh,760px)] w-full max-w-2xl flex-col overflow-hidden rounded-t-[28px] border border-black/10 bg-white/98 shadow-2xl dark:border-white/10 dark:bg-[#0C0C0E] sm:rounded-[28px]"
        onClick={(event) => event.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="find-in-community-title"
      >
        <div className="shrink-0 border-b border-black/10 px-5 pb-4 pt-5 dark:border-white/10 sm:px-6">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <h3
                  id="find-in-community-title"
                  className="text-lg font-bold tracking-tight text-zinc-900 dark:text-white sm:text-xl"
                >
                  {t("groups.home.findInCommunity.title")}
                </h3>
                {props.visiblePubkeys.length > 0 ? (
                  <span className="rounded-full border border-purple-500/20 bg-purple-500/10 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-purple-700 dark:text-purple-300">
                    {t("groups.home.findInCommunity.visibleCount", { count: props.visiblePubkeys.length })}
                  </span>
                ) : null}
              </div>
              <p className="mt-1.5 max-w-prose text-xs leading-relaxed text-zinc-600 dark:text-zinc-400">
                {t("groups.home.findInCommunity.subtitle")}
              </p>
              {contactCoverage.notInContactsCount > 0 ? (
                <p className="mt-2 text-xs leading-snug text-amber-800/90 dark:text-amber-200/90">
                  {t("groups.home.participantsModal.notInContactsSummary", {
                    count: contactCoverage.notInContactsCount,
                  })}
                </p>
              ) : null}
            </div>
            <div className="flex shrink-0 items-start gap-1.5">
              {filteredTerminal.length > 0 && props.onClearTerminalConfirmed ? (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  title={t("groups.membershipEvidence.clearTerminalDetail")}
                  onClick={() => setIsClearTerminalOpen(true)}
                  className="hidden h-9 gap-1.5 rounded-xl border-rose-500/30 px-3 text-[10px] font-semibold uppercase tracking-wide text-rose-700 hover:bg-rose-500/10 dark:border-rose-500/35 dark:text-rose-300 dark:hover:bg-rose-500/15 sm:inline-flex"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  {t("groups.membershipEvidence.clearTerminal")}
                </Button>
              ) : null}
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-9 w-9 shrink-0 rounded-xl text-zinc-600 hover:bg-black/[0.06] hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-white/5 dark:hover:text-white"
                onClick={props.onClose}
                aria-label={t("common.close")}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>

          <div className="relative mt-4">
            <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
            <Input
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder={t("groups.home.findInCommunity.searchPlaceholder")}
              className="h-11 rounded-2xl border-black/10 bg-zinc-50/80 pl-10 pr-10 text-sm text-zinc-900 placeholder:text-zinc-500 focus:border-purple-400/40 focus:ring-purple-400/20 dark:border-white/10 dark:bg-white/[0.04] dark:text-zinc-100 dark:placeholder:text-zinc-500"
              autoFocus
            />
            {searchQuery.length > 0 ? (
              <button
                type="button"
                onClick={() => setSearchQuery("")}
                className="absolute right-2 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-lg text-zinc-500 transition-colors hover:bg-black/[0.06] hover:text-zinc-800 dark:hover:bg-white/10 dark:hover:text-zinc-200"
                aria-label={t("groups.home.findInCommunity.clearSearch")}
              >
                <X className="h-3.5 w-3.5" />
              </button>
            ) : null}
          </div>

          {isSearching ? (
            <p className="mt-2 text-[11px] font-medium text-zinc-500 dark:text-zinc-400">
              {visibleMatchCount === 0
                ? t("groups.home.findInCommunity.noMatches")
                : t("groups.home.findInCommunity.matchCount", { count: visibleMatchCount })}
            </p>
          ) : null}
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 py-4 sm:px-6">
          {showUnifiedEmpty ? (
            <FindEmptyState
              searching={isSearching}
              onClearSearch={() => setSearchQuery("")}
            />
          ) : isSearching ? (
            <ul className="space-y-1">
              {[...sections.recentInChat, ...sections.connectionsHere, ...sections.everyoneElse].map((pubkey) => (
                renderMemberRow(pubkey, "search", {
                  inContacts: isCommunityParticipantInContacts(
                    pubkey,
                    props.acceptedPeers,
                    props.selfPubkey,
                  ),
                  showContactStatus: !props.selfPubkey
                    || pubkey.trim().toLowerCase() !== props.selfPubkey.trim().toLowerCase(),
                })
              ))}
              {filteredTerminal.map((entry) => (
                <TerminalRow
                  key={`terminal-search-${entry.kind}-${entry.pubkey}`}
                  pubkey={entry.pubkey}
                  terminalKind={entry.kind}
                  membershipEvidenceUiContext={props.membershipEvidenceUiContext}
                  onOpenProfile={props.onOpenProfile}
                />
              ))}
            </ul>
          ) : (
            <div className="space-y-6">
              <FindSection
                title={t("groups.home.findInCommunity.recentInChat")}
                pubkeys={sections.recentInChat}
                renderRow={(pubkey) => renderMemberRow(pubkey, "recent", {
                  inContacts: isCommunityParticipantInContacts(
                    pubkey,
                    props.acceptedPeers,
                    props.selfPubkey,
                  ),
                  showContactStatus: !props.selfPubkey
                    || pubkey.trim().toLowerCase() !== props.selfPubkey.trim().toLowerCase(),
                })}
              />

              <FindSection
                title={t("groups.home.findInCommunity.connectionsHere")}
                pubkeys={sections.connectionsHere}
                renderRow={(pubkey) => renderMemberRow(pubkey, "conn", {
                  inContacts: true,
                  showContactStatus: false,
                })}
              />

              <FindSection
                title={t("groups.home.findInCommunity.everyoneElse")}
                pubkeys={pagedEveryone}
                renderRow={(pubkey) => renderMemberRow(pubkey, "else", {
                  inContacts: isCommunityParticipantInContacts(
                    pubkey,
                    props.acceptedPeers,
                    props.selfPubkey,
                  ),
                  showContactStatus: !props.selfPubkey
                    || pubkey.trim().toLowerCase() !== props.selfPubkey.trim().toLowerCase(),
                })}
              />

              {sections.everyoneElse.length > PAGE_SIZE ? (
                <div className="flex items-center justify-between px-1 pb-1">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setEveryonePage((page) => Math.max(1, page - 1))}
                    disabled={everyonePage <= 1}
                    className="h-8 rounded-lg px-3 text-zinc-600 hover:text-zinc-900 disabled:opacity-40 dark:text-zinc-300 dark:hover:text-white"
                  >
                    <ChevronLeft className="mr-1 h-3.5 w-3.5" />
                    {t("groups.home.participantsModal.prev")}
                  </Button>
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                    {t("groups.home.participantsModal.page", {
                      current: everyonePage,
                      total: everyoneTotalPages,
                    })}
                  </p>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setEveryonePage((page) => Math.min(everyoneTotalPages, page + 1))}
                    disabled={everyonePage >= everyoneTotalPages}
                    className="h-8 rounded-lg px-3 text-zinc-600 hover:text-zinc-900 disabled:opacity-40 dark:text-zinc-300 dark:hover:text-white"
                  >
                    {t("groups.home.participantsModal.next")}
                    <ChevronRight className="ml-1 h-3.5 w-3.5" />
                  </Button>
                </div>
              ) : null}

              {filteredTerminal.length > 0 ? (
                <FindSection
                  title={t("groups.home.findInCommunity.terminal")}
                  pubkeys={[]}
                  tone="muted"
                  renderRow={() => null}
                  footer={filteredTerminal.map((entry) => (
                    <TerminalRow
                      key={`terminal-${entry.kind}-${entry.pubkey}`}
                      pubkey={entry.pubkey}
                      terminalKind={entry.kind}
                      membershipEvidenceUiContext={props.membershipEvidenceUiContext}
                      onOpenProfile={props.onOpenProfile}
                    />
                  ))}
                />
              ) : null}
            </div>
          )}
        </div>
      </div>

      {props.onClearTerminalConfirmed ? (
        <ConfirmDialog
          isOpen={isClearTerminalOpen}
          onClose={() => setIsClearTerminalOpen(false)}
          onConfirm={() => {
            setIsClearTerminalOpen(false);
            props.onClearTerminalConfirmed?.();
          }}
          title={t("groups.membershipEvidence.clearTerminalTitle")}
          description={t("groups.membershipEvidence.clearTerminalConfirm")}
          confirmLabel={t("groups.membershipEvidence.clearTerminalConfirmAction")}
          variant="danger"
        />
      ) : null}
    </div>
  );
}

function FindEmptyState(props: Readonly<{
  searching: boolean;
  onClearSearch: () => void;
}>): React.JSX.Element {
  const { t } = useTranslation();
  return (
    <div className="flex flex-col items-center justify-center px-4 py-12 text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-black/10 bg-zinc-100/80 dark:border-white/10 dark:bg-white/[0.04]">
        <Users className="h-6 w-6 text-zinc-400 dark:text-zinc-500" />
      </div>
      <p className="mt-4 text-sm font-semibold text-zinc-800 dark:text-zinc-200">
        {props.searching
          ? t("groups.home.findInCommunity.noMatches")
          : t("groups.home.findInCommunity.emptyCommunity")}
      </p>
      <p className="mt-1 max-w-xs text-xs leading-relaxed text-zinc-500 dark:text-zinc-400">
        {props.searching
          ? t("groups.home.findInCommunity.tryAnotherSearch")
          : t("groups.home.findInCommunity.emptyCommunityHint")}
      </p>
      {props.searching ? (
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="mt-4 rounded-xl"
          onClick={props.onClearSearch}
        >
          {t("groups.home.findInCommunity.clearSearch")}
        </Button>
      ) : null}
    </div>
  );
}

function FindSection(props: Readonly<{
  title: string;
  pubkeys: ReadonlyArray<string>;
  renderRow: (pubkey: string) => React.ReactNode;
  tone?: "default" | "muted";
  footer?: React.ReactNode;
}>): React.JSX.Element | null {
  const hasRows = props.pubkeys.length > 0;
  const hasFooter = Boolean(props.footer);
  if (!hasRows && !hasFooter) {
    return null;
  }

  return (
    <section>
      <div className="mb-2 flex items-center gap-2 px-0.5">
        <h4 className={cn(
          "text-[11px] font-semibold uppercase tracking-wider",
          props.tone === "muted"
            ? "text-zinc-500 dark:text-zinc-500"
            : "text-zinc-600 dark:text-zinc-400",
        )}>
          {props.title}
        </h4>
        {hasRows ? (
          <span className="rounded-md bg-black/[0.04] px-1.5 py-0.5 text-[10px] font-medium tabular-nums text-zinc-500 dark:bg-white/[0.06] dark:text-zinc-400">
            {props.pubkeys.length}
          </span>
        ) : null}
      </div>
      {hasRows ? (
        <ul className="space-y-1">
          {props.pubkeys.map((pubkey) => (
            <li key={pubkey}>{props.renderRow(pubkey)}</li>
          ))}
        </ul>
      ) : null}
      {hasFooter ? (
        <ul className="space-y-1">{props.footer}</ul>
      ) : null}
    </section>
  );
}

function resolveMemberSubtitle(
  pubkey: string,
  metadata: ReturnType<typeof useResolvedProfileMetadata>,
  profileUnavailableLabel: string,
): string {
  if (metadata.isDeleted) {
    return profileUnavailableLabel;
  }
  if (metadata.nip05) {
    return metadata.nip05;
  }
  return `${pubkey.slice(0, 8)}…${pubkey.slice(-4)}`;
}

function FindMemberRow(props: Readonly<{
  pubkey: string;
  evidenceTier: CommunityMemberEvidenceTier;
  inContacts: boolean;
  showContactStatus: boolean;
  online: boolean;
  membershipEvidenceUiContext: MembershipEvidenceUiContext;
  onOpenProfile: (pubkey: string) => void;
}>): React.JSX.Element {
  const { t } = useTranslation();
  const metadata = useResolvedProfileMetadata(props.pubkey);
  const displayName = metadata?.displayName
    || t("groups.home.memberFallbackName", { prefix: props.pubkey.slice(0, 8) });
  const subtitle = resolveMemberSubtitle(
    props.pubkey,
    metadata,
    t("groups.home.memberStatus.profileUnavailable"),
  );

  return (
    <button
      type="button"
      onClick={() => props.onOpenProfile(props.pubkey)}
      className="group flex w-full items-center gap-3 rounded-2xl px-3 py-2.5 text-left transition-colors hover:bg-black/[0.04] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-500/35 dark:hover:bg-white/[0.05]"
    >
      <UserAvatar
        pubkey={props.pubkey}
        size="sm"
        showProfileOnClick={false}
        className="rounded-xl border border-black/10 dark:border-white/10"
      />
      <div className="min-w-0 flex-1">
        <div className="flex min-w-0 items-center gap-2">
          <p className="truncate text-sm font-semibold text-zinc-900 dark:text-zinc-100">{displayName}</p>
          <CommunityMembershipEvidenceChip
            tier={props.evidenceTier}
            uiContext={props.membershipEvidenceUiContext}
            className="hidden sm:inline-flex"
          />
        </div>
        <div className="mt-0.5 flex flex-wrap items-center gap-1.5">
          <p className="truncate text-xs text-zinc-500 dark:text-zinc-400">{subtitle}</p>
          <CommunityMembershipEvidenceChip
            tier={props.evidenceTier}
            uiContext={props.membershipEvidenceUiContext}
            className="sm:hidden"
          />
          {props.showContactStatus && !props.inContacts ? (
            <span className="shrink-0 rounded-md border border-amber-500/25 bg-amber-500/10 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-amber-800 dark:text-amber-200">
              {t("groups.home.participantsModal.notInContactsBadge")}
            </span>
          ) : null}
          {props.online ? (
            <span className="inline-flex shrink-0 items-center gap-1 rounded-md bg-emerald-500/10 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-emerald-700 dark:text-emerald-200">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
              {t("groups.home.findInCommunity.onlineHere")}
            </span>
          ) : null}
        </div>
      </div>
      <ChevronRight className="h-4 w-4 shrink-0 text-zinc-400 opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100" />
    </button>
  );
}

function TerminalRow(props: Readonly<{
  pubkey: string;
  terminalKind: CommunityTerminalMemberKind;
  membershipEvidenceUiContext: MembershipEvidenceUiContext;
  onOpenProfile: (pubkey: string) => void;
}>): React.JSX.Element {
  const { t } = useTranslation();
  const metadata = useResolvedProfileMetadata(props.pubkey);
  const displayName = metadata?.displayName
    || t("groups.home.memberFallbackName", { prefix: props.pubkey.slice(0, 8) });
  const kindLabel = props.terminalKind === "left"
    ? t("groups.membershipEvidence.terminalLeft")
    : t("groups.membershipEvidence.terminalExpelled");

  return (
    <li>
      <button
        type="button"
        onClick={() => props.onOpenProfile(props.pubkey)}
        className="group flex w-full items-center gap-3 rounded-2xl px-3 py-2.5 text-left transition-colors hover:bg-zinc-500/[0.06] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400/35"
      >
        <UserAvatar
          pubkey={props.pubkey}
          size="sm"
          showProfileOnClick={false}
          className="rounded-xl border border-black/10 opacity-75 dark:border-white/10"
        />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="truncate text-sm font-semibold text-zinc-700 dark:text-zinc-300">{displayName}</p>
            <CommunityMembershipEvidenceChip tier="terminal" uiContext={props.membershipEvidenceUiContext} />
            <span className="shrink-0 rounded-md bg-zinc-500/15 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-zinc-600 dark:text-zinc-400">
              {kindLabel}
            </span>
          </div>
        </div>
        <ChevronRight className="h-4 w-4 shrink-0 text-zinc-500 opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100" />
      </button>
    </li>
  );
}
