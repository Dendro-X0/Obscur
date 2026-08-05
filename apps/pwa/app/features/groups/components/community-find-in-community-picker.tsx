"use client";

import React, { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, Search, Trash2, X } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "@dweb/ui-kit/button";
import { Input } from "@dweb/ui-kit/input";
import { ConfirmDialog } from "@/app/components/ui/confirm-dialog";
import { cn } from "@dweb/ui-kit/cn";
import type { PublicKeyHex } from "@dweb/crypto/public-key-hex";
import { UserAvatar } from "@/app/features/profile/components/user-avatar";
import { useResolvedProfileMetadata } from "@/app/features/profile/hooks/use-resolved-profile-metadata";
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

  const normalizedSearch = searchQuery.trim().toLowerCase();
  const localMatchesSearch = React.useCallback((pubkey: string): boolean => {
    if (normalizedSearch.length === 0) {
      return true;
    }
    const haystack = [
      pubkey,
      props.getSearchHaystack?.(pubkey) ?? "",
    ].join(" ").toLowerCase();
    return haystack.includes(normalizedSearch);
  }, [normalizedSearch, props.getSearchHaystack]);

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

  React.useEffect(() => {
    setEveryonePage(1);
  }, [normalizedSearch, props.visiblePubkeys.length]);

  if (!props.open) {
    return null;
  }

  return (
    <div
      className="fixed inset-0 z-[140] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4"
      onClick={props.onClose}
    >
      <div
        className="w-full max-w-2xl overflow-hidden rounded-[28px] border border-black/10 bg-white/95 shadow-2xl dark:border-white/10 dark:bg-[#0C0C0E]"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4 border-b border-black/10 p-6 dark:border-white/10">
          <div className="min-w-0 flex-1">
            <h3 className="text-xl font-black text-zinc-900 dark:text-white">
              {t("groups.home.findInCommunity.title")}
            </h3>
            <p className="mt-1 text-xs font-medium leading-snug text-zinc-600 dark:text-zinc-400">
              {t("groups.home.findInCommunity.subtitle")}
            </p>
            {contactCoverage.notInContactsCount > 0 ? (
              <p className="mt-2 text-xs font-medium leading-snug text-amber-800/90 dark:text-amber-200/90">
                {t("groups.home.participantsModal.notInContactsSummary", {
                  count: contactCoverage.notInContactsCount,
                })}
              </p>
            ) : null}
          </div>
          <div className="flex shrink-0 items-start gap-2">
            {filteredTerminal.length > 0 && props.onClearTerminalConfirmed ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                title={t("groups.membershipEvidence.clearTerminalDetail")}
                onClick={() => setIsClearTerminalOpen(true)}
                className="h-9 gap-1.5 rounded-xl border-rose-500/30 px-3 text-[10px] font-black uppercase tracking-widest text-rose-700 hover:bg-rose-500/10 dark:border-rose-500/35 dark:text-rose-300 dark:hover:bg-rose-500/15"
              >
                <Trash2 className="h-3.5 w-3.5" />
                {t("groups.membershipEvidence.clearTerminal")}
              </Button>
            ) : null}
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-9 w-9 shrink-0 text-zinc-600 hover:bg-black/[0.06] hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-white/5 dark:hover:text-white"
              onClick={props.onClose}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>

        <div className="border-b border-black/10 p-6 dark:border-white/10">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
            <Input
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder={t("groups.home.findInCommunity.searchPlaceholder")}
              className="h-11 rounded-xl border-black/10 bg-black/[0.04] pl-10 text-zinc-900 placeholder:text-zinc-500 focus:border-emerald-400/40 focus:ring-emerald-400/25 dark:border-white/10 dark:bg-white/[0.03] dark:text-zinc-100 dark:placeholder:text-zinc-500"
            />
          </div>
        </div>

        <div className="max-h-[70vh] space-y-5 overflow-y-auto p-6">
          <FindSection
            title={t("groups.home.findInCommunity.recentInChat")}
            empty={t("groups.home.findInCommunity.noRecentInChat")}
            pubkeys={sections.recentInChat}
            renderRow={(pubkey) => (
              <FindMemberRow
                key={`recent-${pubkey}`}
                pubkey={pubkey}
                evidenceTier={resolveCommunityMemberEvidenceTier(pubkey, {
                  activeMemberPubkeys: props.activeMemberPubkeys,
                  provisionalMemberPubkeys: props.provisionalMemberPubkeys,
                })}
                inContacts={isCommunityParticipantInContacts(
                  pubkey,
                  props.acceptedPeers,
                  props.selfPubkey,
                )}
                showContactStatus={!props.selfPubkey || pubkey.trim().toLowerCase() !== props.selfPubkey.trim().toLowerCase()}
                online={props.isPeerOnline?.(pubkey as PublicKeyHex) === true}
                membershipEvidenceUiContext={props.membershipEvidenceUiContext}
                onOpenProfile={props.onOpenProfile}
              />
            )}
          />

          <FindSection
            title={t("groups.home.findInCommunity.connectionsHere")}
            empty={t("groups.home.findInCommunity.noConnectionsHere")}
            pubkeys={sections.connectionsHere}
            renderRow={(pubkey) => (
              <FindMemberRow
                key={`conn-${pubkey}`}
                pubkey={pubkey}
                evidenceTier={resolveCommunityMemberEvidenceTier(pubkey, {
                  activeMemberPubkeys: props.activeMemberPubkeys,
                  provisionalMemberPubkeys: props.provisionalMemberPubkeys,
                })}
                inContacts
                showContactStatus={false}
                online={props.isPeerOnline?.(pubkey as PublicKeyHex) === true}
                membershipEvidenceUiContext={props.membershipEvidenceUiContext}
                onOpenProfile={props.onOpenProfile}
              />
            )}
          />

          <FindSection
            title={t("groups.home.findInCommunity.everyoneElse")}
            empty={t("groups.home.findInCommunity.noEveryoneElse")}
            pubkeys={pagedEveryone}
            renderRow={(pubkey) => (
              <FindMemberRow
                key={`else-${pubkey}`}
                pubkey={pubkey}
                evidenceTier={resolveCommunityMemberEvidenceTier(pubkey, {
                  activeMemberPubkeys: props.activeMemberPubkeys,
                  provisionalMemberPubkeys: props.provisionalMemberPubkeys,
                })}
                inContacts={isCommunityParticipantInContacts(
                  pubkey,
                  props.acceptedPeers,
                  props.selfPubkey,
                )}
                showContactStatus={!props.selfPubkey || pubkey.trim().toLowerCase() !== props.selfPubkey.trim().toLowerCase()}
                online={props.isPeerOnline?.(pubkey as PublicKeyHex) === true}
                membershipEvidenceUiContext={props.membershipEvidenceUiContext}
                onOpenProfile={props.onOpenProfile}
              />
            )}
          />

          {sections.everyoneElse.length > PAGE_SIZE ? (
            <div className="flex items-center justify-between px-1">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setEveryonePage((page) => Math.max(1, page - 1))}
                disabled={everyonePage <= 1}
                className="h-8 rounded-lg border border-black/10 bg-black/[0.04] px-3 text-zinc-600 hover:text-zinc-900 disabled:opacity-40 dark:border-white/10 dark:bg-white/[0.04] dark:text-zinc-300 dark:hover:text-white"
              >
                <ChevronLeft className="mr-1 h-3.5 w-3.5" />
                {t("groups.home.participantsModal.prev")}
              </Button>
              <p className="text-[10px] font-black uppercase tracking-widest text-zinc-500 dark:text-zinc-400">
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
                className="h-8 rounded-lg border border-black/10 bg-black/[0.04] px-3 text-zinc-600 hover:text-zinc-900 disabled:opacity-40 dark:border-white/10 dark:bg-white/[0.04] dark:text-zinc-300 dark:hover:text-white"
              >
                {t("groups.home.participantsModal.next")}
                <ChevronRight className="ml-1 h-3.5 w-3.5" />
              </Button>
            </div>
          ) : null}

          {filteredTerminal.length > 0 ? (
            <div className="space-y-3 rounded-2xl border border-zinc-400/20 bg-zinc-500/[0.04] p-3">
              <h4 className="px-1 text-xs font-black uppercase tracking-widest text-zinc-600 dark:text-zinc-400">
                {t("groups.home.findInCommunity.terminal")}
              </h4>
              {filteredTerminal.map((entry) => (
                <TerminalRow
                  key={`terminal-${entry.kind}-${entry.pubkey}`}
                  pubkey={entry.pubkey}
                  terminalKind={entry.kind}
                  membershipEvidenceUiContext={props.membershipEvidenceUiContext}
                  onOpenProfile={props.onOpenProfile}
                />
              ))}
            </div>
          ) : null}
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

