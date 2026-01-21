/**
 * Performance Optimizations for Smart Invite System
 * Implements caching, pagination, and efficient search algorithms
 */

import type { Contact, ContactGroup } from './types';

/**
 * LRU Cache implementation for contact data
 */
export class LRUCache<K, V> {
  private cache: Map<K, V>;
  private maxSize: number;

  constructor(maxSize: number = 100) {
    this.cache = new Map();
    this.maxSize = maxSize;
  }

  get(key: K): V | undefined {
    if (!this.cache.has(key)) {
      return undefined;
    }

    // Move to end (most recently used)
    const value = this.cache.get(key)!;
    this.cache.delete(key);
    this.cache.set(key, value);
    return value;
  }

  set(key: K, value: V): void {
    // Remove if exists (to update position)
    if (this.cache.has(key)) {
      this.cache.delete(key);
    }

    // Add to end
    this.cache.set(key, value);

    // Evict oldest if over capacity
    if (this.cache.size > this.maxSize) {
      const firstKey = this.cache.keys().next().value;
      this.cache.delete(firstKey);
    }
  }

  has(key: K): boolean {
    return this.cache.has(key);
  }

  clear(): void {
    this.cache.clear();
  }

  get size(): number {
    return this.cache.size;
  }
}

/**
 * Pagination helper for large contact lists
 */
export interface PaginationOptions {
  page: number;
  pageSize: number;
}

export interface PaginatedResult<T> {
  items: T[];
  totalItems: number;
  totalPages: number;
  currentPage: number;
  pageSize: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
}

export function paginateArray<T>(
  items: T[],
  options: PaginationOptions
): PaginatedResult<T> {
  const { page, pageSize } = options;
  const totalItems = items.length;
  const totalPages = Math.ceil(totalItems / pageSize);
  const startIndex = (page - 1) * pageSize;
  const endIndex = startIndex + pageSize;

  return {
    items: items.slice(startIndex, endIndex),
    totalItems,
    totalPages,
    currentPage: page,
    pageSize,
    hasNextPage: page < totalPages,
    hasPreviousPage: page > 1
  };
}

/**
 * Debounce function for search input
 */
export function debounce<T extends (...args: any[]) => any>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: NodeJS.Timeout | null = null;

  return function executedFunction(...args: Parameters<T>) {
    const later = () => {
      timeout = null;
      func(...args);
    };

    if (timeout) {
      clearTimeout(timeout);
    }
    timeout = setTimeout(later, wait);
  };
}

/**
 * Optimized search using Trie data structure for prefix matching
 */
export class ContactSearchIndex {
  private root: TrieNode;
  private contactMap: Map<string, Contact>;

  constructor() {
    this.root = new TrieNode();
    this.contactMap = new Map();
  }

  /**
   * Add contact to search index
   */
  addContact(contact: Contact): void {
    this.contactMap.set(contact.id, contact);

    // Index display name
    this.insertWord(contact.displayName.toLowerCase(), contact.id);

    // Index bio if present
    if (contact.bio) {
      const bioWords = contact.bio.toLowerCase().split(/\s+/);
      bioWords.forEach(word => this.insertWord(word, contact.id));
    }

    // Index public key prefix
    const pubkeyPrefix = contact.publicKey.substring(0, 16).toLowerCase();
    this.insertWord(pubkeyPrefix, contact.id);
  }

  /**
   * Remove contact from search index
   */
  removeContact(contactId: string): void {
    this.contactMap.delete(contactId);
    // Note: For simplicity, we don't remove from trie
    // In production, implement trie node removal or rebuild index periodically
  }

  /**
   * Search contacts by query
   */
  search(query: string): Contact[] {
    if (!query || query.length === 0) {
      return Array.from(this.contactMap.values());
    }

    const lowercaseQuery = query.toLowerCase();
    const contactIds = this.searchPrefix(lowercaseQuery);
    const uniqueIds = new Set(contactIds);

    return Array.from(uniqueIds)
      .map(id => this.contactMap.get(id))
      .filter((contact): contact is Contact => contact !== undefined);
  }

  /**
   * Clear the entire index
   */
  clear(): void {
    this.root = new TrieNode();
    this.contactMap.clear();
  }

  /**
   * Rebuild index from contacts
   */
  rebuild(contacts: Contact[]): void {
    this.clear();
    contacts.forEach(contact => this.addContact(contact));
  }

  private insertWord(word: string, contactId: string): void {
    let node = this.root;

    for (const char of word) {
      if (!node.children.has(char)) {
        node.children.set(char, new TrieNode());
      }
      node = node.children.get(char)!;
    }

    node.contactIds.add(contactId);
  }

  private searchPrefix(prefix: string): string[] {
    let node = this.root;

    // Navigate to prefix node
    for (const char of prefix) {
      if (!node.children.has(char)) {
        return [];
      }
      node = node.children.get(char)!;
    }

    // Collect all contact IDs from this node and descendants
    return this.collectContactIds(node);
  }

  private collectContactIds(node: TrieNode): string[] {
    const result: string[] = [];

    // Add contact IDs from current node
    result.push(...Array.from(node.contactIds));

    // Recursively collect from children
    for (const child of node.children.values()) {
      result.push(...this.collectContactIds(child));
    }

    return result;
  }
}

class TrieNode {
  children: Map<string, TrieNode>;
  contactIds: Set<string>;

  constructor() {
    this.children = new Map();
    this.contactIds = new Set();
  }
}

/**
 * Batch operations helper for bulk updates
 */
