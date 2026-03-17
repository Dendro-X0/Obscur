import { describe, expect, it } from "vitest";
import type { PublicKeyHex } from "@dweb/crypto/public-key-hex";
import {
  createRequestTransportService,
  deriveRequestConvergenceState,
} from "./request-transport-service";
import type {
  RequestFlowEvidence,
  TwoUserDeterministicRunReport,
  TwoUserDeterministicRunStep,
} from "./request-flow-contracts";

type RequestStatusRecord = Readonly<{
  status?: "pending" | "accepted" | "declined" | "canceled";
  isOutgoing: boolean;
}>;

type EvidenceStoreSnapshot = Readonly<Record<string, RequestFlowEvidence>>;
type StatusSnapshot = Readonly<Record<string, RequestStatusRecord>>;

type InMemoryEvidenceStore = ReturnType<typeof createInMemoryEvidenceStore>;
type StatusAccess = ReturnType<typeof createStatusAccess>;

const USER_A = "a".repeat(64) as PublicKeyHex;
const USER_B = "b".repeat(64) as PublicKeyHex;

const createInMemoryEvidenceStore = (seed?: EvidenceStoreSnapshot) => {
  let state: Record<string, RequestFlowEvidence> = seed ? { ...seed } : {};
  return {
    get: (peerPublicKeyHex: string): RequestFlowEvidence => state[peerPublicKeyHex] ?? { receiptAckSeen: false, acceptSeen: false },
    markRequestPublished: ({ peerPublicKeyHex, requestEventId }: Readonly<{ peerPublicKeyHex: string; requestEventId?: string }>) => {
      const current = state[peerPublicKeyHex] ?? { receiptAckSeen: false, acceptSeen: false };
      const next = {
        ...current,
        requestEventId: requestEventId || current.requestEventId,
        lastEvidenceUnixMs: Date.now(),
      };
      state[peerPublicKeyHex] = next;
      return next;
    },
    markReceiptAck: ({ peerPublicKeyHex, requestEventId }: Readonly<{ peerPublicKeyHex: string; requestEventId?: string }>) => {
      const current = state[peerPublicKeyHex] ?? { receiptAckSeen: false, acceptSeen: false };
      const next = {
        ...current,
        requestEventId: requestEventId || current.requestEventId,
        receiptAckSeen: true,
        lastEvidenceUnixMs: Date.now(),
      };
      state[peerPublicKeyHex] = next;
      return next;
    },
    markAccept: ({ peerPublicKeyHex, requestEventId }: Readonly<{ peerPublicKeyHex: string; requestEventId?: string }>) => {
      const current = state[peerPublicKeyHex] ?? { receiptAckSeen: false, acceptSeen: false };
      const next = {
        ...current,
        requestEventId: requestEventId || current.requestEventId,
        acceptSeen: true,
        lastEvidenceUnixMs: Date.now(),
      };
      state[peerPublicKeyHex] = next;
      return next;
    },
    markTerminalFailure: ({ peerPublicKeyHex }: Readonly<{ peerPublicKeyHex: string }>) => {
      const current = state[peerPublicKeyHex] ?? { receiptAckSeen: false, acceptSeen: false };
      const next = {
        ...current,
        lastEvidenceUnixMs: Date.now(),
      };
      state[peerPublicKeyHex] = next;
      return next;
    },
    snapshot: (): EvidenceStoreSnapshot => ({ ...state }),
  };
};

const createStatusAccess = (seed?: StatusSnapshot) => {
  let state: Record<string, RequestStatusRecord> = seed ? { ...seed } : {};
  return {
    getRequestStatus: ({ peerPublicKeyHex }: Readonly<{ peerPublicKeyHex: PublicKeyHex }>) => {
      return state[peerPublicKeyHex] ?? null;
    },
    setStatus: ({
      peerPublicKeyHex,
      status,
      isOutgoing,
    }: Readonly<{ peerPublicKeyHex: PublicKeyHex; status: "pending" | "accepted" | "declined" | "canceled"; isOutgoing?: boolean }>) => {
      const existing = state[peerPublicKeyHex];
      state[peerPublicKeyHex] = {
        status,
        isOutgoing: isOutgoing ?? existing?.isOutgoing ?? false,
      };
    },
    snapshot: (): StatusSnapshot => ({ ...state }),
  };
};

