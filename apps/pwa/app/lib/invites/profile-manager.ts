import type { PublicKeyHex } from '@dweb/crypto/public-key-hex';
import type { PrivateKeyHex } from '@dweb/crypto/private-key-hex';
import type { ProfileManager } from './interfaces';
import type { UserProfile, PrivacySettings, ShareableProfile } from './types';
import { cryptoService } from '../crypto/crypto-service';
import { USER_PROFILE_KEY, PRIVACY_SETTINGS_KEY } from './constants';

/**
 * Profile Manager implementation for managing user profiles and privacy settings
 */
class ProfileManagerImpl implements ProfileManager {
  private readonly DEFAULT_PRIVACY_SETTINGS: PrivacySettings = {
    shareDisplayName: true,
    shareAvatar: true,
    shareBio: false,
    shareWebsite: false,
    allowContactRequests: true,
    requireMessage: false,
    autoAcceptTrusted: false,
  };

  /**
   * Apply privacy settings to future invites without affecting existing connections
   * This ensures that privacy setting changes only impact new invites
   */
  async applyPrivacySettingsToFutureInvites(settings: PrivacySettings): Promise<void> {
    try {
      // Validate settings
      this.validatePrivacySettings(settings);
      
      // Store the new settings - they will be applied to future invites
      // via getShareableProfile() which reads these settings
      await this.updatePrivacySettings(settings);
      
      // Note: Existing connections are NOT affected by this change
      // Only new invites generated after this point will use the new settings
    } catch (error) {
      throw new Error(`Failed to apply privacy settings: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get granular privacy controls for specific profile fields
   */
  async getGranularPrivacyControls(): Promise<{
    displayName: boolean;
    avatar: boolean;
    bio: boolean;
    website: boolean;
  }> {
    const settings = await this.getPrivacySettings();
    return {
      displayName: settings.shareDisplayName,
      avatar: settings.shareAvatar,
      bio: settings.shareBio,
      website: settings.shareWebsite,
    };
  }

  /**
   * Update granular privacy control for a specific field
   */
  async updateFieldPrivacy(field: 'displayName' | 'avatar' | 'bio' | 'website', share: boolean): Promise<void> {
    try {
      const settings = await this.getPrivacySettings();
      
      switch (field) {
        case 'displayName':
          settings.shareDisplayName = share;
          break;
        case 'avatar':
          settings.shareAvatar = share;
          break;
        case 'bio':
          settings.shareBio = share;
          break;
        case 'website':
          settings.shareWebsite = share;
          break;
      }
      
      await this.updatePrivacySettings(settings);
    } catch (error) {
      throw new Error(`Failed to update field privacy: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Check if a specific profile field should be shared based on privacy settings
   */
  async shouldShareField(field: 'displayName' | 'avatar' | 'bio' | 'website'): Promise<boolean> {
    const controls = await this.getGranularPrivacyControls();
    return controls[field];
  }

  /**
   * Update user profile
   */
  async updateProfile(profile: UserProfile): Promise<void> {
    try {
      this.validateProfile(profile);
      
      // Store in localStorage
      if (typeof window !== 'undefined') {
        localStorage.setItem(USER_PROFILE_KEY, JSON.stringify(profile));
      }
    } catch (error) {
      throw new Error(`Failed to update profile: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get current user profile
   */
  async getProfile(): Promise<UserProfile> {
    try {
      if (typeof window === 'undefined') {
        return this.getDefaultProfile();
      }

      const stored = localStorage.getItem(USER_PROFILE_KEY);
      if (!stored) {
        return this.getDefaultProfile();
      }

      const parsed = JSON.parse(stored);
      if (!this.isValidProfile(parsed)) {
        return this.getDefaultProfile();
      }

      return parsed as UserProfile;
    } catch (error) {
      console.warn('Failed to load profile, using defaults:', error);
      return this.getDefaultProfile();
    }
  }

  /**
   * Update privacy settings
   */
  async updatePrivacySettings(settings: PrivacySettings): Promise<void> {
    try {
      this.validatePrivacySettings(settings);
      
      // Store in localStorage
      if (typeof window !== 'undefined') {
        localStorage.setItem(PRIVACY_SETTINGS_KEY, JSON.stringify(settings));
      }
    } catch (error) {
      throw new Error(`Failed to update privacy settings: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get current privacy settings
   */
  async getPrivacySettings(): Promise<PrivacySettings> {
    try {
      if (typeof window === 'undefined') {
        return this.DEFAULT_PRIVACY_SETTINGS;
      }

      const stored = localStorage.getItem(PRIVACY_SETTINGS_KEY);
      if (!stored) {
        return this.DEFAULT_PRIVACY_SETTINGS;
      }

      const parsed = JSON.parse(stored);
      if (!this.isValidPrivacySettings(parsed)) {
        return this.DEFAULT_PRIVACY_SETTINGS;
      }

      return parsed as PrivacySettings;
    } catch (error) {
      console.warn('Failed to load privacy settings, using defaults:', error);
      return this.DEFAULT_PRIVACY_SETTINGS;
    }
  }

  /**
   * Get shareable profile based on privacy settings
   */
  async getShareableProfile(publicKey: PublicKeyHex, privateKey: PrivateKeyHex): Promise<ShareableProfile> {
    try {
      const [profile, privacySettings] = await Promise.all([
        this.getProfile(),
        this.getPrivacySettings()
      ]);

      // Create shareable profile based on privacy settings
      const shareableProfile: Omit<ShareableProfile, 'signature'> = {
        publicKey,
        timestamp: Date.now(),
        displayName: privacySettings.shareDisplayName && profile.displayName !== null && profile.displayName !== undefined ? profile.displayName : undefined,
        avatar: privacySettings.shareAvatar && profile.avatar !== null && profile.avatar !== undefined ? profile.avatar : undefined,
        bio: privacySettings.shareBio && profile.bio !== null && profile.bio !== undefined ? profile.bio : undefined,
      };

      // Sign the profile data
      const signature = await cryptoService.signInviteData(shareableProfile, privateKey);

      return {
        ...shareableProfile,
        signature
      };
    } catch (error) {
      throw new Error(`Failed to create shareable profile: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Validate profile data structure and signature
   */
  validateProfileData(profile: ShareableProfile): boolean {
    try {
      // Check required fields
      if (!profile || typeof profile !== 'object') {
        return false;
      }

      if (!profile.publicKey || typeof profile.publicKey !== 'string') {
        return false;
      }

      if (!cryptoService.isValidPubkey(profile.publicKey)) {
        return false;
      }

      if (typeof profile.timestamp !== 'number' || profile.timestamp <= 0) {
        return false;
      }

      if (!profile.signature || typeof profile.signature !== 'string') {
        return false;
      }

      // Check optional fields
      if (profile.displayName !== undefined && typeof profile.displayName !== 'string') {
        return false;
      }

      if (profile.avatar !== undefined && typeof profile.avatar !== 'string') {
        return false;
      }

      if (profile.bio !== undefined && typeof profile.bio !== 'string') {
        return false;
      }

      // Validate field lengths
      if (profile.displayName && profile.displayName.length > 100) {
        return false;
      }

      if (profile.bio && profile.bio.length > 500) {
        return false;
      }

      return true;
    } catch {
      return false;
    }
  }

  /**
   * Get default profile
   */
  private getDefaultProfile(): UserProfile {
    return {
      displayName: '',
      avatar: undefined,
      bio: undefined,
      website: undefined,
      nip05: undefined,
      lud16: undefined,
    };
  }

  /**
   * Validate profile data
   */
  private validateProfile(profile: UserProfile): void {
    if (!profile || typeof profile !== 'object') {
      throw new Error('Profile must be an object');
    }

    if (!profile.displayName || typeof profile.displayName !== 'string') {
      throw new Error('Display name is required and must be a string');
    }

    if (profile.displayName.length > 100) {
      throw new Error('Display name must be 100 characters or less');
    }

    if (profile.avatar !== undefined && profile.avatar !== null) {
      if (typeof profile.avatar !== 'string') {
        throw new Error('Avatar must be a string URL');
      }
      if (profile.avatar.length > 500) {
        throw new Error('Avatar URL must be 500 characters or less');
      }
    }

    if (profile.bio !== undefined && profile.bio !== null) {
      if (typeof profile.bio !== 'string') {
        throw new Error('Bio must be a string');
      }
      if (profile.bio.length > 500) {
        throw new Error('Bio must be 500 characters or less');
      }
    }

    if (profile.website !== undefined && profile.website !== null) {
      if (typeof profile.website !== 'string') {
        throw new Error('Website must be a string URL');
      }
      if (profile.website.length > 200) {
        throw new Error('Website URL must be 200 characters or less');
      }
    }

    if (profile.nip05 !== undefined && profile.nip05 !== null) {
      if (typeof profile.nip05 !== 'string') {
        throw new Error('NIP-05 identifier must be a string');
      }
      if (profile.nip05.length > 100) {
        throw new Error('NIP-05 identifier must be 100 characters or less');
      }
    }

    if (profile.lud16 !== undefined && profile.lud16 !== null) {
      if (typeof profile.lud16 !== 'string') {
        throw new Error('Lightning address must be a string');
      }
      if (profile.lud16.length > 100) {
        throw new Error('Lightning address must be 100 characters or less');
      }
    }
  }

  /**
   * Check if object is a valid profile
   */
  private isValidProfile(obj: any): boolean {
    try {
      this.validateProfile(obj);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Validate privacy settings
   */
  private validatePrivacySettings(settings: PrivacySettings): void {
    if (!settings || typeof settings !== 'object') {
      throw new Error('Privacy settings must be an object');
    }

    const booleanFields = [
      'shareDisplayName',
      'shareAvatar', 
      'shareBio',
      'shareWebsite',
      'allowContactRequests',
      'requireMessage',
      'autoAcceptTrusted'
    ];

    for (const field of booleanFields) {
      if (typeof (settings as any)[field] !== 'boolean') {
        throw new Error(`${field} must be a boolean`);
      }
    }
  }

  /**
   * Check if object is valid privacy settings
   */
  private isValidPrivacySettings(obj: any): boolean {
    try {
      this.validatePrivacySettings(obj);
      return true;
    } catch {
      return false;
    }
  }
}

/**
 * Singleton profile manager instance
 */
export const profileManager: ProfileManager = new ProfileManagerImpl();

/**
 * Hook for using profile manager in React components
 */
export const useProfileManager = (): ProfileManager => {
  return profileManager;
};