import '@testing-library/jest-dom';
import { beforeEach, vi } from 'vitest';

// Mock IndexedDB for tests
// Global storage to maintain state across database instances
const globalStorage = new Map<string, Map<string, any>>();

const defer = (fn: () => void): void => {
  if (typeof queueMicrotask === 'function') {
    queueMicrotask(fn);
    return;
  }
  setTimeout(fn, 0);
};

beforeEach(() => {
  for (const store of globalStorage.values()) {
    store.clear();
  }
  globalStorage.clear();
});

const getOrCreateStore = (dbName: string, storeName: string) => {
  const dbKey = `${dbName}:${storeName}`;
  if (!globalStorage.has(dbKey)) {
    globalStorage.set(dbKey, new Map());
  }
  return globalStorage.get(dbKey)!;
};

const createMockObjectStore = (dbName: string, storeName: string, onWriteComplete?: () => void) => {
  const data = getOrCreateStore(dbName, storeName);
  const indexes = new Map();

  const createRequest = (initialResult: unknown) => {
    const request: {
      result: unknown;
      error: Error | null;
      onsuccess: (() => void) | null;
      onerror: (() => void) | null;
    } = {
      result: initialResult,
      error: null,
      onsuccess: null,
      onerror: null,
    };
    return request;
  };

  return {
    name: storeName,
    add: vi.fn((value) => {
      const request: { result: unknown; error: Error | null; onsuccess: (() => void) | null; onerror: (() => void) | null } = {
        result: undefined,
        error: null,
        onsuccess: null,
        onerror: null,
      };

      defer(() => {
        if (data.has(value.id)) {
          request.error = new Error('Key already exists');
          if (request.onerror) request.onerror();
        } else {
          data.set(value.id, value);
          if (request.onsuccess) request.onsuccess();
          if (onWriteComplete) onWriteComplete();
        }
      });

      return request;
    }),
    put: vi.fn((value) => {
      const request: { result: unknown; error: Error | null; onsuccess: (() => void) | null; onerror: (() => void) | null } = {
        result: undefined,
        error: null,
        onsuccess: null,
        onerror: null,
      };

      defer(() => {
        data.set(value.id, value);
        if (request.onsuccess) request.onsuccess();
        if (onWriteComplete) onWriteComplete();
      });

      return request;
    }),
    get: vi.fn((key) => {
      const request: { result: unknown; error: Error | null; onsuccess: (() => void) | null; onerror: (() => void) | null } = {
        result: data.get(key) || null,
        error: null,
        onsuccess: null,
        onerror: null,
      };

      defer(() => {
        if (request.onsuccess) request.onsuccess();
      });

      return request;
    }),
    getAll: vi.fn(() => {
      const request: { result: unknown; error: Error | null; onsuccess: (() => void) | null; onerror: (() => void) | null } = {
        result: Array.from(data.values()),
        error: null,
        onsuccess: null,
        onerror: null,
      };

      defer(() => {
        if (request.onsuccess) request.onsuccess();
      });

      return request;
    }),
    delete: vi.fn((key) => {
      const request: { result: unknown; error: Error | null; onsuccess: (() => void) | null; onerror: (() => void) | null } = {
        result: undefined,
        error: null,
        onsuccess: null,
        onerror: null,
      };

      defer(() => {
        data.delete(key);
        if (request.onsuccess) request.onsuccess();
        if (onWriteComplete) onWriteComplete();
      });

      return request;
    }),
    clear: vi.fn(() => {
      const request: { result: unknown; error: Error | null; onsuccess: (() => void) | null; onerror: (() => void) | null } = {
        result: undefined,
        error: null,
        onsuccess: null,
        onerror: null,
      };

      defer(() => {
        data.clear();
        if (request.onsuccess) request.onsuccess();
        if (onWriteComplete) onWriteComplete();
      });

      return request;
    }),
    createIndex: vi.fn((name, keyPath, options) => {
      indexes.set(name, { keyPath, options });
    }),
    index: vi.fn((name) => {
      const meta = indexes.get(name);
      const keyPath = (meta?.keyPath as string | undefined) ?? name;

      const filterByKey = (query: unknown): unknown[] => {
        if (!keyPath) {
          return [];
        }

        return Array.from(data.values()).filter((value) => (value as any)?.[keyPath] === query);
      };

      return {
        get: vi.fn((query?: unknown) => {
          const matches = query === undefined ? Array.from(data.values()) : filterByKey(query);
          const request = createRequest(matches[0]);
          defer(() => {
            if (request.onsuccess) request.onsuccess();
          });
          return request;
        }),
        getAll: vi.fn((query?: unknown) => {
          const request = createRequest(query === undefined ? Array.from(data.values()) : filterByKey(query));
          defer(() => {
            if (request.onsuccess) request.onsuccess();
          });
          return request;
        }),
        getAllKeys: vi.fn((query?: unknown) => {
          const matches = query === undefined ? Array.from(data.values()) : filterByKey(query);
          const request = createRequest(matches.map((v: any) => v?.id));
          defer(() => {
            if (request.onsuccess) request.onsuccess();
          });
          return request;
        }),
        openCursor: vi.fn(() => ({
          onsuccess: null,
          onerror: null,
        })),
      };
    }),
    openCursor: vi.fn(() => ({
      onsuccess: null,
      onerror: null,
    })),
  };
};

