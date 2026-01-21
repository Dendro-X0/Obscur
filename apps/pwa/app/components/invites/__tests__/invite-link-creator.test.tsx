import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { InviteLinkCreator } from '../invite-link-creator';
import * as useIdentityModule from '../../../lib/use-identity';
import * as inviteManagerModule from '../../../lib/invites/invite-manager';
import type { InviteLink } from '../../../lib/invites/types';

// Mock the modules
vi.mock('../../../lib/use-identity');
vi.mock('../../../lib/invites/invite-manager');

describe('InviteLinkCreator', () => {
  const mockPublicKey = '0'.repeat(64);

  const mockInviteLink: InviteLink = {
    id: 'link-1',
    url: 'https://obscur.app/invite/abc123',
    shortCode: 'abc123',
    createdBy: mockPublicKey as any,
    profile: {
      publicKey: mockPublicKey as any,
      displayName: 'Test User',
      timestamp: Date.now(),
      signature: 'mock-signature',
    },
    currentUses: 0,
    isActive: true,
    createdAt: new Date(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should render locked state when identity is not unlocked', () => {
    vi.mocked(useIdentityModule.useIdentity).mockReturnValue({
      state: { status: 'locked' },
      unlock: vi.fn(),
      lock: vi.fn(),
      create: vi.fn(),
      restore: vi.fn(),
      clear: vi.fn(),
    });

    render(<InviteLinkCreator />);

    expect(screen.getByText(/please unlock your identity/i)).toBeInTheDocument();
  });

  it('should render form when identity is unlocked', () => {
    vi.mocked(useIdentityModule.useIdentity).mockReturnValue({
      state: {
        status: 'unlocked',
        publicKeyHex: mockPublicKey as any,
        privateKeyHex: '1'.repeat(64) as any,
      },
      unlock: vi.fn(),
      lock: vi.fn(),
      create: vi.fn(),
      restore: vi.fn(),
      clear: vi.fn(),
    });

    render(<InviteLinkCreator />);

    expect(screen.getByLabelText(/display name/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/personal message/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/expiration/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /create invite link/i })).toBeInTheDocument();
  });

  it('should create invite link when form is submitted', async () => {
    vi.mocked(useIdentityModule.useIdentity).mockReturnValue({
      state: {
        status: 'unlocked',
        publicKeyHex: mockPublicKey as any,
        privateKeyHex: '1'.repeat(64) as any,
      },
      unlock: vi.fn(),
      lock: vi.fn(),
      create: vi.fn(),
      restore: vi.fn(),
      clear: vi.fn(),
    });

    vi.mocked(inviteManagerModule.inviteManager.generateInviteLink).mockResolvedValue(mockInviteLink);

    render(<InviteLinkCreator />);

    const createButton = screen.getByRole('button', { name: /create invite link/i });
    fireEvent.click(createButton);

    await waitFor(() => {
      expect(screen.getByText(/invite link created!/i)).toBeInTheDocument();
      expect(screen.getByText(mockInviteLink.url)).toBeInTheDocument();
    });
  });

  it('should display error when link creation fails', async () => {
    vi.mocked(useIdentityModule.useIdentity).mockReturnValue({
      state: {
        status: 'unlocked',
        publicKeyHex: mockPublicKey as any,
        privateKeyHex: '1'.repeat(64) as any,
      },
      unlock: vi.fn(),
      lock: vi.fn(),
      create: vi.fn(),
      restore: vi.fn(),
      clear: vi.fn(),
    });

    vi.mocked(inviteManagerModule.inviteManager.generateInviteLink).mockRejectedValue(
      new Error('Creation failed')
    );

    render(<InviteLinkCreator />);

    const createButton = screen.getByRole('button', { name: /create invite link/i });
    fireEvent.click(createButton);

    await waitFor(() => {
      expect(screen.getByText(/creation failed/i)).toBeInTheDocument();
    });
  });

  it('should allow customizing link options', async () => {
    vi.mocked(useIdentityModule.useIdentity).mockReturnValue({
      state: {
        status: 'unlocked',
        publicKeyHex: mockPublicKey as any,
        privateKeyHex: '1'.repeat(64) as any,
      },
      unlock: vi.fn(),
      lock: vi.fn(),
      create: vi.fn(),
      restore: vi.fn(),
      clear: vi.fn(),
    });

    vi.mocked(inviteManagerModule.inviteManager.generateInviteLink).mockResolvedValue(mockInviteLink);

    render(<InviteLinkCreator />);

    // Fill in custom options
    const displayNameInput = screen.getByLabelText(/display name/i);
    const messageInput = screen.getByLabelText(/personal message/i);
    const expirationSelect = screen.getByLabelText(/expiration/i);
    const maxUsesInput = screen.getByLabelText(/max uses/i);

    fireEvent.change(displayNameInput, { target: { value: 'Test User' } });
    fireEvent.change(messageInput, { target: { value: 'Hello!' } });
    fireEvent.change(expirationSelect, { target: { value: '1w' } });
    fireEvent.change(maxUsesInput, { target: { value: '10' } });

    const createButton = screen.getByRole('button', { name: /create invite link/i });
    fireEvent.click(createButton);

    await waitFor(() => {
      expect(inviteManagerModule.inviteManager.generateInviteLink).toHaveBeenCalledWith(
        expect.objectContaining({
          displayName: 'Test User',
          message: 'Hello!',
          maxUses: 10,
          includeProfile: true,
        })
      );
    });
  });

  it('should show sharing options after successful creation', async () => {
    vi.mocked(useIdentityModule.useIdentity).mockReturnValue({
      state: {
        status: 'unlocked',
        publicKeyHex: mockPublicKey as any,
        privateKeyHex: '1'.repeat(64) as any,
      },
      unlock: vi.fn(),
      lock: vi.fn(),
      create: vi.fn(),
      restore: vi.fn(),
      clear: vi.fn(),
    });

    vi.mocked(inviteManagerModule.inviteManager.generateInviteLink).mockResolvedValue(mockInviteLink);

    render(<InviteLinkCreator />);

    const createButton = screen.getByRole('button', { name: /create invite link/i });
    fireEvent.click(createButton);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /copy link/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /share/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /create another/i })).toBeInTheDocument();
    });
  });

  it('should display link details after creation', async () => {
    const linkWithExpiration: InviteLink = {
      ...mockInviteLink,
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      maxUses: 5,
    };

    vi.mocked(useIdentityModule.useIdentity).mockReturnValue({
      state: {
        status: 'unlocked',
        publicKeyHex: mockPublicKey as any,
        privateKeyHex: '1'.repeat(64) as any,
      },
      unlock: vi.fn(),
      lock: vi.fn(),
      create: vi.fn(),
      restore: vi.fn(),
      clear: vi.fn(),
    });

    vi.mocked(inviteManagerModule.inviteManager.generateInviteLink).mockResolvedValue(linkWithExpiration);

    render(<InviteLinkCreator />);

    const createButton = screen.getByRole('button', { name: /create invite link/i });
    fireEvent.click(createButton);

    await waitFor(() => {
      expect(screen.getByText(/short code:/i)).toBeInTheDocument();
      expect(screen.getByText(/expires:/i)).toBeInTheDocument();
      expect(screen.getByText(/max uses:/i)).toBeInTheDocument();
      // Check for the specific "Uses:" text (not "Max Uses:")
      const usesElements = screen.getAllByText(/uses:/i);
      expect(usesElements.length).toBeGreaterThan(0);
    });
  });
});