const createServicePair = (params: Readonly<{
  requestEventId: string;
  acceptEventId: string;
  aEvidenceStore: InMemoryEvidenceStore;
  bEvidenceStore: InMemoryEvidenceStore;
  aStatuses: StatusAccess;
  bStatuses: StatusAccess;
}>) => {
  const serviceA = createRequestTransportService({
    sendConnectionRequest: async () => ({
      success: true,
      deliveryStatus: "sent_quorum",
      messageId: params.requestEventId,
      relayResults: [{ relayUrl: "wss://relay.test", success: true }],
    } as any),
    sendDm: async () => ({
      success: true,
      deliveryStatus: "sent_quorum",
      messageId: params.acceptEventId,
      relayResults: [{ relayUrl: "wss://relay.test", success: true }],
    } as any),
    requestsInbox: params.aStatuses as any,
    evidenceStore: params.aEvidenceStore as any,
  });

  const serviceB = createRequestTransportService({
    sendConnectionRequest: async () => ({
      success: true,
      deliveryStatus: "sent_quorum",
      messageId: `noop-${params.requestEventId}`,
      relayResults: [{ relayUrl: "wss://relay.test", success: true }],
    } as any),
    sendDm: async () => ({
      success: true,
      deliveryStatus: "sent_quorum",
      messageId: params.acceptEventId,
      relayResults: [{ relayUrl: "wss://relay.test", success: true }],
    } as any),
    requestsInbox: params.bStatuses as any,
    peerTrust: { acceptPeer: () => undefined },
    evidenceStore: params.bEvidenceStore as any,
  });

  return { serviceA, serviceB };
};

const restartHarness = (params: Readonly<{
  requestEventId: string;
  acceptEventId: string;
  aEvidenceStore: InMemoryEvidenceStore;
  bEvidenceStore: InMemoryEvidenceStore;
  aStatuses: StatusAccess;
  bStatuses: StatusAccess;
}>) => {
  const restartedAEvidenceStore = createInMemoryEvidenceStore(params.aEvidenceStore.snapshot());
  const restartedBEvidenceStore = createInMemoryEvidenceStore(params.bEvidenceStore.snapshot());
  const restartedAStatuses = createStatusAccess(params.aStatuses.snapshot());
  const restartedBStatuses = createStatusAccess(params.bStatuses.snapshot());

  return {
    ...createServicePair({
      requestEventId: params.requestEventId,
      acceptEventId: params.acceptEventId,
      aEvidenceStore: restartedAEvidenceStore,
      bEvidenceStore: restartedBEvidenceStore,
      aStatuses: restartedAStatuses,
      bStatuses: restartedBStatuses,
    }),
    aEvidenceStore: restartedAEvidenceStore,
    bEvidenceStore: restartedBEvidenceStore,
    aStatuses: restartedAStatuses,
    bStatuses: restartedBStatuses,
  };
};

const buildStep = (name: string, passed: boolean, detail?: string): TwoUserDeterministicRunStep => ({
  name,
  passed,
  detail,
});

