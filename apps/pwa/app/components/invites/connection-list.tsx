"use client";

import React, { useState, useEffect, useCallback } from "react";
import Image from "next/image";
import { connectionStore } from "@/app/features/invites/utils/connection-store";
import type { Connection, ConnectionGroup, TrustLevel } from "@/app/features/invites/utils/types";
import { useTranslation } from "react-i18next";
import { Button } from "../ui/button";
import { Card } from "../ui/card";
import { Input } from "../ui/input";
import { Label } from "../ui/label";

type ConnectionListState =
  | { status: "loading" }
  | { status: "loaded"; connections: Connection[]; groups: ConnectionGroup[] }
  | { status: "error"; error: string };

export const ConnectionList = () => {
  const { t } = useTranslation();
  const [state, setState] = useState<ConnectionListState>({ status: "loading" });
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedTrustLevel, setSelectedTrustLevel] = useState<TrustLevel | "all">("all");
  const [selectedGroup, setSelectedGroup] = useState<string | "all">("all");
  const [selectedConnection, setSelectedConnection] = useState<Connection | null>(null);
  const [showGroupManager, setShowGroupManager] = useState(false);

  const loadData = async () => {
    try {
      const [connections, groups] = await Promise.all([
        connectionStore.getAllConnections(),
        connectionStore.getAllGroups()
      ]);
      setState({ status: "loaded", connections, groups });
    } catch (error) {
      setState({
        status: "error",
        error: error instanceof Error ? error.message : "Failed to load connections"
      });
    }
  };

  useEffect(() => {
    void loadData();
  }, []);

  const handleSearch = useCallback(async () => {
    if (state.status !== "loaded") return;

    try {
      let filteredConnections: Connection[];

      if (searchQuery.trim()) {
        filteredConnections = await connectionStore.searchConnections(searchQuery);
      } else {
        filteredConnections = await connectionStore.getAllConnections();
      }

      // Apply trust level filter
      if (selectedTrustLevel !== "all") {
        filteredConnections = filteredConnections.filter(c => c.trustLevel === selectedTrustLevel);
      }

      // Apply group filter
      if (selectedGroup !== "all") {
        filteredConnections = filteredConnections.filter(c => c.groups.includes(selectedGroup));
      }

      setState(prev => prev.status === "loaded" ? { ...prev, connections: filteredConnections } : prev);
    } catch (error) {
      console.error("Search failed:", error);
    }
  }, [searchQuery, selectedTrustLevel, selectedGroup, state.status]);

  useEffect(() => {
    void handleSearch();
  }, [handleSearch]);

  const handleTrustLevelChange = async (contactId: string, newLevel: TrustLevel) => {
    try {
      await connectionStore.setTrustLevel(contactId, newLevel);
      await loadData();
    } catch (error) {
      console.error("Failed to update trust level:", error);
    }
  };

  const handleRemoveConnection = async (connectionId: string) => {
    if (!confirm("Are you sure you want to remove this connection?")) return;

    try {
      await connectionStore.removeConnection(connectionId);
      setSelectedConnection(null);
      await loadData();
    } catch (error) {
      console.error("Failed to remove connection:", error);
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
      <Card title={t("nav.network")} description={t("invites.manage")}>
        {/* Search and Filters */}
        <div className="space-y-3">
          <div>
            <Label htmlFor="search">{t("network.searchPlaceholder")}</Label>
            <Input
              id="search"
              type="text"
              placeholder={t("network.searchPlaceholder")}
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

        {/* Connection List */}
        <div className="mt-4 space-y-2">
          {state.connections.length === 0 ? (
            <div className="text-sm text-zinc-600 dark:text-zinc-400 text-center py-8">
              No connections found
            </div>
          ) : (
            state.connections.map((connection) => (
              <div
                key={connection.id}
                className="rounded-xl border border-black/10 bg-white p-3 dark:border-white/10 dark:bg-zinc-950/60 cursor-pointer hover:bg-zinc-50 dark:hover:bg-zinc-900/80 transition-colors"
                onClick={() => setSelectedConnection(connection)}
              >
                <div className="flex items-start gap-3">
                  {connection.avatar ? (
                    <Image
                      src={connection.avatar}
                      alt={connection.displayName}
                      width={40}
                      height={40}
                      unoptimized
                      className="h-10 w-10 rounded-full object-cover"
                    />
                  ) : (
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-zinc-200 dark:bg-zinc-800">
                      <span className="text-sm font-medium text-zinc-600 dark:text-zinc-400">
                        {connection.displayName[0].toUpperCase()}
                      </span>
                    </div>
                  )}

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <div className="font-medium text-sm text-zinc-900 dark:text-zinc-100">
                        {connection.displayName}
                      </div>
                      <span
                        className={`text-xs px-2 py-0.5 rounded-full ${connection.trustLevel === "trusted"
                          ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300"
                          : connection.trustLevel === "blocked"
                            ? "bg-red-100 text-red-700 dark:bg-red-950/50 dark:text-red-300"
                            : "bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300"
                          }`}
                      >
                        {connection.trustLevel}
                      </span>
                    </div>
                    {connection.bio && (
                      <div className="mt-1 text-xs text-zinc-600 dark:text-zinc-400 truncate">
                        {connection.bio}
                      </div>
                    )}
                    {connection.groups.length > 0 && (
                      <div className="mt-1 flex flex-wrap gap-1">
                        {connection.groups.map((groupId) => {
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

      {/* Connection Details */}
      {selectedConnection && (
        <ConnectionDetails
          connection={selectedConnection}
          groups={state.groups}
          onTrustLevelChange={handleTrustLevelChange}
          onRemove={handleRemoveConnection}
          onUpdate={loadData}
          onClose={() => setSelectedConnection(null)}
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
  groups: ConnectionGroup[];
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
      const newGroup: ConnectionGroup = {
        id: crypto.randomUUID(),
        name: newGroupName.trim(),
        description: newGroupDescription.trim() || undefined,
        createdAt: new Date()
      };

      await connectionStore.createGroup(newGroup);
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
      await connectionStore.deleteGroup(groupId);
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

// Connection Details Component
const ConnectionDetails = ({
  connection,
  groups,
  onTrustLevelChange,
  onRemove,
  onUpdate,
  onClose
}: {
  connection: Connection;
  groups: ConnectionGroup[];
  onTrustLevelChange: (connectionId: string, newLevel: TrustLevel) => Promise<void>;
  onRemove: (connectionId: string) => Promise<void>;
  onUpdate: () => Promise<void>;
  onClose: () => void;
}) => {
  const [selectedGroups, setSelectedGroups] = useState<Set<string>>(new Set(connection.groups));
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
      const groupsToRemove = connection.groups.filter(g => !selectedGroups.has(g));
      for (const groupId of groupsToRemove) {
        await connectionStore.removeConnectionFromGroup(connection.id, groupId);
      }

      // Add to newly selected groups
      const groupsToAdd = Array.from(selectedGroups).filter(g => !connection.groups.includes(g));
      for (const groupId of groupsToAdd) {
        await connectionStore.addConnectionToGroup(connection.id, groupId);
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
    <Card title="Connection Details" description="View and manage connection information">
      <div className="space-y-4">
        {/* Connection Info */}
        <div className="flex items-start gap-3">
          {connection.avatar ? (
            <Image
              src={connection.avatar}
              alt={connection.displayName}
              width={64}
              height={64}
              unoptimized
              className="h-16 w-16 rounded-full object-cover"
            />
          ) : (
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-zinc-200 dark:bg-zinc-800">
              <span className="text-2xl font-medium text-zinc-600 dark:text-zinc-400">
                {connection.displayName[0].toUpperCase()}
              </span>
            </div>
          )}

          <div className="flex-1 min-w-0">
            <div className="font-medium text-lg text-zinc-900 dark:text-zinc-100">
              {connection.displayName}
            </div>
            {connection.bio && (
              <div className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
                {connection.bio}
              </div>
            )}
            <div className="mt-2 font-mono text-xs text-zinc-500 dark:text-zinc-500 break-all">
              {connection.publicKey}
            </div>
          </div>
        </div>

        {/* Trust Level */}
        <div>
          <Label htmlFor="trustLevel">Trust Level</Label>
          <select
            id="trustLevel"
            value={connection.trustLevel}
            onChange={(e) => onTrustLevelChange(connection.id, e.target.value as TrustLevel)}
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
            <span className="font-medium">Added:</span> {connection.addedAt.toLocaleString()}
          </div>
          {connection.lastSeen && (
            <div>
              <span className="font-medium">Last Seen:</span> {connection.lastSeen.toLocaleString()}
            </div>
          )}
          <div>
            <span className="font-medium">Source:</span> {connection.metadata.source}
          </div>
          {connection.metadata.notes && (
            <div>
              <span className="font-medium">Notes:</span> {connection.metadata.notes}
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
            onClick={() => onRemove(connection.id)}
            variant="danger"
            className="flex-1"
          >
            Remove Connection
          </Button>
        </div>

        <Button onClick={onClose} variant="secondary" className="w-full">
          Close
        </Button>
      </div>
    </Card>
  );
};
