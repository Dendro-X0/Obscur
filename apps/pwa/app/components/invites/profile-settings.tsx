"use client";

import React, { useState, useEffect } from "react";
import Image from "next/image";
import { profileManager } from "@/app/features/invites/utils/profile-manager";
import type { UserProfile, PrivacySettings } from "@/app/features/invites/utils/types";
import { Button } from "../ui/button";
import { Card } from "../ui/card";
import { Input } from "../ui/input";
import { Label } from "../ui/label";

type ProfileState =
  | { status: "loading" }
  | { status: "loaded"; profile: UserProfile; privacy: PrivacySettings }
  | { status: "error"; error: string };

export const ProfileSettings = () => {
  const [state, setState] = useState<ProfileState>({ status: "loading" });
  const [isSaving, setIsSaving] = useState(false);
  const [activeTab, setActiveTab] = useState<"profile" | "privacy">("profile");

  // Profile form state
  const [displayName, setDisplayName] = useState("");
  const [avatar, setAvatar] = useState("");
  const [bio, setBio] = useState("");
  const [website, setWebsite] = useState("");
  const [nip05, setNip05] = useState("");
  const [lud16, setLud16] = useState("");

  // Privacy form state
  const [shareDisplayName, setShareDisplayName] = useState(true);
  const [shareAvatar, setShareAvatar] = useState(true);
  const [shareBio, setShareBio] = useState(false);
  const [shareWebsite, setShareWebsite] = useState(false);
  const [allowContactRequests, setAllowContactRequests] = useState(true);
  const [requireMessage, setRequireMessage] = useState(false);
  const [autoAcceptTrusted, setAutoAcceptTrusted] = useState(false);

  const loadData = async () => {
    try {
      const [profile, privacy] = await Promise.all([
        profileManager.getProfile(),
        profileManager.getPrivacySettings()
      ]);

      // Set profile form state
      setDisplayName(profile.displayName || "");
      setAvatar(profile.avatar || "");
      setBio(profile.bio || "");
      setWebsite(profile.website || "");
      setNip05(profile.nip05 || "");
      setLud16(profile.lud16 || "");

      // Set privacy form state
      setShareDisplayName(privacy.shareDisplayName);
      setShareAvatar(privacy.shareAvatar);
      setShareBio(privacy.shareBio);
      setShareWebsite(privacy.shareWebsite);
      setAllowContactRequests(privacy.allowContactRequests);
      setRequireMessage(privacy.requireMessage);
      setAutoAcceptTrusted(privacy.autoAcceptTrusted);

      setState({ status: "loaded", profile, privacy });
    } catch (error) {
      setState({
        status: "error",
        error: error instanceof Error ? error.message : "Failed to load profile"
      });
    }
  };

  useEffect(() => {
    void loadData();
  }, []);

  const handleSaveProfile = async () => {
    setIsSaving(true);
    try {
      const updatedProfile: UserProfile = {
        displayName: displayName.trim(),
        avatar: avatar.trim() || undefined,
        bio: bio.trim() || undefined,
        website: website.trim() || undefined,
        nip05: nip05.trim() || undefined,
        lud16: lud16.trim() || undefined
      };

      await profileManager.updateProfile(updatedProfile);
      await loadData();
      // TODO: Show success toast
    } catch (error) {
      console.error("Failed to save profile:", error);
      // TODO: Show error toast
    } finally {
      setIsSaving(false);
    }
  };

  const handleSavePrivacy = async () => {
    setIsSaving(true);
    try {
      const updatedPrivacy: PrivacySettings = {
        shareDisplayName,
        shareAvatar,
        shareBio,
        shareWebsite,
        allowContactRequests,
        requireMessage,
        autoAcceptTrusted
      };

      await profileManager.updatePrivacySettings(updatedPrivacy);
      await loadData();
      // TODO: Show success toast
    } catch (error) {
      console.error("Failed to save privacy settings:", error);
      // TODO: Show error toast
    } finally {
      setIsSaving(false);
    }
  };

  if (state.status === "loading") {
    return (
      <Card title="Profile Settings" description="Manage your profile and privacy settings">
        <div className="text-sm text-zinc-600 dark:text-zinc-400">Loading...</div>
      </Card>
    );
  }

  if (state.status === "error") {
    return (
      <Card title="Profile Settings" description="Manage your profile and privacy settings" tone="danger">
        <div className="text-sm">{state.error}</div>
      </Card>
    );
  }

  return (
    <Card title="Profile Settings" description="Manage your profile and privacy settings">
      {/* Tabs */}
      <div className="flex gap-2 mb-4">
        <button
          onClick={() => setActiveTab("profile")}
          className={`flex-1 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${activeTab === "profile"
              ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900"
              : "bg-zinc-100 text-zinc-900 dark:bg-zinc-800 dark:text-zinc-100 hover:bg-zinc-200 dark:hover:bg-zinc-700"
            }`}
        >
          Profile
        </button>
        <button
          onClick={() => setActiveTab("privacy")}
          className={`flex-1 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${activeTab === "privacy"
              ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900"
              : "bg-zinc-100 text-zinc-900 dark:bg-zinc-800 dark:text-zinc-100 hover:bg-zinc-200 dark:hover:bg-zinc-700"
            }`}
        >
          Privacy
        </button>
      </div>

      {/* Profile Tab */}
      {activeTab === "profile" && (
        <div className="space-y-4">
          <div>
            <Label htmlFor="displayName">Display Name *</Label>
            <Input
              id="displayName"
              type="text"
              placeholder="Your display name"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              maxLength={100}
              className="mt-1"
            />
            <div className="mt-1 text-xs text-zinc-500 dark:text-zinc-500">
              {displayName.length}/100 characters
            </div>
          </div>

          <div>
            <Label htmlFor="avatar">Avatar URL</Label>
            <Input
              id="avatar"
              type="url"
              placeholder="https://example.com/avatar.jpg"
              value={avatar}
              onChange={(e) => setAvatar(e.target.value)}
              maxLength={500}
              className="mt-1"
            />
            {avatar && (
              <div className="mt-2 flex items-center gap-2">
                <Image
                  src={avatar}
                  alt="Avatar preview"
                  width={48}
                  height={48}
                  className="h-12 w-12 rounded-full object-cover"
                  unoptimized
                  onError={(e) => {
                    (e.currentTarget as HTMLImageElement).style.display = "none";
                  }}
                />
                <span className="text-xs text-zinc-500 dark:text-zinc-400">Preview</span>
              </div>
            )}
          </div>

          <div>
            <Label htmlFor="bio">Bio</Label>
            <textarea
              id="bio"
              placeholder="Tell others about yourself..."
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              maxLength={500}
              rows={3}
              className="mt-1 w-full rounded-xl border px-3 py-2 text-sm border-black/10 bg-gradient-card text-zinc-900 placeholder:text-zinc-400 dark:border-white/10 dark:text-zinc-100 dark:placeholder:text-zinc-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400/50 focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:focus-visible:ring-offset-black"
            />
            <div className="mt-1 text-xs text-zinc-500 dark:text-zinc-500">
              {bio.length}/500 characters
            </div>
          </div>

          <div>
            <Label htmlFor="website">Website</Label>
            <Input
              id="website"
              type="url"
              placeholder="https://yourwebsite.com"
              value={website}
              onChange={(e) => setWebsite(e.target.value)}
              maxLength={200}
              className="mt-1"
            />
          </div>

          <div>
            <Label htmlFor="nip05">NIP-05 Identifier</Label>
            <Input
              id="nip05"
              type="text"
              placeholder="name@domain.com"
              value={nip05}
              onChange={(e) => setNip05(e.target.value)}
              maxLength={100}
              className="mt-1"
            />
            <div className="mt-1 text-xs text-zinc-500 dark:text-zinc-500">
              Nostr verification identifier
            </div>
          </div>

          <div>
            <Label htmlFor="lud16">Lightning Address</Label>
            <Input
              id="lud16"
              type="text"
              placeholder="name@wallet.com"
              value={lud16}
              onChange={(e) => setLud16(e.target.value)}
              maxLength={100}
              className="mt-1"
            />
            <div className="mt-1 text-xs text-zinc-500 dark:text-zinc-500">
              For receiving Bitcoin Lightning payments
            </div>
          </div>

          <Button
            onClick={handleSaveProfile}
            disabled={!displayName.trim() || isSaving}
            className="w-full"
          >
            {isSaving ? "Saving..." : "Save Profile"}
          </Button>
        </div>
      )}

      {/* Privacy Tab */}
      {activeTab === "privacy" && (
        <div className="space-y-4">
          <div className="space-y-3">
            <div className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
              Profile Sharing
            </div>
            <div className="text-xs text-zinc-600 dark:text-zinc-400">
              Control what information is shared when you create invites
            </div>

            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={shareDisplayName}
                onChange={(e) => setShareDisplayName(e.target.checked)}
                className="rounded border-zinc-300 dark:border-zinc-700"
              />
              <div className="flex-1">
                <div className="text-sm text-zinc-900 dark:text-zinc-100">
                  Share Display Name
                </div>
                <div className="text-xs text-zinc-600 dark:text-zinc-400">
                  Include your display name in invites
                </div>
              </div>
            </label>

            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={shareAvatar}
                onChange={(e) => setShareAvatar(e.target.checked)}
                className="rounded border-zinc-300 dark:border-zinc-700"
              />
              <div className="flex-1">
                <div className="text-sm text-zinc-900 dark:text-zinc-100">
                  Share Avatar
                </div>
                <div className="text-xs text-zinc-600 dark:text-zinc-400">
                  Include your avatar image in invites
                </div>
              </div>
            </label>

            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={shareBio}
                onChange={(e) => setShareBio(e.target.checked)}
                className="rounded border-zinc-300 dark:border-zinc-700"
              />
              <div className="flex-1">
                <div className="text-sm text-zinc-900 dark:text-zinc-100">
                  Share Bio
                </div>
                <div className="text-xs text-zinc-600 dark:text-zinc-400">
                  Include your bio in invites
                </div>
              </div>
            </label>

            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={shareWebsite}
                onChange={(e) => setShareWebsite(e.target.checked)}
                className="rounded border-zinc-300 dark:border-zinc-700"
              />
              <div className="flex-1">
                <div className="text-sm text-zinc-900 dark:text-zinc-100">
                  Share Website
                </div>
                <div className="text-xs text-zinc-600 dark:text-zinc-400">
                  Include your website in invites
                </div>
              </div>
            </label>
          </div>

          <div className="border-t border-zinc-200 dark:border-zinc-800 pt-4 space-y-3">
            <div className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
              Contact Request Settings
            </div>
            <div className="text-xs text-zinc-600 dark:text-zinc-400">
              Control how you receive and manage contact requests
            </div>

            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={allowContactRequests}
                onChange={(e) => setAllowContactRequests(e.target.checked)}
                className="rounded border-zinc-300 dark:border-zinc-700"
              />
              <div className="flex-1">
                <div className="text-sm text-zinc-900 dark:text-zinc-100">
                  Allow Contact Requests
                </div>
                <div className="text-xs text-zinc-600 dark:text-zinc-400">
                  Enable others to send you contact requests
                </div>
              </div>
            </label>

            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={requireMessage}
                onChange={(e) => setRequireMessage(e.target.checked)}
                disabled={!allowContactRequests}
                className="rounded border-zinc-300 dark:border-zinc-700 disabled:opacity-50"
              />
              <div className="flex-1">
                <div className="text-sm text-zinc-900 dark:text-zinc-100">
                  Require Message
                </div>
                <div className="text-xs text-zinc-600 dark:text-zinc-400">
                  Require a personal message with contact requests
                </div>
              </div>
            </label>

            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={autoAcceptTrusted}
                onChange={(e) => setAutoAcceptTrusted(e.target.checked)}
                disabled={!allowContactRequests}
                className="rounded border-zinc-300 dark:border-zinc-700 disabled:opacity-50"
              />
              <div className="flex-1">
                <div className="text-sm text-zinc-900 dark:text-zinc-100">
                  Auto-Accept Trusted
                </div>
                <div className="text-xs text-zinc-600 dark:text-zinc-400">
                  Automatically accept requests from trusted contacts
                </div>
              </div>
            </label>
          </div>

          <div className="rounded-lg bg-blue-50 dark:bg-blue-950/20 p-3 text-xs text-blue-900 dark:text-blue-100">
            <div className="font-medium mb-1">Privacy Note</div>
            <div>
              Privacy settings apply to future invites only. Existing connections are not affected.
            </div>
          </div>

          <Button
            onClick={handleSavePrivacy}
            disabled={isSaving}
            className="w-full"
          >
            {isSaving ? "Saving..." : "Save Privacy Settings"}
          </Button>
        </div>
      )}
    </Card>
  );
};