describe("request transport deterministic two-user flow", () => {
  it("passes 10/10 request -> receipt -> accept runs with restart checkpoints and wire evidence", async () => {
    const reports: TwoUserDeterministicRunReport[] = [];

    for (let iteration = 1; iteration <= 10; iteration += 1) {
      const requestEventId = `req-${iteration}`;
      const acceptEventId = `accept-${iteration}`;
      let aEvidenceStore = createInMemoryEvidenceStore();
      let bEvidenceStore = createInMemoryEvidenceStore();
      let aStatuses = createStatusAccess();
      let bStatuses = createStatusAccess();
      let { serviceA, serviceB } = createServicePair({
        requestEventId,
        acceptEventId,
        aEvidenceStore,
        bEvidenceStore,
        aStatuses,
        bStatuses,
      });

      const steps: TwoUserDeterministicRunStep[] = [];

      const sendResult = await serviceA.sendRequest({
        peerPublicKeyHex: USER_B,
        introMessage: "hello",
      });
      steps.push(buildStep("A send request", sendResult.status === "ok", sendResult.status));
      steps.push(buildStep(
        "A request event observed",
        serviceA.getFlowEvidence(USER_B).requestEventId === requestEventId,
        serviceA.getFlowEvidence(USER_B).requestEventId
      ));

      ({
        serviceA,
        serviceB,
        aEvidenceStore,
        bEvidenceStore,
        aStatuses,
        bStatuses,
      } = restartHarness({
        requestEventId,
        acceptEventId,
        aEvidenceStore,
        bEvidenceStore,
        aStatuses,
        bStatuses,
      }));
      steps.push(buildStep(
        "Restart after send keeps sender request evidence",
        serviceA.getFlowEvidence(USER_B).requestEventId === requestEventId,
      ));

      bStatuses.setStatus({ peerPublicKeyHex: USER_A, status: "pending", isOutgoing: false });
      serviceB.recordIncomingWireEvidence({
        peerPublicKeyHex: USER_A,
        type: "request",
        requestEventId,
      });
      steps.push(buildStep(
        "B receives pending request with wire evidence",
        bStatuses.getRequestStatus({ peerPublicKeyHex: USER_A })?.status === "pending"
          && serviceB.getFlowEvidence(USER_A).requestEventId === requestEventId,
      ));

      ({
        serviceA,
        serviceB,
        aEvidenceStore,
        bEvidenceStore,
        aStatuses,
        bStatuses,
      } = restartHarness({
        requestEventId,
        acceptEventId,
        aEvidenceStore,
        bEvidenceStore,
        aStatuses,
        bStatuses,
      }));
      steps.push(buildStep(
        "Restart after receive keeps receiver pending evidence",
        bStatuses.getRequestStatus({ peerPublicKeyHex: USER_A })?.status === "pending"
          && serviceB.getFlowEvidence(USER_A).requestEventId === requestEventId,
      ));

      aStatuses.setStatus({ peerPublicKeyHex: USER_B, status: "pending", isOutgoing: true });
      serviceA.recordIncomingWireEvidence({
        peerPublicKeyHex: USER_B,
        type: "receipt_ack",
        requestEventId,
      });
      const pendingState = deriveRequestConvergenceState({
        inboxStatus: aStatuses.getRequestStatus({ peerPublicKeyHex: USER_B })?.status,
        evidence: serviceA.getFlowEvidence(USER_B),
        outboxStatus: "sent_quorum",
      });
      steps.push(buildStep(
        "A receipt-ack observed and sender becomes pending_evidenced",
        serviceA.getFlowEvidence(USER_B).receiptAckSeen === true && pendingState === "pending_evidenced",
        pendingState
      ));

      ({
        serviceA,
        serviceB,
        aEvidenceStore,
        bEvidenceStore,
        aStatuses,
        bStatuses,
      } = restartHarness({
        requestEventId,
        acceptEventId,
        aEvidenceStore,
        bEvidenceStore,
        aStatuses,
        bStatuses,
      }));
      steps.push(buildStep(
        "Restart before accept keeps sender receipt evidence",
        serviceA.getFlowEvidence(USER_B).receiptAckSeen === true
          && aStatuses.getRequestStatus({ peerPublicKeyHex: USER_B })?.status === "pending",
      ));

      const acceptResult = await serviceB.acceptIncomingRequest({
        peerPublicKeyHex: USER_A,
        requestEventId,
      });
      steps.push(buildStep(
        "B accepts with transport evidence",
        acceptResult.status === "ok"
          && acceptResult.evidence.acceptSeen === true
          && bStatuses.getRequestStatus({ peerPublicKeyHex: USER_A })?.status === "accepted",
        `${acceptResult.status}:${acceptResult.convergenceState}`
      ));

      ({
        serviceA,
        serviceB,
        aEvidenceStore,
        bEvidenceStore,
        aStatuses,
        bStatuses,
      } = restartHarness({
        requestEventId,
        acceptEventId,
        aEvidenceStore,
        bEvidenceStore,
        aStatuses,
        bStatuses,
      }));
      steps.push(buildStep(
        "Restart after accept keeps receiver accepted evidence",
        serviceB.getFlowEvidence(USER_A).acceptSeen === true
          && bStatuses.getRequestStatus({ peerPublicKeyHex: USER_A })?.status === "accepted",
      ));

      aStatuses.setStatus({
        peerPublicKeyHex: USER_B,
        status: "accepted",
        isOutgoing: true,
      });
      serviceA.recordIncomingWireEvidence({
        peerPublicKeyHex: USER_B,
        type: "accept",
        requestEventId,
      });
      const finalState = deriveRequestConvergenceState({
        inboxStatus: aStatuses.getRequestStatus({ peerPublicKeyHex: USER_B })?.status,
        evidence: serviceA.getFlowEvidence(USER_B),
      });
      steps.push(buildStep(
        "A observes accept event and resolves accepted",
        serviceA.getFlowEvidence(USER_B).acceptSeen === true && finalState === "accepted",
        finalState
      ));

      const firstDivergence = steps.find((entry) => !entry.passed)?.name;
      reports.push({
        iteration,
        steps,
        firstDivergenceStep: firstDivergence,
      });
    }

    expect(reports).toHaveLength(10);
    expect(reports.every((report) => report.steps.every((step) => step.passed))).toBe(true);
    expect(reports.find((report) => report.firstDivergenceStep)).toBeUndefined();
  });
});
