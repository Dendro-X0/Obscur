import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ConnectionRequestInbox } from '../connection-request-inbox';

const mocks = vi.hoisted(() => ({
  acceptIncomingRequest: vi.fn(),
  declineIncomingRequest: vi.fn(),
}));

vi.mock('@/app/features/auth/hooks/use-identity', () => ({
  useIdentity: () => ({
    state: {
      publicKeyHex: '1'.repeat(64),
      privateKeyHex: '2'.repeat(64),
    },
  }),
}));

vi.mock('@/app/features/relays/providers/relay-provider', () => ({
  useRelay: () => ({
    relayPool: {},
  }),
}));

vi.mock('@/app/features/network/providers/network-provider', () => ({
  useNetwork: () => ({
    peerTrust: {},
    blocklist: {
      addBlocked: vi.fn(),
    },
    requestsInbox: {
      hasHydrated: true,
      state: {
        items: [
          {
            peerPublicKeyHex: '0'.repeat(64),
            status: 'pending',
            isOutgoing: false,
            lastMessagePreview: "Hello, let's connect!",
            lastReceivedAtUnixSeconds: 1_700_000_000,
            unreadCount: 1,
            eventId: 'request-1',
          },
        ],
      },
    },
  }),
}));

vi.mock('@/app/features/messaging/hooks/use-enhanced-dm-controller', () => ({
  useEnhancedDMController: () => ({}),
  useEnhancedDmController: () => ({}),
}));

vi.mock('@/app/features/messaging/hooks/use-request-transport', () => ({
  useRequestTransport: () => ({
    acceptIncomingRequest: mocks.acceptIncomingRequest,
    declineIncomingRequest: mocks.declineIncomingRequest,
  }),
}));

describe('ConnectionRequestInbox', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.acceptIncomingRequest.mockResolvedValue({ status: 'ok' });
    mocks.declineIncomingRequest.mockResolvedValue({ status: 'ok' });
  });

  it('renders canonical pending requests from requestsInbox', async () => {
    render(<ConnectionRequestInbox />);

    expect(screen.getByText(/user 00000000/i)).toBeInTheDocument();
    expect(screen.getByText(/hello, let's connect!/i)).toBeInTheDocument();
    expect(screen.getByText('0'.repeat(64))).toBeInTheDocument();
  });

  it('handles accept action via request transport', async () => {
    render(<ConnectionRequestInbox />);

    fireEvent.click(screen.getByRole('button', { name: /accept/i }));

    await waitFor(() => {
      expect(mocks.acceptIncomingRequest).toHaveBeenCalledWith({
        peerPublicKeyHex: '0'.repeat(64),
        plaintext: 'Accepted',
        requestEventId: 'request-1',
      });
    });
  });

  it('handles decline action via request transport', async () => {
    render(<ConnectionRequestInbox />);

    fireEvent.click(screen.getByRole('button', { name: /^decline$/i }));

    await waitFor(() => {
      expect(mocks.declineIncomingRequest).toHaveBeenCalledWith({
        peerPublicKeyHex: '0'.repeat(64),
        plaintext: 'Declined',
        requestEventId: 'request-1',
      });
    });
  });
});
