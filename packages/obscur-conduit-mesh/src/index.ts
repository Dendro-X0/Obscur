/**
 * Prefer subpath imports (`@obscur/conduit-mesh/<module>`).
 * Root keeps the primary factory only to avoid hot-path barrel cost.
 */
export { createConduitMesh } from "./create-conduit-mesh";
export type { ConduitMesh, CreateConduitMeshParams, CreateConduitMeshDriverContext } from "./create-conduit-mesh";
