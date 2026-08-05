/**
 * HTTP mesh gateway — operator/relay-gateway surface (not client hot path).
 */
export {
  createMeshHttpGatewayStore,
  createMeshHttpGatewayFetch,
  handleMeshHttpGatewayRequest,
  handleMeshHttpGatewayStreamRequest,
} from "./mesh-http-gateway-handler";
export type {
  MeshHttpGatewayRequest,
  MeshHttpGatewayResponse,
  MeshHttpGatewayStore,
  MeshHttpGatewayStoredEnvelope,
  MeshHttpGatewayListParams,
  MeshHttpGatewayWaitParams,
} from "./mesh-http-gateway-handler";

export {
  createMeshHttpGatewaySseResponse,
  encodeMeshHttpSseEnvelopeFrame,
  encodeMeshHttpSseKeepalive,
  parseMeshHttpSseBuffer,
  wantsMeshHttpSse,
} from "./mesh-http-sse";