function FindSection(props: Readonly<{
  title: string;
  empty: string;
  pubkeys: ReadonlyArray<string>;
  renderRow: (pubkey: string) => React.ReactNode;
}>): React.JSX.Element {
  return (
    <div className="space-y-3 rounded-2xl border border-black/10 bg-black/[0.02] p-3 dark:border-white/10 dark:bg-white/[0.02]">
      <h4 className="px-1 text-xs font-black uppercase tracking-widest text-zinc-700 dark:text-zinc-300">
        {props.title}
      </h4>
      {props.pubkeys.length === 0 ? (
        <p className="px-1 py-2 text-xs text-zinc-600 dark:text-zinc-500">{props.empty}</p>
      ) : (
        props.pubkeys.map((pubkey) => props.renderRow(pubkey))
      )}
    </div>
  );
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

  return (
    <button
      type="button"
      onClick={() => props.onOpenProfile(props.pubkey)}
      className="group w-full rounded-2xl border border-black/10 bg-gradient-to-r from-zinc-500/[0.08] via-transparent to-transparent p-3 text-left transition-all hover:border-black/20 dark:border-white/10 dark:from-white/[0.06] dark:hover:border-white/20"
    >
      <div className="flex items-center gap-3">
        <UserAvatar
          pubkey={props.pubkey}
          size="sm"
          showProfileOnClick={false}
          className="rounded-xl border border-black/10 dark:border-white/10"
        />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="truncate text-sm font-black text-zinc-900 dark:text-zinc-100">{displayName}</p>
            <CommunityMembershipEvidenceChip
              tier={props.evidenceTier}
              uiContext={props.membershipEvidenceUiContext}
            />
            {props.showContactStatus && !props.inContacts ? (
              <span className="shrink-0 rounded-full border border-amber-500/30 bg-amber-500/10 px-2 py-0.5 text-[9px] font-black uppercase tracking-widest text-amber-800 dark:text-amber-200">
                {t("groups.home.participantsModal.notInContactsBadge")}
              </span>
            ) : null}
            {props.online ? (
              <span className="shrink-0 rounded-full bg-emerald-500/15 px-2 py-0.5 text-[9px] font-black uppercase tracking-widest text-emerald-700 dark:text-emerald-200">
                {t("groups.home.findInCommunity.onlineHere")}
              </span>
            ) : null}
          </div>
          <p className="mt-0.5 truncate text-[10px] uppercase tracking-[0.14em] text-zinc-600 dark:text-zinc-400">
            {metadata.isDeleted
              ? t("groups.home.memberStatus.profileUnavailable")
              : t("groups.home.memberStatus.identityHidden")}
          </p>
        </div>
        <ChevronRight className={cn("h-4 w-4 text-zinc-500")} />
      </div>
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
    <button
      type="button"
      onClick={() => props.onOpenProfile(props.pubkey)}
      className="group w-full rounded-2xl border border-zinc-400/30 bg-gradient-to-r from-zinc-500/[0.12] via-zinc-500/[0.05] to-transparent p-3 text-left transition-all hover:border-zinc-400/45"
    >
      <div className="flex items-center gap-3">
        <UserAvatar
          pubkey={props.pubkey}
          size="sm"
          showProfileOnClick={false}
          className="rounded-xl border border-black/10 opacity-80 dark:border-white/10"
        />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="truncate text-sm font-black text-zinc-800 dark:text-zinc-200">{displayName}</p>
            <CommunityMembershipEvidenceChip tier="terminal" uiContext={props.membershipEvidenceUiContext} />
            <span className="shrink-0 rounded-full bg-zinc-500/20 px-2 py-0.5 text-[9px] font-black uppercase tracking-widest text-zinc-700 dark:text-zinc-300">
              {kindLabel}
            </span>
          </div>
        </div>
        <ChevronRight className="h-4 w-4 text-zinc-500" />
      </div>
    </button>
  );
}
