import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ProfileSettings } from '../profile-settings';
import * as profileManagerModule from '../../../lib/invites/profile-manager';
import type { UserProfile, PrivacySettings } from '../../../lib/invites/types';

// Mock the profile manager
vi.mock('../../../lib/invites/profile-manager');

describe('ProfileSettings', () => {
  const mockProfile: UserProfile = {
    displayName: 'Test User',
    avatar: 'https://example.com/avatar.jpg',
    bio: 'Test bio',
    website: 'https://example.com',
    nip05: 'test@example.com',
    lud16: 'test@wallet.com',
  };

  const mockPrivacy: PrivacySettings = {
    shareDisplayName: true,
    shareAvatar: true,
    shareBio: false,
    shareWebsite: false,
    allowContactRequests: true,
    requireMessage: false,
    autoAcceptTrusted: false,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should render loading state initially', () => {
    vi.mocked(profileManagerModule.profileManager.getProfile).mockImplementation(
      () => new Promise(() => {})
    );
    vi.mocked(profileManagerModule.profileManager.getPrivacySettings).mockImplementation(
      () => new Promise(() => {})
    );

    render(<ProfileSettings />);

    expect(screen.getByText(/loading/i)).toBeInTheDocument();
  });

  it('should render profile form with data', async () => {
    vi.mocked(profileManagerModule.profileManager.getProfile).mockResolvedValue(mockProfile);
    vi.mocked(profileManagerModule.profileManager.getPrivacySettings).mockResolvedValue(mockPrivacy);

    render(<ProfileSettings />);

    await waitFor(() => {
      expect(screen.getByDisplayValue('Test User')).toBeInTheDocument();
      expect(screen.getByDisplayValue('https://example.com/avatar.jpg')).toBeInTheDocument();
      expect(screen.getByDisplayValue('Test bio')).toBeInTheDocument();
    });
  });

  it('should update profile when save button is clicked', async () => {
    vi.mocked(profileManagerModule.profileManager.getProfile).mockResolvedValue(mockProfile);
    vi.mocked(profileManagerModule.profileManager.getPrivacySettings).mockResolvedValue(mockPrivacy);
    vi.mocked(profileManagerModule.profileManager.updateProfile).mockResolvedValue();

    render(<ProfileSettings />);

    await waitFor(() => {
      expect(screen.getByDisplayValue('Test User')).toBeInTheDocument();
    });

    const displayNameInput = screen.getByDisplayValue('Test User');
    fireEvent.change(displayNameInput, { target: { value: 'Updated Name' } });

    const saveButton = screen.getByRole('button', { name: /save profile/i });
    fireEvent.click(saveButton);

    await waitFor(() => {
      expect(profileManagerModule.profileManager.updateProfile).toHaveBeenCalledWith(
        expect.objectContaining({
          displayName: 'Updated Name',
        })
      );
    });
  });

  it('should switch to privacy tab', async () => {
    vi.mocked(profileManagerModule.profileManager.getProfile).mockResolvedValue(mockProfile);
    vi.mocked(profileManagerModule.profileManager.getPrivacySettings).mockResolvedValue(mockPrivacy);

    render(<ProfileSettings />);

    await waitFor(() => {
      expect(screen.getByDisplayValue('Test User')).toBeInTheDocument();
    });

    const privacyTab = screen.getByRole('button', { name: /privacy/i });
    fireEvent.click(privacyTab);

    await waitFor(() => {
      expect(screen.getByText(/profile sharing/i)).toBeInTheDocument();
    });
  });

  it('should render privacy settings', async () => {
    vi.mocked(profileManagerModule.profileManager.getProfile).mockResolvedValue(mockProfile);
    vi.mocked(profileManagerModule.profileManager.getPrivacySettings).mockResolvedValue(mockPrivacy);

    render(<ProfileSettings />);

    await waitFor(() => {
      expect(screen.getByDisplayValue('Test User')).toBeInTheDocument();
    });

    const privacyTab = screen.getByRole('button', { name: /privacy/i });
    fireEvent.click(privacyTab);

    await waitFor(() => {
      const shareDisplayNameCheckbox = screen.getByRole('checkbox', { name: /share display name/i });
      expect(shareDisplayNameCheckbox).toBeChecked();
    });
  });

  it('should update privacy settings when save button is clicked', async () => {
    vi.mocked(profileManagerModule.profileManager.getProfile).mockResolvedValue(mockProfile);
    vi.mocked(profileManagerModule.profileManager.getPrivacySettings).mockResolvedValue(mockPrivacy);
    vi.mocked(profileManagerModule.profileManager.updatePrivacySettings).mockResolvedValue();

    render(<ProfileSettings />);

    await waitFor(() => {
      expect(screen.getByDisplayValue('Test User')).toBeInTheDocument();
    });

    const privacyTab = screen.getByRole('button', { name: /privacy/i });
    fireEvent.click(privacyTab);

    await waitFor(() => {
      const shareBioCheckbox = screen.getByRole('checkbox', { name: /share bio/i });
      expect(shareBioCheckbox).not.toBeChecked();
    });

    const shareBioCheckbox = screen.getByRole('checkbox', { name: /share bio/i });
    fireEvent.click(shareBioCheckbox);

    const saveButton = screen.getByRole('button', { name: /save privacy settings/i });
    fireEvent.click(saveButton);

    await waitFor(() => {
      expect(profileManagerModule.profileManager.updatePrivacySettings).toHaveBeenCalledWith(
        expect.objectContaining({
          shareBio: true,
        })
      );
    });
  });

  it('should validate display name is required', async () => {
    vi.mocked(profileManagerModule.profileManager.getProfile).mockResolvedValue(mockProfile);
    vi.mocked(profileManagerModule.profileManager.getPrivacySettings).mockResolvedValue(mockPrivacy);

    render(<ProfileSettings />);

    await waitFor(() => {
      expect(screen.getByDisplayValue('Test User')).toBeInTheDocument();
    });

    const displayNameInput = screen.getByDisplayValue('Test User');
    fireEvent.change(displayNameInput, { target: { value: '' } });

    const saveButton = screen.getByRole('button', { name: /save profile/i });
    expect(saveButton).toBeDisabled();
  });

  it('should display character count for display name', async () => {
    vi.mocked(profileManagerModule.profileManager.getProfile).mockResolvedValue(mockProfile);
    vi.mocked(profileManagerModule.profileManager.getPrivacySettings).mockResolvedValue(mockPrivacy);

    render(<ProfileSettings />);

    await waitFor(() => {
      expect(screen.getByText(/9\/100 characters/i)).toBeInTheDocument();
    });
  });

  it('should display character count for bio', async () => {
    vi.mocked(profileManagerModule.profileManager.getProfile).mockResolvedValue(mockProfile);
    vi.mocked(profileManagerModule.profileManager.getPrivacySettings).mockResolvedValue(mockPrivacy);

    render(<ProfileSettings />);

    await waitFor(() => {
      expect(screen.getByText(/8\/500 characters/i)).toBeInTheDocument();
    });
  });

  it('should display error state when loading fails', async () => {
    vi.mocked(profileManagerModule.profileManager.getProfile).mockRejectedValue(
      new Error('Failed to load profile')
    );
    vi.mocked(profileManagerModule.profileManager.getPrivacySettings).mockResolvedValue(mockPrivacy);

    render(<ProfileSettings />);

    await waitFor(() => {
      expect(screen.getByText(/failed to load profile/i)).toBeInTheDocument();
    });
  });

  it('should show avatar preview when URL is provided', async () => {
    vi.mocked(profileManagerModule.profileManager.getProfile).mockResolvedValue(mockProfile);
    vi.mocked(profileManagerModule.profileManager.getPrivacySettings).mockResolvedValue(mockPrivacy);

    render(<ProfileSettings />);

    await waitFor(() => {
      const avatarPreview = screen.getByAltText('Avatar preview');
      expect(avatarPreview).toBeInTheDocument();
      expect(avatarPreview).toHaveAttribute('src', 'https://example.com/avatar.jpg');
    });
  });

  it('should disable dependent privacy settings when contact requests are disabled', async () => {
    const privacyWithDisabledRequests = { ...mockPrivacy, allowContactRequests: false };
    vi.mocked(profileManagerModule.profileManager.getProfile).mockResolvedValue(mockProfile);
    vi.mocked(profileManagerModule.profileManager.getPrivacySettings).mockResolvedValue(privacyWithDisabledRequests);

    render(<ProfileSettings />);

    await waitFor(() => {
      expect(screen.getByDisplayValue('Test User')).toBeInTheDocument();
    });

    const privacyTab = screen.getByRole('button', { name: /privacy/i });
    fireEvent.click(privacyTab);

    await waitFor(() => {
      const requireMessageCheckbox = screen.getByRole('checkbox', { name: /require message/i });
      expect(requireMessageCheckbox).toBeDisabled();
    });
  });
});