const createMockTransaction = (dbName: string, storeNames: string[], mode: string) => {
  const stores = new Map();

  const tx: {
    objectStore: any;
    mode: string;
    error: any;
    oncomplete: any;
    onerror: any;
    onabort: any;
  } = {
    objectStore: vi.fn((name) => stores.get(name)),
    mode,
    error: null,
    oncomplete: null as any,
    onerror: null as any,
    onabort: null as any,
  };

  const completeSoon = (): void => {
    if (mode !== 'readwrite') {
      return;
    }
    defer(() => {
      if (tx.oncomplete) tx.oncomplete();
    });
  };

  storeNames.forEach(name => {
    stores.set(name, createMockObjectStore(dbName, name, completeSoon));
  });

  return tx;
};

const createMockDatabase = (dbName: string) => {
  const objectStores = new Map();

  return {
    createObjectStore: vi.fn((name, options) => {
      const store = createMockObjectStore(dbName, name);
      objectStores.set(name, store);
      return store;
    }),
    objectStoreNames: {
      contains: vi.fn((name) => objectStores.has(name)),
    },
    transaction: vi.fn((storeNames, mode = 'readonly') => {
      const names = Array.isArray(storeNames) ? storeNames : [storeNames];
      return createMockTransaction(dbName, names, mode);
    }),
    close: vi.fn(),
    version: 1,
  };
};

const mockIndexedDB = {
  open: vi.fn((name, version) => {
    const request = {
      result: createMockDatabase(name),
      error: null,
      onsuccess: null as any,
      onerror: null as any,
      onupgradeneeded: null as any,
    };

    defer(() => {
      // Simulate upgrade needed for new database
      if (request.onupgradeneeded) {
        request.onupgradeneeded({ target: request } as any);
      }
      if (request.onsuccess) {
        request.onsuccess();
      }
    });

    return request;
  }),
  deleteDatabase: vi.fn((name) => {
    // Clear all stores for this database
    const keysToDelete = Array.from(globalStorage.keys()).filter(key => key.startsWith(`${name}:`));
    keysToDelete.forEach(key => globalStorage.delete(key));

    if (keysToDelete.length === 0) {
      globalStorage.clear();
    }

    const request = {
      result: undefined,
      error: null,
      onsuccess: null as any,
      onerror: null as any,
    };

    if (request.onsuccess) request.onsuccess();

    return request;
  }),
  databases: vi.fn(() => Promise.resolve([])),
};

Object.defineProperty(global, 'indexedDB', {
  value: mockIndexedDB,
  writable: true,
});

// Mock crypto for tests
Object.defineProperty(global, 'crypto', {
  value: {
    getRandomValues: vi.fn((arr) => {
      for (let i = 0; i < arr.length; i++) {
        arr[i] = Math.floor(Math.random() * 256);
      }
      return arr;
    }),
    subtle: {
      digest: vi.fn(async (algorithm, data) => {
        // Mock SHA-256 digest - return a simple hash based on input
        const input = new Uint8Array(data);
        const hash = new Uint8Array(32);
        for (let i = 0; i < 32; i++) {
          hash[i] = (input[i % input.length] + i) % 256;
        }
        return hash.buffer;
      }),
      importKey: vi.fn(async () => ({})),
      encrypt: vi.fn(async (algorithm, key, data) => {
        // Mock encryption - return modified data
        const input = new Uint8Array(data);
        const encrypted = new Uint8Array(input.length + 16);
        encrypted.set(input, 16);
        // Add mock "tag" at the beginning
        for (let i = 0; i < 16; i++) {
          encrypted[i] = i % 256;
        }
        return encrypted.buffer;
      }),
      decrypt: vi.fn(async (algorithm, key, data) => {
        // Mock decryption - reverse the encryption
        const input = new Uint8Array(data);
        if (input.length < 16) throw new Error('Invalid encrypted data');
        return input.slice(16).buffer;
      }),
    },
  },
  writable: true,
});

// Mock performance for tests
Object.defineProperty(global, 'performance', {
  value: {
    now: vi.fn(() => Date.now()),
  },
  writable: true,
});
