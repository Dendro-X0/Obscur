/**
 * Integration tests for accessibility and UX features
 * Tests loading states, error messages, and accessibility helpers
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  LoadingStateManager,
  ErrorMessageFormatter,
  AccessibilityHelper,
  ProgressTracker,
  ContextualHelp
} from '../accessibility-ux';

describe('Accessibility and UX Integration', () => {
  describe('Loading State Manager', () => {
    let manager: LoadingStateManager;

    beforeEach(() => {
      manager = new LoadingStateManager();
    });

    it('should manage loading states', () => {
      manager.setLoading('test-operation', 'Loading...', 50);

      const state = manager.getState('test-operation');
      expect(state.isLoading).toBe(true);
      expect(state.message).toBe('Loading...');
      expect(state.progress).toBe(50);

      manager.clearLoading('test-operation');

      const clearedState = manager.getState('test-operation');
      expect(clearedState.isLoading).toBe(false);
    });

    it('should notify subscribers of state changes', () => {
      const callback = vi.fn();

      manager.subscribe('test-operation', callback);
      manager.setLoading('test-operation', 'Loading...');

      expect(callback).toHaveBeenCalledWith({
        isLoading: true,
        message: 'Loading...',
        progress: undefined
      });

      manager.clearLoading('test-operation');

      expect(callback).toHaveBeenCalledWith({
        isLoading: false
      });
    });

    it('should allow unsubscribing', () => {
      const callback = vi.fn();

      const unsubscribe = manager.subscribe('test-operation', callback);
      manager.setLoading('test-operation', 'Loading...');

      expect(callback).toHaveBeenCalledTimes(1);

      unsubscribe();
      manager.clearLoading('test-operation');

      // Should not be called again after unsubscribe
      expect(callback).toHaveBeenCalledTimes(1);
    });
  });

  describe('Error Message Formatter', () => {
    let formatter: ErrorMessageFormatter;

    beforeEach(() => {
      formatter = new ErrorMessageFormatter();
    });

    it('should format known error codes', () => {
      const errorInfo = formatter.getErrorInfo('INVITE_EXPIRED');

      expect(errorInfo.code).toBe('INVITE_EXPIRED');
      expect(errorInfo.userMessage).toBeTruthy();
      expect(errorInfo.suggestions).toHaveLength(2);
      expect(errorInfo.severity).toBe('error');
    });

    it('should handle unknown error codes', () => {
      const errorInfo = formatter.getErrorInfo('UNKNOWN_CODE');

      expect(errorInfo.code).toBe('UNKNOWN_ERROR');
      expect(errorInfo.userMessage).toBeTruthy();
      expect(errorInfo.suggestions.length).toBeGreaterThan(0);
    });

    it('should include original error message', () => {
      const originalError = new Error('Network timeout');
      const errorInfo = formatter.getErrorInfo('UNKNOWN_CODE', originalError);

      expect(errorInfo.message).toBe('Network timeout');
    });

    it('should allow adding custom error messages', () => {
      formatter.addErrorMessage('CUSTOM_ERROR', {
        message: 'Custom error occurred',
        userMessage: 'Something custom went wrong',
        suggestions: ['Try custom solution'],
        severity: 'warning'
      });

      const errorInfo = formatter.getErrorInfo('CUSTOM_ERROR');

      expect(errorInfo.code).toBe('CUSTOM_ERROR');
      expect(errorInfo.userMessage).toBe('Something custom went wrong');
      expect(errorInfo.severity).toBe('warning');
    });

    it('should provide helpful suggestions for common errors', () => {
      const networkError = formatter.getErrorInfo('NETWORK_ERROR');
      expect(networkError.suggestions).toContain('Check your internet connection');

      const storageError = formatter.getErrorInfo('STORAGE_FULL');
      expect(storageError.suggestions).toContain('Delete old contacts or messages');

      const qrError = formatter.getErrorInfo('INVALID_QR_CODE');
      expect(qrError.suggestions).toContain('Ensure the QR code is clearly visible');
    });
  });

  describe('Accessibility Helper', () => {
    it('should generate contact ARIA labels', () => {
      const label = AccessibilityHelper.getContactAriaLabel({
        displayName: 'Alice Smith',
        trustLevel: 'trusted',
        groups: ['friends', 'work']
      });

      expect(label).toContain('Contact: Alice Smith');
      expect(label).toContain('Trust level: trusted');
      expect(label).toContain('Groups: 2');
    });

    it('should generate invite link ARIA labels', () => {
      const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

      const label = AccessibilityHelper.getInviteLinkAriaLabel({
        displayName: 'Bob Johnson',
        expiresAt,
        isActive: true
      });

      expect(label).toContain('Invite link');
      expect(label).toContain('for Bob Johnson');
      expect(label).toContain('active');
    });

    it('should generate QR code ARIA labels', () => {
      const label = AccessibilityHelper.getQRCodeAriaLabel({
        displayName: 'Charlie Brown',
        expirationHours: 48
      });

      expect(label).toContain('QR code for connection');
      expect(label).toContain('with Charlie Brown');
      expect(label).toContain('valid for 48 hours');
    });

    it('should provide keyboard navigation hints', () => {
      const contactListHints = AccessibilityHelper.getKeyboardHints('contact-list');
      expect(contactListHints).toContain('Use arrow keys to navigate contacts');
      expect(contactListHints).toContain('Press Enter to select a contact');

      const inviteFormHints = AccessibilityHelper.getKeyboardHints('invite-form');
      expect(inviteFormHints).toContain('Tab to move between fields');
      expect(inviteFormHints).toContain('Enter to submit the form');

      const qrScannerHints = AccessibilityHelper.getKeyboardHints('qr-scanner');
      expect(qrScannerHints).toContain('Space to capture QR code');
    });
  });

  describe('Progress Tracker', () => {
    it('should track progress', () => {
      const tracker = new ProgressTracker(100, 'Processing...');

      tracker.update(25);
      let progress = tracker.getProgress();

      expect(progress.current).toBe(25);
      expect(progress.total).toBe(100);
      expect(progress.percentage).toBe(25);
      expect(progress.message).toBe('Processing...');

      tracker.update(50, 'Halfway there...');
      progress = tracker.getProgress();

      expect(progress.current).toBe(50);
      expect(progress.percentage).toBe(50);
      expect(progress.message).toBe('Halfway there...');
    });

    it('should increment progress', () => {
      const tracker = new ProgressTracker(10);

      tracker.increment();
      expect(tracker.getProgress().current).toBe(1);

      tracker.increment();
      expect(tracker.getProgress().current).toBe(2);

      tracker.increment('Almost done...');
      expect(tracker.getProgress().current).toBe(3);
      expect(tracker.getProgress().message).toBe('Almost done...');
    });

    it('should not exceed total', () => {
      const tracker = new ProgressTracker(10);

      tracker.update(15);
      expect(tracker.getProgress().current).toBe(10);
      expect(tracker.getProgress().percentage).toBe(100);
    });

    it('should notify subscribers', () => {
      const tracker = new ProgressTracker(100);
      const callback = vi.fn();

      tracker.subscribe(callback);
      tracker.update(50);

      expect(callback).toHaveBeenCalledWith({
        current: 50,
        total: 100,
        message: undefined,
        percentage: 50
      });
    });

    it('should reset progress', () => {
      const tracker = new ProgressTracker(100, 'Initial');

      tracker.update(50);
      tracker.reset(200, 'Reset');

      const progress = tracker.getProgress();
      expect(progress.current).toBe(0);
      expect(progress.total).toBe(200);
      expect(progress.message).toBe('Reset');
    });
  });

  describe('Contextual Help', () => {
    let help: ContextualHelp;

    beforeEach(() => {
      help = new ContextualHelp();
    });

    it('should provide help content for known contexts', () => {
      const qrHelp = help.getHelp('qr-generation');

      expect(qrHelp).toBeDefined();
      expect(qrHelp!.title).toBeTruthy();
      expect(qrHelp!.description).toBeTruthy();
      expect(qrHelp!.steps).toBeDefined();
      expect(qrHelp!.tips).toBeDefined();
    });

    it('should return null for unknown contexts', () => {
      const unknownHelp = help.getHelp('unknown-context');
      expect(unknownHelp).toBeNull();
    });

    it('should allow adding custom help content', () => {
      help.addHelp('custom-feature', {
        title: 'Custom Feature',
        description: 'How to use custom feature',
        steps: ['Step 1', 'Step 2'],
        tips: ['Tip 1']
      });

      const customHelp = help.getHelp('custom-feature');
      expect(customHelp).toBeDefined();
      expect(customHelp!.title).toBe('Custom Feature');
    });

    it('should list all available contexts', () => {
      const contexts = help.getAllContexts();

      expect(contexts).toContain('qr-generation');
      expect(contexts).toContain('qr-scanning');
      expect(contexts).toContain('invite-links');
      expect(contexts).toContain('contact-organization');
      expect(contexts).toContain('contact-import');
    });

    it('should provide comprehensive help for each feature', () => {
      const contexts = help.getAllContexts();

      contexts.forEach(context => {
        const helpContent = help.getHelp(context);
        expect(helpContent).toBeDefined();
        expect(helpContent!.title).toBeTruthy();
        expect(helpContent!.description).toBeTruthy();
        expect(helpContent!.steps).toBeDefined();
        expect(helpContent!.tips).toBeDefined();
      });
    });
  });

  describe('Integration Scenarios', () => {
    it('should handle complete loading workflow', () => {
      const manager = new LoadingStateManager();
      const states: any[] = [];

      manager.subscribe('import-contacts', (state) => {
        states.push({ ...state });
      });

      // Start loading
      manager.setLoading('import-contacts', 'Importing contacts...', 0);

      // Update progress
      manager.setLoading('import-contacts', 'Processing contacts...', 50);

      // Complete
      manager.clearLoading('import-contacts');

      expect(states).toHaveLength(3);
      expect(states[0].isLoading).toBe(true);
      expect(states[0].progress).toBe(0);
      expect(states[1].progress).toBe(50);
      expect(states[2].isLoading).toBe(false);
    });

    it('should handle error workflow with user-friendly messages', () => {
      const formatter = new ErrorMessageFormatter();

      // Simulate network error during invite processing
      const errorInfo = formatter.getErrorInfo('NETWORK_ERROR');

      expect(errorInfo.userMessage).toBeTruthy();
      expect(errorInfo.suggestions.length).toBeGreaterThan(0);
      expect(errorInfo.severity).toBe('error');

      // User can follow suggestions
      expect(errorInfo.suggestions[0]).toContain('internet connection');
    });

    it('should provide accessible experience for contact management', () => {
      const contact = {
        displayName: 'Test User',
        trustLevel: 'trusted',
        groups: ['friends']
      };

      const ariaLabel = AccessibilityHelper.getContactAriaLabel(contact);
      const keyboardHints = AccessibilityHelper.getKeyboardHints('contact-list');

      expect(ariaLabel).toContain('Contact: Test User');
      expect(keyboardHints.length).toBeGreaterThan(0);
    });

    it('should track progress for bulk operations', () => {
      const tracker = new ProgressTracker(100, 'Importing contacts');
      const progressUpdates: number[] = [];

      tracker.subscribe((progress) => {
        progressUpdates.push(progress.percentage);
      });

      // Simulate importing 100 contacts
      for (let i = 0; i < 100; i++) {
        tracker.increment();
      }

      expect(progressUpdates[progressUpdates.length - 1]).toBe(100);
      expect(tracker.getProgress().current).toBe(100);
    });
  });
});
