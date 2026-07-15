import { isNostrEventWirePayload } from "./nostr-wire-payload";

export const OBSCUR_MESH_DM_WIRE_V1 = "obscur_mesh_dm_wire_v1";

export type MeshNativeDmWireEvent = Readonly<{
  id: string;
  pubkey: string;
  created_at: number;
  kind: number;
  tags: ReadonlyArray<ReadonlyArray<string>>;
  content: string;
  sig: string;
}>;

export type MeshNativeDmWireBody = Readonly<{
  contractVersion: typeof OBSCUR_MESH_DM_WIRE_V1;
  event: MeshNativeDmWireEvent;
}>;

/** True when payload is mesh-native DM wire (signed kind-4 event object, not NIP-01 array). */
export const isMeshNativeDmWirePayload = (payload: string): boolean => {
  try {
    const parsed = JSON.parse(payload) as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return false;
    }
    const body = parsed as { contractVersion?: unknown; event?: unknown };
    return body.contractVersion === OBSCUR_MESH_DM_WIRE_V1
      && typeof body.event === "object"
      && body.event !== null;
  } catch {
    return false;
  }
};

export const encodeMeshNativeDmWire = (event: MeshNativeDmWireEvent): string => (
  JSON.stringify({
    contractVersion: OBSCUR_MESH_DM_WIRE_V1,
    event,
  } satisfies MeshNativeDmWireBody)
);

export const decodeMeshNativeDmWire = (payload: string): MeshNativeDmWireBody => {
  if (!isMeshNativeDmWirePayload(payload)) {
    throw new Error("invalid_mesh_native_dm_wire");
  }
  return JSON.parse(payload) as MeshNativeDmWireBody;
};

export const nostrEventWireToMeshNativeDmWire = (nostrWire: string): string => {
  if (!isNostrEventWirePayload(nostrWire)) {
    throw new Error("not_nostr_event_wire");
  }
  const parsed = JSON.parse(nostrWire) as [string, MeshNativeDmWireEvent];
  return encodeMeshNativeDmWire(parsed[1]);
};

export const meshNativeDmWireToNostrEventWire = (nativeWire: string): string => {
  const body = decodeMeshNativeDmWire(nativeWire);
  return JSON.stringify(["EVENT", body.event]);
};
