"use client";

import { useEffect, useMemo, useState } from "react";
import { useIdentity } from "@/app/features/auth/hooks/use-identity";
import { useRelay } from "@/app/features/relays/providers/relay-provider";
import { useEnhancedDMController, type Message } from "@/app/features/messaging/hooks/use-enhanced-dm-controller";
import { Button } from "./ui/button";
import { Card } from "./ui/card";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { MessageStatus } from "./ui/message-status";
import { ConnectionStatus } from "./ui/connection-status";
import { ErrorDetails } from "./ui/error-details";
import { QueueStatus } from "./ui/queue-status";
import { RefreshCw, AlertCircle } from "lucide-react";

type DirectMessagesState = Readonly<{
  status: "loading" | "ready" | "error";
  error?: string;
}>;

const createInitialState = (): DirectMessagesState => ({ status: "ready" });

export const DirectMessagesCard = () => {
  const identity = useIdentity();
  const { relayPool: pool } = useRelay();
  const [state] = useState<DirectMessagesState>(createInitialState());
  const [peerPublicKeyHexInput, setPeerPublicKeyHexInput] = useState<string>("");
  const [outgoingText, setOutgoingText] = useState<string>("");
  const [isSending, setIsSending] = useState<boolean>(false);
  const [sendError, setSendError] = useState<string | undefined>();
  const [queueStatus, setQueueStatus] = useState<{
    totalQueued: number;
    isProcessing: boolean;
  } | null>(null);

  const myPublicKeyHex = identity.state.publicKeyHex;
  const myPrivateKeyHex = identity.state.privateKeyHex;

  // Initialize enhanced DM controller
  const dmController = useEnhancedDMController({
    myPublicKeyHex: myPublicKeyHex || null,
    myPrivateKeyHex: myPrivateKeyHex || null,
    pool
  });

  const formatErrorContext = (context: unknown): string | undefined => {
    if (!context) {
      return undefined;
    }
    try {
      return JSON.stringify(context);
    } catch {
      return String(context);
    }
  };

  // Get messages for current conversation
  const conversationId = useMemo(() => {
    if (!myPublicKeyHex || !peerPublicKeyHexInput.trim()) return null;
    const normalized = peerPublicKeyHexInput.trim().toLowerCase();
    if (!/^[0-9a-f]{64}$/.test(normalized)) return null;
    return [myPublicKeyHex, normalized].sort().join(':');
  }, [myPublicKeyHex, peerPublicKeyHexInput]);

  const messages = useMemo(() => {
    if (!conversationId) return [];
    return dmController.getMessagesByConversation(conversationId);
  }, [conversationId, dmController]);

  // Update queue status from controller state
  useEffect(() => {
    if (dmController.state.queueStatus) {
      setQueueStatus({
        totalQueued: dmController.state.queueStatus.totalQueued,
        isProcessing: dmController.state.queueStatus.isProcessing
      });
    }
  }, [dmController.state.queueStatus]);

  // Auto-subscribe to incoming DMs when ready
  useEffect(() => {
    if (dmController.state.status === 'ready' && myPublicKeyHex) {
      dmController.subscribeToIncomingDMs();
    }
  }, [dmController, myPublicKeyHex]);

  const canSend: boolean = useMemo(() => {
    if (identity.state.status !== "unlocked" || !myPrivateKeyHex || !myPublicKeyHex) {
      return false;
    }
    const normalized = peerPublicKeyHexInput.trim().toLowerCase();
    if (!/^[0-9a-f]{64}$/.test(normalized)) {
      return false;
    }
    return outgoingText.trim().length > 0 && !isSending;
  }, [identity.state.status, myPrivateKeyHex, myPublicKeyHex, outgoingText, peerPublicKeyHexInput, isSending]);

  const send = async (): Promise<void> => {
    if (!canSend) {
      return;
    }

    setIsSending(true);
    setSendError(undefined);

    try {
      const result = await dmController.sendDm({
        peerPublicKeyInput: peerPublicKeyHexInput.trim(),
        plaintext: outgoingText.trim()
      });

      if (result.success) {
        setOutgoingText("");
      } else {
        setSendError(result.error || 'Failed to send message');
      }
    } catch (error) {
      console.error('Failed to send message:', error);
      setSendError(error instanceof Error ? error.message : 'Unknown error');
    } finally {
      setIsSending(false);
    }
  };

  const handleRetry = async (messageId: string) => {
    try {
      await dmController.retryFailedMessage(messageId);
    } catch (error) {
      console.error('Failed to retry message:', error);
    }
  };

  const handleProcessQueue = async () => {
    try {
      await dmController.processOfflineQueue();
    } catch (error) {
      console.error('Failed to process queue:', error);
    }
  };

  const handleSyncMessages = async () => {
    try {
      await dmController.syncMissedMessages();
    } catch (error) {
      console.error('Failed to sync messages:', error);
    }
  };

  if (state.status === "loading") {
    return (
      <Card title="Direct messages" description="Private 1:1 chats (NIP-04, kind:4).">
        <div>Loading…</div>
      </Card>
    );
  }

  if (state.status === "error") {
    return (
      <Card tone="danger" title="Direct messages" description="Private 1:1 chats (NIP-04, kind:4).">
        <div className="wrap-break-word">{state.error}</div>
      </Card>
    );
  }

  const openRelayCount = pool.connections.filter(c => c.status === 'open').length;
  const totalRelayCount = pool.connections.length;

  return (
    <Card title="Direct messages" description="Private 1:1 chats (NIP-04, kind:4).">
      {/* Connection Status */}
      <ConnectionStatus
        isOnline={dmController.state.networkState?.isOnline ?? true}
        hasRelayConnection={dmController.state.networkState?.hasRelayConnection ?? false}
        connectedRelayCount={openRelayCount}
        totalRelayCount={totalRelayCount}
        className="mb-4"
      />

      <div>
        <div className="text-xs font-medium text-zinc-600 dark:text-zinc-400">Your public key (hex)</div>
        <div className="mt-2 rounded-xl border border-black/10 bg-white px-3 py-2 font-mono text-xs wrap-break-word dark:border-white/10 dark:bg-zinc-950/60">
          {myPublicKeyHex ?? "(locked)"}
        </div>
      </div>
      <div className="mt-4">
        <Label>Friend public key (hex)</Label>
        <Input value={peerPublicKeyHexInput} onChange={(e) => setPeerPublicKeyHexInput(e.target.value)} type="text" placeholder="64-hex pubkey" />
      </div>
      <div className="mt-3">
        <Label>Message</Label>
        <Input
          value={outgoingText}
          onChange={(e) => setOutgoingText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey && canSend) {
              e.preventDefault();
              void send();
            }
          }}
          type="text"
          placeholder="Type a private message"
          disabled={isSending}
        />
      </div>

      {/* Error display with detailed information */}
      {sendError && dmController.state.lastError && (
        <ErrorDetails
          title="Failed to send message"
          message={sendError}
          details={dmController.state.lastError.userMessage}
          technicalDetails={formatErrorContext(dmController.state.lastError.context) ?? dmController.state.lastError.message}
          className="mt-3"
          onRetry={() => {
            setSendError(undefined);
            void send();
          }}
          retryLabel="Retry sending"
        />
      )}

      {/* Simple error display when no detailed error available */}
      {sendError && !dmController.state.lastError && (
        <div className="mt-3 flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-3 py-2 dark:border-red-900/50 dark:bg-red-950/20">
          <AlertCircle className="h-4 w-4 text-red-600 dark:text-red-400" />
          <span className="text-sm text-red-700 dark:text-red-300">{sendError}</span>
        </div>
      )}

      {/* Offline notification */}
      {dmController.state.networkState && !dmController.state.networkState.isOnline && (
        <div className="mt-3 flex items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 dark:border-amber-900/50 dark:bg-amber-950/20">
          <AlertCircle className="h-4 w-4 text-amber-600 dark:text-amber-400" />
          <span className="text-sm text-amber-700 dark:text-amber-300">
            {"You're offline. Messages will be sent when connection is restored."}
          </span>
        </div>
      )}

      {/* Queue status */}
      {queueStatus && queueStatus.totalQueued > 0 && (
        <QueueStatus
          queuedCount={queueStatus.totalQueued}
          processingCount={0}
          failedCount={0}
          isProcessing={queueStatus.isProcessing}
          className="mt-3"
          onProcessQueue={handleProcessQueue}
        />
      )}

      {/* Sync progress indicator */}
      {dmController.state.syncProgress && (
        <div className="mt-3 flex items-center gap-2 rounded-xl border border-blue-200 bg-blue-50 px-3 py-2 dark:border-blue-900/50 dark:bg-blue-950/20">
          <RefreshCw className="h-4 w-4 text-blue-600 dark:text-blue-400 animate-spin" />
          <span className="text-sm text-blue-700 dark:text-blue-300">
            Syncing messages... {dmController.state.syncProgress.completed} of {dmController.state.syncProgress.total}
          </span>
        </div>
      )}

      <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex gap-2">
          <Button type="button" onClick={() => void send()} disabled={!canSend}>
            {isSending ? 'Sending...' : 'Send'}
          </Button>
          <Button
            type="button"
            onClick={() => void handleSyncMessages()}
            disabled={!dmController.state.networkState?.hasRelayConnection}
            variant="outline"
            title="Sync missed messages"
          >
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>
        <div className="text-xs text-zinc-600 dark:text-zinc-400">
          Identity: <span className="font-medium text-zinc-900 dark:text-zinc-100">{identity.state.status}</span>
        </div>
      </div>

      <div className="mt-5">
        <div className="text-xs font-medium text-zinc-600 dark:text-zinc-400">Conversation</div>
        <ul className="mt-2 space-y-2">
          {messages.length === 0 ? (
            <li className="text-xs text-zinc-600 dark:text-zinc-400">No messages yet.</li>
          ) : null}
          {messages.slice(0, 15).map((message: Message) => (
            <li
              key={message.id}
              className={`flex flex-col gap-1 rounded-xl border px-3 py-2 ${message.isOutgoing
                  ? 'border-blue-200 bg-blue-50 dark:border-blue-900/50 dark:bg-blue-950/20'
                  : 'border-black/10 bg-white dark:border-white/10 dark:bg-zinc-950/60'
                }`}
            >
              <div className="flex items-center justify-between gap-2">
                <div className="text-xs text-zinc-600 dark:text-zinc-400 font-mono wrap-break-word">
                  {message.isOutgoing ? 'You' : message.senderPubkey.slice(0, 16) + '...'}
                </div>
                <div className="flex items-center gap-2">
                  {message.isOutgoing && (
                    <MessageStatus status={message.status} size="small" />
                  )}
                  {message.isOutgoing && (message.status === 'rejected' || message.status === 'failed') && (
                    <button
                      onClick={() => void handleRetry(message.id)}
                      className="text-xs text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300"
                      title="Retry sending"
                    >
                      <RefreshCw className="h-3 w-3" />
                    </button>
                  )}
                </div>
              </div>
              <div className="text-sm wrap-break-word">{message.content}</div>
              <div className="text-xs text-zinc-500 dark:text-zinc-400">
                {message.timestamp.toLocaleTimeString()}
              </div>
              {/* Show relay results for debugging */}
              {message.isOutgoing && message.relayResults && message.relayResults.length > 0 && (
                <details className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
                  <summary className="cursor-pointer hover:text-zinc-700 dark:hover:text-zinc-300">
                    Relay details ({message.relayResults.length})
                  </summary>
                  <ul className="mt-1 space-y-1 pl-4">
                    {message.relayResults.map((result, idx) => (
                      <li key={idx} className="flex items-center gap-2">
                        <span className={result.success ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}>
                          {result.success ? '✓' : '✗'}
                        </span>
                        <span className="font-mono truncate">{result.relayUrl}</span>
                        {result.latency && <span>({result.latency}ms)</span>}
                      </li>
                    ))}
                  </ul>
                </details>
              )}
            </li>
          ))}
        </ul>
      </div>
    </Card>
  );
};
