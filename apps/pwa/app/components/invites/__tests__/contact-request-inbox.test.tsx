import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ContactRequestInbox } from '../contact-request-inbox';
import * as inviteManagerModule from '../../../lib/invites/invite-manager';
import type { ContactRequest } from '../../../lib/invites/types';

// Mock the invite manager
vi.mock('../../../lib/invites/invite-manager');

describe('ContactRequestInbox', () => {
  const mockContactRequest: ContactRequest = {
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
    vi.mocked(inviteManagerModule.inviteManager.getIncomingContactRequests).mockImplementation(
      () => new Promise(() => {}) // Never resolves
    );

    render(<ContactRequestInbox />);

    expect(screen.getByText(/loading/i)).toBeInTheDocument();
  });

  it('should render empty state when no requests', async () => {
    vi.mocked(inviteManagerModule.inviteManager.getIncomingContactRequests).mockResolvedValue([]);

    render(<ContactRequestInbox />);

    await waitFor(() => {
      expect(screen.getByText(/no pending contact requests/i)).toBeInTheDocument();
    });
  });

  it('should render contact requests', async () => {
    vi.mocked(inviteManagerModule.inviteManager.getIncomingContactRequests).mockResolvedValue([
      mockContactRequest,
    ]);

    render(<ContactRequestInbox />);

    await waitFor(() => {
      expect(screen.getByText('Test User')).toBeInTheDocument();
      expect(screen.getByText(/hello, let's connect!/i)).toBeInTheDocument();
    });
  });

  it('should display sender information correctly', async () => {
    vi.mocked(inviteManagerModule.inviteManager.getIncomingContactRequests).mockResolvedValue([
      mockContactRequest,
    ]);

    render(<ContactRequestInbox />);

    await waitFor(() => {
      expect(screen.getByText('Test User')).toBeInTheDocument();
      expect(screen.getByText(/test bio/i)).toBeInTheDocument();
      expect(screen.getByText(mockContactRequest.senderPublicKey)).toBeInTheDocument();
    });
  });

  it('should handle accept action', async () => {
    vi.mocked(inviteManagerModule.inviteManager.getIncomingContactRequests).mockResolvedValue([
      mockContactRequest,
    ]);
    vi.mocked(inviteManagerModule.inviteManager.acceptContactRequest).mockResolvedValue({
      id: 'contact-1',
      publicKey: mockContactRequest.senderPublicKey,
      displayName: 'Test User',
      trustLevel: 'neutral',
      groups: [],
      addedAt: new Date(),
      metadata: { source: 'qr' },
    });

    render(<ContactRequestInbox />);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /accept/i })).toBeInTheDocument();
    });

    const acceptButton = screen.getByRole('button', { name: /accept/i });
    fireEvent.click(acceptButton);

    await waitFor(() => {
      expect(inviteManagerModule.inviteManager.acceptContactRequest).toHaveBeenCalledWith(
        mockContactRequest.id
      );
    });
  });

  it('should handle decline action', async () => {
    vi.mocked(inviteManagerModule.inviteManager.getIncomingContactRequests).mockResolvedValue([
      mockContactRequest,
    ]);
    vi.mocked(inviteManagerModule.inviteManager.declineContactRequest).mockResolvedValue();

    render(<ContactRequestInbox />);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /^decline$/i })).toBeInTheDocument();
    });

    const declineButton = screen.getByRole('button', { name: /^decline$/i });
    fireEvent.click(declineButton);

    await waitFor(() => {
      expect(inviteManagerModule.inviteManager.declineContactRequest).toHaveBeenCalledWith(
        mockContactRequest.id,
        false
      );
    });
  });

  it('should handle block action', async () => {
    vi.mocked(inviteManagerModule.inviteManager.getIncomingContactRequests).mockResolvedValue([
      mockContactRequest,
    ]);
    vi.mocked(inviteManagerModule.inviteManager.declineContactRequest).mockResolvedValue();

    render(<ContactRequestInbox />);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /block/i })).toBeInTheDocument();
    });

    const blockButton = screen.getByRole('button', { name: /block/i });
    fireEvent.click(blockButton);

    await waitFor(() => {
      expect(inviteManagerModule.inviteManager.declineContactRequest).toHaveBeenCalledWith(
        mockContactRequest.id,
        true
      );
    });
  });

  it('should display error state when loading fails', async () => {
    vi.mocked(inviteManagerModule.inviteManager.getIncomingContactRequests).mockRejectedValue(
      new Error('Failed to load')
    );

    render(<ContactRequestInbox />);

    await waitFor(() => {
      expect(screen.getByText(/failed to load/i)).toBeInTheDocument();
    });
  });

  it('should show fallback display name when profile has no name', async () => {
    const requestWithoutName: ContactRequest = {
      ...mockContactRequest,
      profile: {
        ...mockContactRequest.profile,
        displayName: undefined,
      },
    };

    vi.mocked(inviteManagerModule.inviteManager.getIncomingContactRequests).mockResolvedValue([
      requestWithoutName,
    ]);

    render(<ContactRequestInbox />);

    await waitFor(() => {
      expect(screen.getByText(/user 00000000/i)).toBeInTheDocument();
    });
  });
});
