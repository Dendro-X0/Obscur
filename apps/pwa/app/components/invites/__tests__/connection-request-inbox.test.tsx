import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ConnectionRequestInbox } from '../connection-request-inbox';
import * as inviteManagerModule from '../../../features/invites/utils/invite-manager';
import type { ConnectionRequest } from '../../../features/invites/utils/types';

// Mock the invite manager
vi.mock('../../../features/invites/utils/invite-manager');

describe('ConnectionRequestInbox', () => {
  const mockConnectionRequest: ConnectionRequest = {
    id: 'request-1',
    type: 'incoming',
    senderPublicKey: '0'.repeat(64) as any,
    recipientPublicKey: '1'.repeat(64) as any,
    profile: {
      publicKey: '0'.repeat(64) as any,
      displayName: 'Test User',
      bio: 'Test bio',
      timestamp: Date.now(),
      signature: 'mock-signature',
    },
    message: 'Hello, let\'s connect!',
    status: 'pending',
    createdAt: new Date(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should render loading state initially', () => {
    vi.mocked(inviteManagerModule.inviteManager.getIncomingConnectionRequests).mockImplementation(
      () => new Promise(() => { }) // Never resolves
    );

    render(<ConnectionRequestInbox />);

    expect(screen.getByText(/loading/i)).toBeInTheDocument();
  });

  it('should render empty state when no requests', async () => {
    vi.mocked(inviteManagerModule.inviteManager.getIncomingConnectionRequests).mockResolvedValue([]);

    render(<ConnectionRequestInbox />);

    await waitFor(() => {
      expect(screen.getByText(/no pending connection requests/i)).toBeInTheDocument();
    });
  });

  it('should render connection requests', async () => {
    vi.mocked(inviteManagerModule.inviteManager.getIncomingConnectionRequests).mockResolvedValue([
      mockConnectionRequest,
    ]);

    render(<ConnectionRequestInbox />);

    await waitFor(() => {
      expect(screen.getByText('Test User')).toBeInTheDocument();
      expect(screen.getByText(/hello, let's connect!/i)).toBeInTheDocument();
    });
  });

  it('should display sender information correctly', async () => {
    vi.mocked(inviteManagerModule.inviteManager.getIncomingConnectionRequests).mockResolvedValue([
      mockConnectionRequest,
    ]);

    render(<ConnectionRequestInbox />);

    await waitFor(() => {
      expect(screen.getByText('Test User')).toBeInTheDocument();
      expect(screen.getByText(/test bio/i)).toBeInTheDocument();
      expect(screen.getByText(mockConnectionRequest.senderPublicKey)).toBeInTheDocument();
    });
  });

  it('should handle accept action', async () => {
    vi.mocked(inviteManagerModule.inviteManager.getIncomingConnectionRequests).mockResolvedValue([
      mockConnectionRequest,
    ]);
    vi.mocked(inviteManagerModule.inviteManager.acceptConnectionRequest).mockResolvedValue({
      id: 'connection-1',
      publicKey: mockConnectionRequest.senderPublicKey,
      displayName: 'Test User',
      trustLevel: 'neutral',
      groups: [],
      addedAt: new Date(),
      metadata: { source: 'qr' },
    });

    render(<ConnectionRequestInbox />);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /accept/i })).toBeInTheDocument();
    });

    const acceptButton = screen.getByRole('button', { name: /accept/i });
    fireEvent.click(acceptButton);

    await waitFor(() => {
      expect(inviteManagerModule.inviteManager.acceptConnectionRequest).toHaveBeenCalledWith(
        mockConnectionRequest.id
      );
    });
  });

  it('should handle decline action', async () => {
    vi.mocked(inviteManagerModule.inviteManager.getIncomingConnectionRequests).mockResolvedValue([
      mockConnectionRequest,
    ]);
    vi.mocked(inviteManagerModule.inviteManager.declineConnectionRequest).mockResolvedValue();

    render(<ConnectionRequestInbox />);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /^decline$/i })).toBeInTheDocument();
    });

    const declineButton = screen.getByRole('button', { name: /^decline$/i });
    fireEvent.click(declineButton);

    await waitFor(() => {
      expect(inviteManagerModule.inviteManager.declineConnectionRequest).toHaveBeenCalledWith(
        mockConnectionRequest.id,
        false
      );
    });
  });

  it('should handle block action', async () => {
    vi.mocked(inviteManagerModule.inviteManager.getIncomingConnectionRequests).mockResolvedValue([
      mockConnectionRequest,
    ]);
    vi.mocked(inviteManagerModule.inviteManager.declineConnectionRequest).mockResolvedValue();

    render(<ConnectionRequestInbox />);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /block/i })).toBeInTheDocument();
    });

    const blockButton = screen.getByRole('button', { name: /block/i });
    fireEvent.click(blockButton);

    await waitFor(() => {
      expect(inviteManagerModule.inviteManager.declineConnectionRequest).toHaveBeenCalledWith(
        mockConnectionRequest.id,
        true
      );
    });
  });

  it('should display error state when loading fails', async () => {
    vi.mocked(inviteManagerModule.inviteManager.getIncomingConnectionRequests).mockRejectedValue(
      new Error('Failed to load')
    );

    render(<ConnectionRequestInbox />);

    await waitFor(() => {
      expect(screen.getByText(/failed to load/i)).toBeInTheDocument();
    });
  });

  it('should show fallback display name when profile has no name', async () => {
    const requestWithoutName: ConnectionRequest = {
      ...mockConnectionRequest,
      profile: {
        ...mockConnectionRequest.profile,
        displayName: undefined,
      },
    };

    vi.mocked(inviteManagerModule.inviteManager.getIncomingConnectionRequests).mockResolvedValue([
      requestWithoutName,
    ]);

    render(<ConnectionRequestInbox />);

    await waitFor(() => {
      expect(screen.getByText(/user 00000000/i)).toBeInTheDocument();
    });
  });
});
