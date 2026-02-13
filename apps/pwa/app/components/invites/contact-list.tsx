"use client";

import React, { useState, useEffect, useCallback } from "react";
import Image from "next/image";
import { contactStore } from "@/app/features/invites/utils/contact-store";
import type { Contact, ContactGroup, TrustLevel } from "@/app/features/invites/utils/types";
import { Button } from "../ui/button";
import { Card } from "../ui/card";
import { Input } from "../ui/input";
import { Label } from "../ui/label";

type ContactListState =
  | { status: "loading" }
  | { status: "loaded"; contacts: Contact[]; groups: ContactGroup[] }
  | { status: "error"; error: string };

export const ContactList = () => {
  const [state, setState] = useState<ContactListState>({ status: "loading" });
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedTrustLevel, setSelectedTrustLevel] = useState<TrustLevel | "all">("all");
  const [selectedGroup, setSelectedGroup] = useState<string | "all">("all");
  const [selectedContact, setSelectedContact] = useState<Contact | null>(null);
  const [showGroupManager, setShowGroupManager] = useState(false);

  const loadData = async () => {
    try {
      const [contacts, groups] = await Promise.all([
        contactStore.getAllContacts(),
        contactStore.getAllGroups()
      ]);
      setState({ status: "loaded", contacts, groups });
    } catch (error) {
      setState({
        status: "error",
        error: error instanceof Error ? error.message : "Failed to load contacts"
      });
    }
  };

  useEffect(() => {
    void loadData();
  }, []);

  const handleSearch = useCallback(async () => {
    if (state.status !== "loaded") return;

    try {
      let filteredContacts: Contact[];

      if (searchQuery.trim()) {
        filteredContacts = await contactStore.searchContacts(searchQuery);
      } else {
        filteredContacts = await contactStore.getAllContacts();
      }

      // Apply trust level filter
      if (selectedTrustLevel !== "all") {
        filteredContacts = filteredContacts.filter(c => c.trustLevel === selectedTrustLevel);
      }

      // Apply group filter
      if (selectedGroup !== "all") {
        filteredContacts = filteredContacts.filter(c => c.groups.includes(selectedGroup));
      }

      setState(prev => prev.status === "loaded" ? { ...prev, contacts: filteredContacts } : prev);
    } catch (error) {
      console.error("Search failed:", error);
    }
  }, [searchQuery, selectedTrustLevel, selectedGroup, state.status]);

  useEffect(() => {
    void handleSearch();
  }, [handleSearch]);

  const handleTrustLevelChange = async (contactId: string, newLevel: TrustLevel) => {
    try {
      await contactStore.setTrustLevel(contactId, newLevel);
      await loadData();
    } catch (error) {
      console.error("Failed to update trust level:", error);
    }
  };

  const handleRemoveContact = async (contactId: string) => {
    if (!confirm("Are you sure you want to remove this contact?")) return;

    try {
      await contactStore.removeContact(contactId);
      setSelectedContact(null);
      await loadData();
    } catch (error) {
      console.error("Failed to remove contact:", error);
    }
  };

  if (state.status === "loading") {
    return (
      <Card title="Contacts" description="Manage your contacts and groups">
        <div className="text-sm text-zinc-600 dark:text-zinc-400">Loading...</div>
      </Card>
    );
  }

  if (state.status === "error") {
    return (
      <Card title="Contacts" description="Manage your contacts and groups" tone="danger">
        <div className="text-sm">{state.error}</div>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <Card title="Contacts" description="Manage your contacts and groups">
        {/* Search and Filters */}
        <div className="space-y-3">
          <div>
            <Label htmlFor="search">Search Contacts</Label>
            <Input
              id="search"
              type="text"
              placeholder="Search by name, bio, or public key..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="mt-1"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="trustLevel">Trust Level</Label>
              <select
                id="trustLevel"
                value={selectedTrustLevel}
                onChange={(e) => setSelectedTrustLevel(e.target.value as TrustLevel | "all")}
                className="mt-1 w-full min-h-10 rounded-xl border px-3 py-2 text-sm border-black/10 bg-gradient-card text-zinc-900 dark:border-white/10 dark:text-zinc-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400/50"
              >
                <option value="all">All</option>
                <option value="trusted">Trusted</option>
                <option value="neutral">Neutral</option>
                <option value="blocked">Blocked</option>
              </select>
            </div>

            <div>
              <Label htmlFor="group">Group</Label>
              <select
                id="group"
                value={selectedGroup}
                onChange={(e) => setSelectedGroup(e.target.value)}
                className="mt-1 w-full min-h-10 rounded-xl border px-3 py-2 text-sm border-black/10 bg-gradient-card text-zinc-900 dark:border-white/10 dark:text-zinc-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400/50"
              >
                <option value="all">All Groups</option>
                {state.groups.map((group) => (
                  <option key={group.id} value={group.id}>
                    {group.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <Button
            onClick={() => setShowGroupManager(!showGroupManager)}
            variant="secondary"
            className="w-full"
          >
            {showGroupManager ? "Hide" : "Manage"} Groups
          </Button>
        </div>

        {/* Contact List */}
        <div className="mt-4 space-y-2">
          {state.contacts.length === 0 ? (
            <div className="text-sm text-zinc-600 dark:text-zinc-400 text-center py-8">
              No contacts found
            </div>
          ) : (
            state.contacts.map((contact) => (
              <div
                key={contact.id}
                className="rounded-xl border border-black/10 bg-white p-3 dark:border-white/10 dark:bg-zinc-950/60 cursor-pointer hover:bg-zinc-50 dark:hover:bg-zinc-900/80 transition-colors"
                onClick={() => setSelectedContact(contact)}
              >
                <div className="flex items-start gap-3">
                  {contact.avatar ? (
                    <Image
                      src={contact.avatar}
                      alt={contact.displayName}
                      width={40}
                      height={40}
                      unoptimized
                      className="h-10 w-10 rounded-full object-cover"
                    />
                  ) : (
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-zinc-200 dark:bg-zinc-800">
                      <span className="text-sm font-medium text-zinc-600 dark:text-zinc-400">
                        {contact.displayName[0].toUpperCase()}
                      </span>
                    </div>
                  )}

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <div className="font-medium text-sm text-zinc-900 dark:text-zinc-100">
                        {contact.displayName}
                      </div>
                      <span
                        className={`text-xs px-2 py-0.5 rounded-full ${contact.trustLevel === "trusted"
                          ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300"
                          : contact.trustLevel === "blocked"
                            ? "bg-red-100 text-red-700 dark:bg-red-950/50 dark:text-red-300"
                            : "bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300"
                          }`}
                      >
                        {contact.trustLevel}
                      </span>
                    </div>
                    {contact.bio && (
                      <div className="mt-1 text-xs text-zinc-600 dark:text-zinc-400 truncate">
                        {contact.bio}
                      </div>
                    )}
                    {contact.groups.length > 0 && (
                      <div className="mt-1 flex flex-wrap gap-1">
                        {contact.groups.map((groupId) => {
                          const group = state.groups.find((g) => g.id === groupId);
                          return group ? (
                            <span
                              key={groupId}
                              className="text-xs px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 dark:bg-blue-950/50 dark:text-blue-300"
                            >
                              {group.name}
                            </span>
                          ) : null;
                        })}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </Card>

      {/* Group Manager */}
      {showGroupManager && (
        <GroupManager
          groups={state.groups}
          onUpdate={loadData}
          onClose={() => setShowGroupManager(false)}
        />
      )}

      {/* Contact Details */}
      {selectedContact && (
        <ContactDetails
          contact={selectedContact}
          groups={state.groups}
          onTrustLevelChange={handleTrustLevelChange}
          onRemove={handleRemoveContact}
          onUpdate={loadData}
          onClose={() => setSelectedContact(null)}
        />
      )}
    </div>
  );
};

// Group Manager Component
const GroupManager = ({
  groups,
  onUpdate,
  onClose
}: {
  groups: ContactGroup[];
  onUpdate: () => Promise<void>;
  onClose: () => void;
}) => {
  const [newGroupName, setNewGroupName] = useState("");
  const [newGroupDescription, setNewGroupDescription] = useState("");
  const [isCreating, setIsCreating] = useState(false);

  const handleCreateGroup = async () => {
    if (!newGroupName.trim()) return;

    setIsCreating(true);
    try {
      const newGroup: ContactGroup = {
        id: crypto.randomUUID(),
        name: newGroupName.trim(),
        description: newGroupDescription.trim() || undefined,
        createdAt: new Date()
      };

      await contactStore.createGroup(newGroup);
      setNewGroupName("");
      setNewGroupDescription("");
      await onUpdate();
    } catch (error) {
      console.error("Failed to create group:", error);
    } finally {
      setIsCreating(false);
    }
  };

  const handleDeleteGroup = async (groupId: string) => {
    if (!confirm("Are you sure you want to delete this group? Contacts will not be removed.")) return;

    try {
      await contactStore.deleteGroup(groupId);
      await onUpdate();
    } catch (error) {
      console.error("Failed to delete group:", error);
    }
  };

  return (
    <Card title="Manage Groups" description="Create and manage contact groups">
      <div className="space-y-4">
        {/* Create New Group */}
        <div className="space-y-2">
          <div>
            <Label htmlFor="groupName">Group Name</Label>
            <Input
              id="groupName"
              type="text"
              placeholder="e.g., Family, Work, Friends"
              value={newGroupName}
              onChange={(e) => setNewGroupName(e.target.value)}
              className="mt-1"
            />
          </div>
          <div>
            <Label htmlFor="groupDescription">Description (optional)</Label>
            <Input
              id="groupDescription"
              type="text"
              placeholder="Brief description of this group"
              value={newGroupDescription}
              onChange={(e) => setNewGroupDescription(e.target.value)}
              className="mt-1"
            />
          </div>
          <Button
            onClick={handleCreateGroup}
            disabled={!newGroupName.trim() || isCreating}
            className="w-full"
          >
            {isCreating ? "Creating..." : "Create Group"}
          </Button>
        </div>

        {/* Existing Groups */}
        <div className="space-y-2">
          <div className="text-xs font-medium text-zinc-700 dark:text-zinc-300">
            Existing Groups ({groups.length})
          </div>
          {groups.length === 0 ? (
            <div className="text-sm text-zinc-600 dark:text-zinc-400 text-center py-4">
              No groups yet. Create one above!
            </div>
          ) : (
            groups.map((group) => (
              <div
                key={group.id}
                className="rounded-xl border border-black/10 bg-white p-3 dark:border-white/10 dark:bg-zinc-950/60"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-sm text-zinc-900 dark:text-zinc-100">
                      {group.name}
                    </div>
                    {group.description && (
                      <div className="mt-1 text-xs text-zinc-600 dark:text-zinc-400">
                        {group.description}
                      </div>
                    )}
                    <div className="mt-1 text-xs text-zinc-500 dark:text-zinc-500">
                      Created {group.createdAt.toLocaleDateString()}
                    </div>
                  </div>
                  <Button
                    onClick={() => handleDeleteGroup(group.id)}
                    variant="danger"
                    className="text-xs px-3 py-1 min-h-8"
                  >
                    Delete
                  </Button>
                </div>
              </div>
            ))
          )}
        </div>

        <Button onClick={onClose} variant="secondary" className="w-full">
          Close
        </Button>
      </div>
    </Card>
  );
};

// Contact Details Component
const ContactDetails = ({
  contact,
  groups,
  onTrustLevelChange,
  onRemove,
  onUpdate,
  onClose
}: {
  contact: Contact;
  groups: ContactGroup[];
  onTrustLevelChange: (contactId: string, newLevel: TrustLevel) => Promise<void>;
  onRemove: (contactId: string) => Promise<void>;
  onUpdate: () => Promise<void>;
  onClose: () => void;
}) => {
  const [selectedGroups, setSelectedGroups] = useState<Set<string>>(new Set(contact.groups));
  const [isUpdating, setIsUpdating] = useState(false);

  const handleGroupToggle = (groupId: string) => {
    const newSelected = new Set(selectedGroups);
    if (newSelected.has(groupId)) {
      newSelected.delete(groupId);
    } else {
      newSelected.add(groupId);
    }
    setSelectedGroups(newSelected);
  };

  const handleSaveGroups = async () => {
    setIsUpdating(true);
    try {
      // Remove from groups no longer selected
      const groupsToRemove = contact.groups.filter(g => !selectedGroups.has(g));
      for (const groupId of groupsToRemove) {
        await contactStore.removeContactFromGroup(contact.id, groupId);
      }

      // Add to newly selected groups
      const groupsToAdd = Array.from(selectedGroups).filter(g => !contact.groups.includes(g));
      for (const groupId of groupsToAdd) {
        await contactStore.addContactToGroup(contact.id, groupId);
      }

      await onUpdate();
      onClose();
    } catch (error) {
      console.error("Failed to update groups:", error);
    } finally {
      setIsUpdating(false);
    }
  };

  return (
    <Card title="Contact Details" description="View and manage contact information">
      <div className="space-y-4">
        {/* Contact Info */}
        <div className="flex items-start gap-3">
          {contact.avatar ? (
            <Image
              src={contact.avatar}
              alt={contact.displayName}
              width={64}
              height={64}
              unoptimized
              className="h-16 w-16 rounded-full object-cover"
            />
          ) : (
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-zinc-200 dark:bg-zinc-800">
              <span className="text-2xl font-medium text-zinc-600 dark:text-zinc-400">
                {contact.displayName[0].toUpperCase()}
              </span>
            </div>
          )}

          <div className="flex-1 min-w-0">
            <div className="font-medium text-lg text-zinc-900 dark:text-zinc-100">
              {contact.displayName}
            </div>
            {contact.bio && (
              <div className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
                {contact.bio}
              </div>
            )}
            <div className="mt-2 font-mono text-xs text-zinc-500 dark:text-zinc-500 break-all">
              {contact.publicKey}
            </div>
          </div>
        </div>

        {/* Trust Level */}
        <div>
          <Label htmlFor="trustLevel">Trust Level</Label>
          <select
            id="trustLevel"
            value={contact.trustLevel}
            onChange={(e) => onTrustLevelChange(contact.id, e.target.value as TrustLevel)}
            className="mt-1 w-full min-h-10 rounded-xl border px-3 py-2 text-sm border-black/10 bg-gradient-card text-zinc-900 dark:border-white/10 dark:text-zinc-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400/50"
          >
            <option value="trusted">Trusted</option>
            <option value="neutral">Neutral</option>
            <option value="blocked">Blocked</option>
          </select>
        </div>

        {/* Groups */}
        <div>
          <Label>Groups</Label>
          <div className="mt-2 space-y-2">
            {groups.length === 0 ? (
              <div className="text-sm text-zinc-600 dark:text-zinc-400">
                No groups available. Create groups to organize contacts.
              </div>
            ) : (
              groups.map((group) => (
                <label
                  key={group.id}
                  className="flex items-center gap-2 cursor-pointer"
                >
                  <input
                    type="checkbox"
                    checked={selectedGroups.has(group.id)}
                    onChange={() => handleGroupToggle(group.id)}
                    className="rounded border-zinc-300 dark:border-zinc-700"
                  />
                  <span className="text-sm text-zinc-900 dark:text-zinc-100">
                    {group.name}
                  </span>
                </label>
              ))
            )}
          </div>
        </div>

        {/* Metadata */}
        <div className="text-xs text-zinc-600 dark:text-zinc-400 space-y-1">
          <div>
            <span className="font-medium">Added:</span> {contact.addedAt.toLocaleString()}
          </div>
          {contact.lastSeen && (
            <div>
              <span className="font-medium">Last Seen:</span> {contact.lastSeen.toLocaleString()}
            </div>
          )}
          <div>
            <span className="font-medium">Source:</span> {contact.metadata.source}
          </div>
          {contact.metadata.notes && (
            <div>
              <span className="font-medium">Notes:</span> {contact.metadata.notes}
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex gap-2">
          <Button
            onClick={handleSaveGroups}
            disabled={isUpdating}
            className="flex-1"
          >
            {isUpdating ? "Saving..." : "Save Changes"}
          </Button>
          <Button
            onClick={() => onRemove(contact.id)}
            variant="danger"
            className="flex-1"
          >
            Remove Contact
          </Button>
        </div>

        <Button onClick={onClose} variant="secondary" className="w-full">
          Close
        </Button>
      </div>
    </Card>
  );
};
