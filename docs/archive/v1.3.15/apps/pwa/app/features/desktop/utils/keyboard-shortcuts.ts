"use client";

/**
 * Desktop keyboard shortcuts configuration and handler
 */

export interface KeyboardShortcut {
  key: string;
  ctrl?: boolean;
  alt?: boolean;
  shift?: boolean;
  meta?: boolean;
  description: string;
  action: () => void;
}

export class KeyboardShortcutManager {
  private shortcuts: Map<string, KeyboardShortcut> = new Map();
  private enabled = true;

  constructor() {
    if (typeof window !== "undefined") {
      window.addEventListener("keydown", this.handleKeyDown.bind(this));
    }
  }

  /**
   * Register a keyboard shortcut
   */
  register(id: string, shortcut: KeyboardShortcut): void {
    this.shortcuts.set(id, shortcut);
  }

  /**
   * Unregister a keyboard shortcut
   */
  unregister(id: string): void {
    this.shortcuts.delete(id);
  }

  /**
   * Enable or disable all shortcuts
   */
  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
  }

  /**
   * Get all registered shortcuts
   */
  getShortcuts(): KeyboardShortcut[] {
    return Array.from(this.shortcuts.values());
  }

  /**
   * Handle keydown events
   */
  private handleKeyDown(event: KeyboardEvent): void {
    if (!this.enabled) return;

    // Don't trigger shortcuts when typing in input fields
    const target = event.target as HTMLElement;
    if (
      target.tagName === "INPUT" ||
      target.tagName === "TEXTAREA" ||
      target.isContentEditable
    ) {
      return;
    }

    for (const shortcut of this.shortcuts.values()) {
      if (this.matchesShortcut(event, shortcut)) {
        event.preventDefault();
        shortcut.action();
        break;
      }
    }
  }

  /**
   * Check if event matches shortcut
   */
  private matchesShortcut(event: KeyboardEvent, shortcut: KeyboardShortcut): boolean {
    const keyMatches = event.key.toLowerCase() === shortcut.key.toLowerCase();
    const ctrlMatches = !!shortcut.ctrl === (event.ctrlKey || event.metaKey);
    const altMatches = !!shortcut.alt === event.altKey;
    const shiftMatches = !!shortcut.shift === event.shiftKey;

    return keyMatches && ctrlMatches && altMatches && shiftMatches;
  }

  /**
   * Cleanup
   */
  destroy(): void {
    if (typeof window !== "undefined") {
      window.removeEventListener("keydown", this.handleKeyDown.bind(this));
    }
    this.shortcuts.clear();
  }
}

// Singleton instance
let manager: KeyboardShortcutManager | null = null;

/**
 * Get the keyboard shortcut manager instance
 */
export function getKeyboardShortcutManager(): KeyboardShortcutManager {
  if (!manager) {
    manager = new KeyboardShortcutManager();
  }
  return manager;
}

/**
 * Format shortcut for display
 */
export function formatShortcut(shortcut: KeyboardShortcut): string {
  const parts: string[] = [];
  
  if (shortcut.ctrl) {
    parts.push(navigator.platform.includes("Mac") ? "⌘" : "Ctrl");
  }
  if (shortcut.alt) {
    parts.push(navigator.platform.includes("Mac") ? "⌥" : "Alt");
  }
  if (shortcut.shift) {
    parts.push("⇧");
  }
  
  parts.push(shortcut.key.toUpperCase());
  
  return parts.join("+");
}