export class BatchProcessor<T> {
  private batchSize: number;
  private processFn: (batch: T[]) => Promise<void>;

  constructor(batchSize: number, processFn: (batch: T[]) => Promise<void>) {
    this.batchSize = batchSize;
    this.processFn = processFn;
  }

  async process(items: T[]): Promise<void> {
    const batches: T[][] = [];

    for (let i = 0; i < items.length; i += this.batchSize) {
      batches.push(items.slice(i, i + this.batchSize));
    }

    // Process batches sequentially to avoid overwhelming the system
    for (const batch of batches) {
      await this.processFn(batch);
    }
  }

  async processParallel(items: T[], maxConcurrency: number = 3): Promise<void> {
    const batches: T[][] = [];

    for (let i = 0; i < items.length; i += this.batchSize) {
      batches.push(items.slice(i, i + this.batchSize));
    }

    // Process batches with limited concurrency
    for (let i = 0; i < batches.length; i += maxConcurrency) {
      const batchGroup = batches.slice(i, i + maxConcurrency);
      await Promise.all(batchGroup.map(batch => this.processFn(batch)));
    }
  }
}

/**
 * QR Code generation cache
 */
export class QRCodeCache {
  private cache: LRUCache<string, string>;

  constructor(maxSize: number = 50) {
    this.cache = new LRUCache(maxSize);
  }

  /**
   * Get cached QR code data URL
   */
  get(key: string): string | undefined {
    return this.cache.get(key);
  }

  /**
   * Cache QR code data URL
   */
  set(key: string, dataUrl: string): void {
    this.cache.set(key, dataUrl);
  }

  /**
   * Generate cache key from QR data
   */
  generateKey(publicKey: string, options: any): string {
    return `${publicKey}-${JSON.stringify(options)}`;
  }

  /**
   * Clear cache
   */
  clear(): void {
    this.cache.clear();
  }
}

/**
 * Virtual scrolling helper for large lists
 */
export interface VirtualScrollOptions {
  itemHeight: number;
  containerHeight: number;
  overscan?: number;
}

export interface VirtualScrollResult {
  startIndex: number;
  endIndex: number;
  offsetY: number;
  totalHeight: number;
}

export function calculateVirtualScroll(
  scrollTop: number,
  totalItems: number,
  options: VirtualScrollOptions
): VirtualScrollResult {
  const { itemHeight, containerHeight, overscan = 3 } = options;

  const startIndex = Math.max(0, Math.floor(scrollTop / itemHeight) - overscan);
  const visibleItems = Math.ceil(containerHeight / itemHeight);
  const endIndex = Math.min(totalItems, startIndex + visibleItems + overscan * 2);

  return {
    startIndex,
    endIndex,
    offsetY: startIndex * itemHeight,
    totalHeight: totalItems * itemHeight
  };
}

/**
 * Memoization helper for expensive computations
 */
export function memoize<T extends (...args: any[]) => any>(
  fn: T,
  keyGenerator?: (...args: Parameters<T>) => string
): T {
  const cache = new Map<string, ReturnType<T>>();

  return ((...args: Parameters<T>): ReturnType<T> => {
    const key = keyGenerator ? keyGenerator(...args) : JSON.stringify(args);

    if (cache.has(key)) {
      return cache.get(key)!;
    }

    const result = fn(...args);
    cache.set(key, result);
    return result;
  }) as T;
}

/**
 * Throttle function for rate limiting
 */
export function throttle<T extends (...args: any[]) => any>(
  func: T,
  limit: number
): (...args: Parameters<T>) => void {
  let inThrottle: boolean;

  return function executedFunction(...args: Parameters<T>) {
    if (!inThrottle) {
      func(...args);
      inThrottle = true;
      setTimeout(() => (inThrottle = false), limit);
    }
  };
}

/**
 * Performance monitoring helper
 */
export class PerformanceMonitor {
  private measurements: Map<string, number[]>;

  constructor() {
    this.measurements = new Map();
  }

  /**
   * Start timing an operation
   */
  start(label: string): () => void {
    const startTime = performance.now();

    return () => {
      const duration = performance.now() - startTime;
      this.record(label, duration);
    };
  }

  /**
   * Record a measurement
   */
  record(label: string, duration: number): void {
    if (!this.measurements.has(label)) {
      this.measurements.set(label, []);
    }
    this.measurements.get(label)!.push(duration);
  }

  /**
   * Get statistics for a label
   */
  getStats(label: string): {
    count: number;
    avg: number;
    min: number;
    max: number;
    total: number;
  } | null {
    const measurements = this.measurements.get(label);
    if (!measurements || measurements.length === 0) {
      return null;
    }

    const total = measurements.reduce((sum, val) => sum + val, 0);
    const avg = total / measurements.length;
    const min = Math.min(...measurements);
    const max = Math.max(...measurements);

    return {
      count: measurements.length,
      avg,
      min,
      max,
      total
    };
  }

  /**
   * Clear all measurements
   */
  clear(): void {
    this.measurements.clear();
  }

  /**
   * Get all measurements
   */
  getAllStats(): Map<string, ReturnType<PerformanceMonitor['getStats']>> {
    const stats = new Map();
    for (const label of this.measurements.keys()) {
      stats.set(label, this.getStats(label));
    }
    return stats;
  }
}

/**
 * Singleton instances
 */
export const contactSearchIndex = new ContactSearchIndex();
export const qrCodeCache = new QRCodeCache();
export const performanceMonitor = new PerformanceMonitor();
