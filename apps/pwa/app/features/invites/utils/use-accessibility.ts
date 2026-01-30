/**
 * React hooks for accessibility and UX features
 */

import { useState, useEffect, useCallback } from 'react';
import {
  loadingStateManager,
  errorMessageFormatter,
  contextualHelp,
  type LoadingState,
  type ErrorInfo,
  type HelpContent,
  ProgressTracker,
  type ProgressInfo
} from './accessibility-ux';

/**
 * Hook for managing loading states
 */
export function useLoadingState(key: string) {
  const [state, setState] = useState<LoadingState>(() =>
    loadingStateManager.getState(key)
  );

  useEffect(() => {
    const unsubscribe = loadingStateManager.subscribe(key, setState);
    return unsubscribe;
  }, [key]);

  const setLoading = useCallback(
    (message?: string, progress?: number) => {
      loadingStateManager.setLoading(key, message, progress);
    },
    [key]
  );

  const clearLoading = useCallback(() => {
    loadingStateManager.clearLoading(key);
  }, [key]);

  return {
    isLoading: state.isLoading,
    message: state.message,
    progress: state.progress,
    setLoading,
    clearLoading
  };
}

/**
 * Hook for formatting error messages
 */
export function useErrorMessage() {
  const formatError = useCallback((code: string, originalError?: Error): ErrorInfo => {
    return errorMessageFormatter.getErrorInfo(code, originalError);
  }, []);

  return { formatError };
}

/**
 * Hook for contextual help
 */
export function useContextualHelp(context: string) {
  const [helpContent, setHelpContent] = useState<HelpContent | null>(() =>
    contextualHelp.getHelp(context)
  );

  useEffect(() => {
    setHelpContent(contextualHelp.getHelp(context));
  }, [context]);

  return helpContent;
}

/**
 * Hook for progress tracking
 */
export function useProgressTracker(total: number, initialMessage?: string) {
  const [tracker] = useState(() => new ProgressTracker(total, initialMessage));
  const [progress, setProgress] = useState<ProgressInfo>(() => tracker.getProgress());

  useEffect(() => {
    const unsubscribe = tracker.subscribe(setProgress);
    return unsubscribe;
  }, [tracker]);

  const update = useCallback(
    (current: number, message?: string) => {
      tracker.update(current, message);
    },
    [tracker]
  );

  const increment = useCallback(
    (message?: string) => {
      tracker.increment(message);
    },
    [tracker]
  );

  const reset = useCallback(
    (newTotal?: number, message?: string) => {
      tracker.reset(newTotal, message);
    },
    [tracker]
  );

  return {
    progress,
    update,
    increment,
    reset
  };
}

/**
 * Hook for announcement to screen readers
 */
export function useAnnouncement() {
  const announce = useCallback((message: string, priority: 'polite' | 'assertive' = 'polite') => {
    // Create or get announcement element
    let announcer = document.getElementById('invite-system-announcer');

    if (!announcer) {
      announcer = document.createElement('div');
      announcer.id = 'invite-system-announcer';
      announcer.setAttribute('role', 'status');
      announcer.setAttribute('aria-live', priority);
      announcer.setAttribute('aria-atomic', 'true');
      announcer.style.position = 'absolute';
      announcer.style.left = '-10000px';
      announcer.style.width = '1px';
      announcer.style.height = '1px';
      announcer.style.overflow = 'hidden';
      document.body.appendChild(announcer);
    }

    // Update aria-live if priority changed
    if (announcer.getAttribute('aria-live') !== priority) {
      announcer.setAttribute('aria-live', priority);
    }

    // Clear and set new message
    announcer.textContent = '';
    setTimeout(() => {
      announcer!.textContent = message;
    }, 100);
  }, []);

  return { announce };
}

/**
 * Hook for keyboard navigation
 */
export function useKeyboardNavigation<T>(
  items: T[],
  onSelect?: (item: T, index: number) => void
) {
  const [selectedIndex, setSelectedIndex] = useState(0);

  const handleKeyDown = useCallback(
    (event: React.KeyboardEvent) => {
      switch (event.key) {
        case 'ArrowDown':
          event.preventDefault();
          setSelectedIndex(prev => Math.min(prev + 1, items.length - 1));
          break;

        case 'ArrowUp':
          event.preventDefault();
          setSelectedIndex(prev => Math.max(prev - 1, 0));
          break;

        case 'Home':
          event.preventDefault();
          setSelectedIndex(0);
          break;

        case 'End':
          event.preventDefault();
          setSelectedIndex(items.length - 1);
          break;

        case 'Enter':
          event.preventDefault();
          if (onSelect && items[selectedIndex]) {
            onSelect(items[selectedIndex], selectedIndex);
          }
          break;
      }
    },
    [items, selectedIndex, onSelect]
  );

  return {
    selectedIndex,
    setSelectedIndex,
    handleKeyDown
  };
}

/**
 * Hook for focus management
 */
export function useFocusManagement() {
  const focusElement = useCallback((selector: string) => {
    const element = document.querySelector<HTMLElement>(selector);
    if (element) {
      element.focus();
    }
  }, []);

  const focusFirstError = useCallback(() => {
    const errorElement = document.querySelector<HTMLElement>('[aria-invalid="true"]');
    if (errorElement) {
      errorElement.focus();
    }
  }, []);

  const trapFocus = useCallback((containerRef: React.RefObject<HTMLElement>) => {
    const container = containerRef.current;
    if (!container) return;

    const focusableElements = container.querySelectorAll<HTMLElement>(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );

    const firstElement = focusableElements[0];
    const lastElement = focusableElements[focusableElements.length - 1];

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Tab') return;

      if (event.shiftKey) {
        if (document.activeElement === firstElement) {
          event.preventDefault();
          lastElement?.focus();
        }
      } else {
        if (document.activeElement === lastElement) {
          event.preventDefault();
          firstElement?.focus();
        }
      }
    };

    container.addEventListener('keydown', handleKeyDown);

    return () => {
      container.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  return {
    focusElement,
    focusFirstError,
    trapFocus
  };
}
