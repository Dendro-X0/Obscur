import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * engine_invoke boundary catalog — LEGACY_PARALLEL still present after TS dual-owner subtract.
 * @see specs/backend/engine-invoke-boundary-subtract-design-2026-07.md
 * @see specs/backend/relay-publish-r1-inventory-design-2026-07.md
 */

const REPO_ROOT = join(__dirname, "../../../../");
const PWA_ROOT = join(REPO_ROOT, "apps/pwa");

const readRepo = (rel: string): string => readFileSync(join(REPO_ROOT, rel), "utf8");
const readPwa = (rel: string): string => readFileSync(join(PWA_ROOT, rel), "utf8");

const collectFeatureSources = (dir: string, acc: string[] = []): string[] => {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const stat = statSync(full);
    if (stat.isDirectory()) {
      if (entry === "node_modules" || entry === ".next") {
        continue;
      }
      collectFeatureSources(full, acc);
      continue;
    }
    if (/\.(ts|tsx)$/.test(entry) && !/\.test\.(ts|tsx)$/.test(entry) && !/\.contract\.test\.(ts|tsx)$/.test(entry)) {
      acc.push(full);
    }
  }
  return acc;
};

describe("engine_invoke boundary catalog", () => {
  it("dm dispatch exposes read + insertMessage / upsertConversation (B1 landed)", () => {
    const engine = readRepo("packages/libobscur/src/engine_invoke.rs");
    expect(engine).toContain("fn dispatch_dm(");
    expect(engine).toContain('"getThread"');
    expect(engine).toContain('"listConversations"');
    expect(engine).toContain('"insertMessage"');
    expect(engine).toContain('"upsertConversation"');
  });

  it("desktop still registers db_insert_message alongside engine_invoke (LEGACY_PARALLEL)", () => {
    const lib = readRepo("apps/desktop/src-tauri/src/lib.rs");
    expect(lib).toContain("commands::engine::engine_invoke");
    expect(lib).toContain("commands::db::db_insert_message");
  });

  it("desktop registers transport async publish; raw publish_event IPC tombstoned (R3)", () => {
    const lib = readRepo("apps/desktop/src-tauri/src/lib.rs");
    expect(lib).not.toMatch(/relay::publish_event\b/);
    expect(lib).toContain("commands::transport_engine::engine_invoke_transport_publish_relay_event");
    expect(lib).toContain("commands::transport_engine::engine_invoke_transport_configure_mesh_conduits");
    expect(lib).toContain("commands::transport_engine::engine_invoke_transport_get_mesh_snapshot");
    expect(lib).toContain("commands::transport_engine::engine_invoke_transport_publish_mesh_envelope");
    expect(lib).toContain("relay::send_relay_message");
    const relay = readRepo("apps/desktop/src-tauri/src/relay.rs");
    expect(relay).toContain("publish_event_with_ack");
    expect(relay).not.toMatch(/#\[tauri::command\]\s*\npub async fn publish_event\b/);
  });

  it("product features do not invoke raw publish_event command (R1)", () => {
    const featuresRoot = join(PWA_ROOT, "app/features");
    const offenders = collectFeatureSources(featuresRoot).filter((file) => {
      const source = readFileSync(file, "utf8");
      return /invoke\s*(?:<[^>]*>)?\s*\(\s*["']publish_event["']/.test(source);
    });
    expect(offenders.map((f) => relative(PWA_ROOT, f).replace(/\\/g, "/"))).toEqual([]);
  });

  it("ACL keeps send_relay_message and does not allow publish_event (R2/R3)", () => {
    const permissions = readRepo("apps/desktop/src-tauri/permissions/app.toml");
    const relayBlock = permissions.match(
      /identifier = "allow-relay-commands"[\s\S]*?(?=\n\[\[permission\]\]|\s*$)/,
    )?.[0] ?? "";
    expect(relayBlock).toContain("send_relay_message");
    expect(relayBlock).not.toMatch(/["']publish_event["']/);
  });

  it("ACL quarantines bare checkpoint db_* (Slice 10 — ACC-03 on engine_invoke)", () => {
    const permissions = readRepo("apps/desktop/src-tauri/permissions/app.toml");
    const dbBlock = permissions.match(
      /identifier = "allow-db-commands"[\s\S]*?(?=\n\[\[permission\]\]|\s*$)/,
    )?.[0] ?? "";
    expect(dbBlock).toContain("engine_invoke");
    expect(dbBlock).not.toMatch(/["']db_upsert_relay_checkpoint["']/);
    expect(dbBlock).not.toMatch(/["']db_get_relay_checkpoint["']/);
    expect(dbBlock).not.toMatch(/["']db_get_relay_checkpoints["']/);
    const engine = readRepo("packages/libobscur/src/engine_invoke.rs");
    expect(engine).toContain('"listRelayCheckpoints"');
    expect(engine).toContain('"upsertRelayCheckpoint"');
  });

  it("checkpoint db_* IPC handlers tombstoned (Slice 11)", () => {
    const lib = readRepo("apps/desktop/src-tauri/src/lib.rs");
    expect(lib).not.toMatch(/db_upsert_relay_checkpoint/);
    expect(lib).not.toMatch(/db_get_relay_checkpoint\b/);
    expect(lib).not.toMatch(/db_get_relay_checkpoints/);
    const db = readRepo("apps/desktop/src-tauri/src/commands/db.rs");
    expect(db).not.toMatch(/#\[tauri::command\]\s*\npub fn db_upsert_relay_checkpoint\b/);
    expect(db).not.toMatch(/#\[tauri::command\]\s*\npub fn db_get_relay_checkpoints\b/);
    expect(db).toContain("checkpoint IPC tombstoned");
  });

  it("DM read db_get_messages / db_get_conversations IPC tombstoned (Slice 15)", () => {
    const permissions = readRepo("apps/desktop/src-tauri/permissions/app.toml");
    const dbBlock = permissions.match(
      /identifier = "allow-db-commands"[\s\S]*?(?=\n\[\[permission\]\]|\s*$)/,
    )?.[0] ?? "";
    expect(dbBlock).not.toMatch(/["']db_get_messages["']/);
    expect(dbBlock).not.toMatch(/["']db_get_conversations["']/);
    const lib = readRepo("apps/desktop/src-tauri/src/lib.rs");
    expect(lib).not.toMatch(/db_get_messages/);
    expect(lib).not.toMatch(/db_get_conversations/);
    const db = readRepo("apps/desktop/src-tauri/src/commands/db.rs");
    expect(db).not.toMatch(/#\[tauri::command\]\s*\npub fn db_get_messages\b/);
    expect(db).not.toMatch(/#\[tauri::command\]\s*\npub fn db_get_conversations\b/);
    expect(db).toContain("DM read IPC tombstoned");
    const engine = readRepo("packages/libobscur/src/engine_invoke.rs");
    expect(engine).toContain('"getThread"');
    expect(engine).toContain('"listConversations"');
    const client = readRepo("packages/db/src/client.ts");
    expect(client).not.toMatch(/\bdbGetMessages\b/);
    expect(client).not.toMatch(/\bdbGetConversations\b/);
  });

  it("vault media index product path uses persistence engine (Slice 16)", () => {
    const store = readRepo("apps/pwa/app/features/vault/services/vault-media-index-sqlite-store.ts");
    expect(store).toContain("listVaultMediaIndex");
    expect(store).toContain("upsertVaultMediaIndex");
    expect(store).toContain("@obscur/persistence-engine");
    expect(store).not.toMatch(/\bdbGetVaultMediaIndexForProfile\b/);
    expect(store).not.toMatch(/\bdbUpsertVaultMediaIndex\b/);
    const engine = readRepo("packages/libobscur/src/engine_invoke.rs");
    expect(engine).toContain('"persistence"');
    expect(engine).toContain('"listVaultMediaIndex"');
    expect(engine).toContain('"upsertVaultMediaIndex"');
    const contracts = readRepo("packages/obscur-engine-contracts/src/persistence-engine-methods.ts");
    expect(contracts).toContain("PERSISTENCE_ENGINE_METHODS");
  });

  it("vault media index db_* IPC tombstoned (Slice 17)", () => {
    const lib = readRepo("apps/desktop/src-tauri/src/lib.rs");
    expect(lib).not.toMatch(/db_upsert_vault_media_index/);
    expect(lib).not.toMatch(/db_get_vault_media_index_for_profile/);
    expect(lib).not.toMatch(/db_delete_vault_media_index/);
    expect(lib).not.toMatch(/db_delete_all_vault_media_index_for_profile/);
    const db = readRepo("apps/desktop/src-tauri/src/commands/db.rs");
    expect(db).not.toMatch(/#\[tauri::command\]\s*\npub fn db_upsert_vault_media_index\b/);
    expect(db).not.toMatch(/#\[tauri::command\]\s*\npub fn db_get_vault_media_index_for_profile\b/);
    expect(db).not.toMatch(/#\[tauri::command\]\s*\npub fn db_delete_vault_media_index\b/);
    expect(db).not.toMatch(/#\[tauri::command\]\s*\npub fn db_delete_all_vault_media_index_for_profile\b/);
    expect(db).toContain("vault media index IPC tombstoned");
    const client = readRepo("packages/db/src/client.ts");
    expect(client).not.toMatch(/\bdbUpsertVaultMediaIndex\b/);
    expect(client).not.toMatch(/\bdbGetVaultMediaIndexForProfile\b/);
    expect(client).not.toMatch(/\bdbDeleteVaultMediaIndex\b/);
    expect(client).not.toMatch(/\bdbDeleteAllVaultMediaIndexForProfile\b/);
  });

  it("call records product path uses persistence engine (Slice 18)", () => {
    const store = readRepo("apps/pwa/app/features/messaging/services/call-record-sqlite-store.ts");
    expect(store).toContain("listCallRecords");
    expect(store).toContain("upsertCallRecord");
    expect(store).toContain("@obscur/persistence-engine");
    expect(store).not.toMatch(/\bdbInsertCallRecord\b/);
    expect(store).not.toMatch(/\bdbUpdateCallRecord\b/);
    expect(store).not.toMatch(/\bdbGetCallRecords\b/);
    const engine = readRepo("packages/libobscur/src/engine_invoke.rs");
    expect(engine).toContain('"listCallRecords"');
    expect(engine).toContain('"upsertCallRecord"');
    const contracts = readRepo("packages/obscur-engine-contracts/src/persistence-engine-methods.ts");
    expect(contracts).toContain("listCallRecords");
    expect(contracts).toContain("upsertCallRecord");
  });

  it("call-record db_* IPC tombstoned (Slice 19)", () => {
    const permissions = readRepo("apps/desktop/src-tauri/permissions/app.toml");
    const dbBlock = permissions.match(
      /identifier = "allow-db-commands"[\s\S]*?(?=\n\[\[permission\]\]|\s*$)/,
    )?.[0] ?? "";
    expect(dbBlock).not.toMatch(/["']db_insert_call_record["']/);
    expect(dbBlock).not.toMatch(/["']db_update_call_record["']/);
    expect(dbBlock).not.toMatch(/["']db_get_call_records["']/);
    const lib = readRepo("apps/desktop/src-tauri/src/lib.rs");
    expect(lib).not.toMatch(/db_insert_call_record/);
    expect(lib).not.toMatch(/db_update_call_record/);
    expect(lib).not.toMatch(/db_get_call_records/);
    const db = readRepo("apps/desktop/src-tauri/src/commands/db.rs");
    expect(db).not.toMatch(/#\[tauri::command\]\s*\npub fn db_insert_call_record\b/);
    expect(db).not.toMatch(/#\[tauri::command\]\s*\npub fn db_update_call_record\b/);
    expect(db).not.toMatch(/#\[tauri::command\]\s*\npub fn db_get_call_records\b/);
    expect(db).toContain("call-record IPC tombstoned");
    const client = readRepo("packages/db/src/client.ts");
    expect(client).not.toMatch(/\bdbInsertCallRecord\b/);
    expect(client).not.toMatch(/\bdbUpdateCallRecord\b/);
    expect(client).not.toMatch(/\bdbGetCallRecords\b/);
  });

  it("DM tombstone/delete product path uses dm engine (Slice 20)", () => {
    const store = readRepo("apps/pwa/app/features/messaging/services/message-delete-tombstone-store.ts");
    expect(store).toContain("listDmTombstones");
    expect(store).toContain("insertDmTombstone");
    expect(store).toContain("@obscur/dm-engine");
    expect(store).not.toMatch(/\bdbGetTombstones\b/);
    expect(store).not.toMatch(/\bdbInsertTombstone\b/);
    const visibility = readRepo("apps/pwa/app/features/messaging/local-dm-visibility/local-dm-visibility-owner.ts");
    expect(visibility).toContain("deleteDmMessages");
    expect(visibility).not.toMatch(/\bdbDeleteMessages\b/);
    const engine = readRepo("packages/libobscur/src/engine_invoke.rs");
    expect(engine).toContain('"listTombstones"');
    expect(engine).toContain('"insertTombstone"');
    expect(engine).toContain('"deleteMessages"');
    const contracts = readRepo("packages/obscur-engine-contracts/src/dm-engine-methods.ts");
    expect(contracts).toContain("listTombstones");
    expect(contracts).toContain("deleteMessages");
  });

  it("DM delete/tombstone db_* IPC tombstoned (Slice 21)", () => {
    const permissions = readRepo("apps/desktop/src-tauri/permissions/app.toml");
    const dbBlock = permissions.match(
      /identifier = "allow-db-commands"[\s\S]*?(?=\n\[\[permission\]\]|\s*$)/,
    )?.[0] ?? "";
    expect(dbBlock).not.toMatch(/["']db_delete_message["']/);
    expect(dbBlock).not.toMatch(/["']db_delete_messages["']/);
    expect(dbBlock).not.toMatch(/["']db_insert_tombstone["']/);
    expect(dbBlock).not.toMatch(/["']db_insert_tombstones["']/);
    expect(dbBlock).not.toMatch(/["']db_get_tombstones["']/);
    expect(dbBlock).not.toMatch(/["']db_delete_all_tombstones_for_profile["']/);
    const lib = readRepo("apps/desktop/src-tauri/src/lib.rs");
    expect(lib).not.toMatch(/db_delete_message/);
    expect(lib).not.toMatch(/db_delete_messages/);
    expect(lib).not.toMatch(/db_insert_tombstone/);
    expect(lib).not.toMatch(/db_get_tombstones/);
    expect(lib).not.toMatch(/db_delete_all_tombstones_for_profile/);
    const db = readRepo("apps/desktop/src-tauri/src/commands/db.rs");
    expect(db).not.toMatch(/#\[tauri::command\]\s*\npub fn db_delete_message\b/);
    expect(db).not.toMatch(/#\[tauri::command\]\s*\npub fn db_delete_messages\b/);
    expect(db).not.toMatch(/#\[tauri::command\]\s*\npub fn db_insert_tombstone\b/);
    expect(db).not.toMatch(/#\[tauri::command\]\s*\npub fn db_get_tombstones\b/);
    expect(db).toContain("DM delete/tombstone IPC tombstoned");
    const client = readRepo("packages/db/src/client.ts");
    expect(client).not.toMatch(/\bdbDeleteMessage\b/);
    expect(client).not.toMatch(/\bdbDeleteMessages\b/);
    expect(client).not.toMatch(/\bdbInsertTombstone\b/);
    expect(client).not.toMatch(/\bdbGetTombstones\b/);
    expect(client).not.toMatch(/\bdbDeleteAllTombstonesForProfile\b/);
  });

  it("profile wipe product path uses persistence engine (Slice 22)", () => {
    const reset = readRepo("apps/pwa/app/features/profiles/services/profile-local-reset-service.ts");
    expect(reset).toContain("wipeProfileLocalData");
    expect(reset).toContain("@obscur/persistence-engine");
    expect(reset).not.toMatch(/\bdbWipeProfileLocalData\b/);
    const engine = readRepo("packages/libobscur/src/engine_invoke.rs");
    expect(engine).toContain('"searchMessages"');
    expect(engine).toContain('"wipeProfileLocalData"');
    const contracts = readRepo("packages/obscur-engine-contracts/src/persistence-engine-methods.ts");
    expect(contracts).toContain("searchMessages");
    expect(contracts).toContain("wipeProfileLocalData");
  });

  it("search/wipe db_* IPC tombstoned (Slice 23)", () => {
    const permissions = readRepo("apps/desktop/src-tauri/permissions/app.toml");
    const dbBlock = permissions.match(
      /identifier = "allow-db-commands"[\s\S]*?(?=\n\[\[permission\]\]|\s*$)/,
    )?.[0] ?? "";
    expect(dbBlock).not.toMatch(/["']db_search_messages["']/);
    expect(dbBlock).not.toMatch(/["']db_wipe_profile_local_data["']/);
    const lib = readRepo("apps/desktop/src-tauri/src/lib.rs");
    expect(lib).not.toMatch(/db_search_messages/);
    expect(lib).not.toMatch(/db_wipe_profile_local_data/);
    const db = readRepo("apps/desktop/src-tauri/src/commands/db.rs");
    expect(db).not.toMatch(/#\[tauri::command\]\s*\npub fn db_search_messages\b/);
    expect(db).not.toMatch(/#\[tauri::command\]\s*\npub fn db_wipe_profile_local_data\b/);
    expect(db).toContain("search/wipe IPC tombstoned");
    const client = readRepo("packages/db/src/client.ts");
    expect(client).not.toMatch(/\bdbSearchMessages\b/);
    expect(client).not.toMatch(/\bdbWipeProfileLocalData\b/);
  });

  it("group db_* IPC tombstoned (U2 follow-on)", () => {
    const permissions = readRepo("apps/desktop/src-tauri/permissions/app.toml");
    const dbBlock = permissions.match(
      /identifier = "allow-db-commands"[\s\S]*?(?=\n\[\[permission\]\]|\s*$)/,
    )?.[0] ?? "";
    expect(dbBlock).not.toMatch(/["']db_get_groups["']/);
    expect(dbBlock).not.toMatch(/["']db_upsert_group["']/);
    expect(dbBlock).not.toMatch(/["']db_insert_group_message["']/);
    expect(dbBlock).not.toMatch(/["']db_get_group_messages["']/);
    expect(dbBlock).not.toMatch(/["']db_insert_group_tombstone["']/);
    const lib = readRepo("apps/desktop/src-tauri/src/lib.rs");
    expect(lib).not.toMatch(/db_get_groups/);
    expect(lib).not.toMatch(/db_upsert_group/);
    expect(lib).not.toMatch(/db_insert_group_message/);
    expect(lib).not.toMatch(/db_get_group_messages/);
    expect(lib).not.toMatch(/db_insert_group_tombstone/);
    const db = readRepo("apps/desktop/src-tauri/src/commands/db.rs");
    expect(db).not.toMatch(/#\[tauri::command\]\s*\npub fn db_get_groups\b/);
    expect(db).not.toMatch(/#\[tauri::command\]\s*\npub fn db_upsert_group\b/);
    expect(db).not.toMatch(/#\[tauri::command\]\s*\npub fn db_insert_group_message\b/);
    expect(db).not.toMatch(/#\[tauri::command\]\s*\npub fn db_get_group_messages\b/);
    expect(db).not.toMatch(/#\[tauri::command\]\s*\npub fn db_insert_group_tombstone\b/);
    expect(db).toContain("Group list/message/tombstone IPC tombstoned");
    const engine = readRepo("packages/libobscur/src/engine_invoke.rs");
    expect(engine).toContain('"listGroups"');
    expect(engine).toContain('"upsertGroup"');
    expect(engine).toContain('"listGroupMessages"');
    expect(engine).toContain('"insertGroupMessage"');
    expect(engine).toContain('"insertGroupTombstone"');
  });

  it("remaining allow-db-commands is non-group LEGACY_PARALLEL + engine only", () => {
    const permissions = readRepo("apps/desktop/src-tauri/permissions/app.toml");
    const dbBlock = permissions.match(
      /identifier = "allow-db-commands"[\s\S]*?(?=\n\[\[permission\]\]|\s*$)/,
    )?.[0] ?? "";
    const allowed = Array.from(dbBlock.matchAll(/"([a-z0-9_]+)"/g), (m) => m[1]).sort();
    expect(allowed).toEqual([
      "db_insert_message",
      "db_upsert_conversation",
      "engine_invoke",
      "engine_invoke_transport_configure_mesh_conduits",
      "engine_invoke_transport_export_offline_pack",
      "engine_invoke_transport_get_mesh_snapshot",
      "engine_invoke_transport_import_offline_pack",
      "engine_invoke_transport_publish_mesh_envelope",
      "engine_invoke_transport_publish_relay_event",
    ].sort());
  });

  it("product features do not invoke bare checkpoint db_* commands", () => {
    const featuresRoot = join(PWA_ROOT, "app/features");
    const offenders = collectFeatureSources(featuresRoot).filter((file) => {
      const source = readFileSync(file, "utf8");
      return /invoke\s*(?:<[^>]*>)?\s*\(\s*["']db_(?:upsert_relay_checkpoint|get_relay_checkpoint|get_relay_checkpoints)["']/.test(
        source,
      )
        || /\bdb(?:UpsertRelayCheckpoint|GetRelayCheckpoint|GetRelayCheckpoints)\b/.test(source);
    });
    expect(offenders.map((f) => relative(PWA_ROOT, f).replace(/\\/g, "/"))).toEqual([]);
  });

  it("dm-kernel write port routes inserts via engine_invoke (B2 landed)", () => {
    const port = readPwa("app/features/dm-kernel/dm-kernel-write-port.ts");
    expect(port).toContain("insertMessage");
    expect(port).toContain("upsertConversation");
    expect(port).toContain("createTauriEngineHost");
    expect(port).not.toMatch(/\bdbInsertMessage\b/);
    expect(port).not.toMatch(/\bdbUpsertConversation\b/);
  });

  it("backup-evidence DM restore uses writeDmKernelMessage (B3 landed)", () => {
    const evidence = readPwa("app/features/account-sync/services/native-sqlite-backup-evidence.ts");
    expect(evidence).toContain("writeDmKernelMessage");
    expect(evidence).not.toMatch(/\bdbInsertMessage\b/);
  });

  it("backup-evidence group collect/apply uses workspace-engine (U2 Wave C)", () => {
    const evidence = readPwa("app/features/account-sync/services/native-sqlite-backup-evidence.ts");
    expect(evidence).toContain("listWorkspaceGroups");
    expect(evidence).toContain("listWorkspaceGroupMessages");
    expect(evidence).toContain("upsertWorkspaceGroup");
    expect(evidence).toContain("insertWorkspaceGroupMessage");
    expect(evidence).toContain("@obscur/workspace-engine");
    expect(evidence).not.toMatch(/\bdbGetGroups\b/);
    expect(evidence).not.toMatch(/\bdbUpsertGroup\b/);
    expect(evidence).not.toMatch(/\bdbGetGroupMessages\b/);
    expect(evidence).not.toMatch(/\bdbInsertGroupMessage\b/);
    const accountEvidence = readPwa("app/features/groups/services/account-group-sqlite-evidence.ts");
    expect(accountEvidence).toContain("listWorkspaceGroupMessageRecords");
    expect(accountEvidence).not.toMatch(/\bdbGetGroupMessages\b/);
    const client = readRepo("packages/db/src/client.ts");
    expect(client).not.toMatch(/\bdbGetGroups\b/);
    expect(client).not.toMatch(/\bdbUpsertGroup\b/);
    expect(client).not.toMatch(/\bdbGetGroupMessages\b/);
    expect(client).not.toMatch(/\bdbInsertGroupMessage\b/);
    expect(client).not.toMatch(/\bdbInsertGroupTombstone\b/);
    expect(client).toContain("Groups + group messages — IPC tombstoned");
  });
});
