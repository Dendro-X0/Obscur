import '@testing-library/jest-dom';
import { vi } from 'vitest';

// Mock IndexedDB for tests
// Global storage to maintain state across database instances
const globalStorage = new Map<string, Map<string, any>>();

const getOrCreateStore = (dbName: string, storeName: string) => {
  const dbKey = `${dbName}:${storeName}`;
  if (!globalStorage.has(dbKey)) {
    globalStorage.set(dbKey, new Map());
  }
  return globalStorage.get(dbKey)!;
};

const createMockObjectStore = (dbName: string, storeName: string) => {
  const data = getOrCreateStore(dbName, storeName);
  const indexes = new Map();
  
  return {
    name: storeName,
    add: vi.fn((value) => {
      const request = {
        result: undefined,
        error: null,
        onsuccess: null as any,
        onerror: null as any,
      };
      
      setTimeout(() => {
        if (data.has(value.id)) {
          request.error = new Error('Key already exists');
          if (request.onerror) request.onerror();
        } else {
          data.set(value.id, value);
          if (request.onsuccess) request.onsuccess();
        }
      }, 0);
      
      return request;
    }),
    put: vi.fn((value) => {
      const request = {
        result: undefined,
        error: null,
        onsuccess: null as any,
        onerror: null as any,
      };
      
      setTimeout(() => {
        data.set(value.id, value);
        if (request.onsuccess) request.onsuccess();
      }, 0);
      
      return request;
    }),
    get: vi.fn((key) => {
      const request = {
        result: data.get(key) || null,
        error: null,
        onsuccess: null as any,
        onerror: null as any,
      };
      
      setTimeout(() => {
        if (request.onsuccess) request.onsuccess();
      }, 0);
      
      return request;
    }),
    getAll: vi.fn(() => {
      const request = {
        result: Array.from(data.values()),
        error: null,
        onsuccess: null as any,
        onerror: null as any,
      };
      
      setTimeout(() => {
        if (request.onsuccess) request.onsuccess();
      }, 0);
      
      return request;
    }),
    delete: vi.fn((key) => {
      const request = {
        result: undefined,
        error: null,
        onsuccess: null as any,
        onerror: null as any,
      };
      
      setTimeout(() => {
        data.delete(key);
        if (request.onsuccess) request.onsuccess();
      }, 0);
      
      return request;
    }),
    createIndex: vi.fn((name, keyPath, options) => {
      indexes.set(name, { keyPath, options });
    }),
    index: vi.fn((name) => ({
      openCursor: vi.fn(() => ({
        onsuccess: null,
        onerror: null,
      })),
    })),
    openCursor: vi.fn(() => ({
      onsuccess: null,
      onerror: null,
    })),
  };
};

const createMockTransaction = (dbName: string, storeNames: string[], mode: string) => {
  const stores = new Map();
  storeNames.forEach(name => {
    stores.set(name, createMockObjectStore(dbName, name));
  });
  
  return {
    objectStore: vi.fn((name) => stores.get(name)),
    mode,
    error: null,
    oncomplete: null as any,
    onerror: null as any,
    onabort: null as any,
  };
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
    
    setTimeout(() => {
      // Simulate upgrade needed for new database
      if (request.onupgradeneeded) {
        request.onupgradeneeded({ target: request } as any);
      }
      if (request.onsuccess) {
        request.onsuccess();
      }
    }, 0);
    
    return request;
  }),
  deleteDatabase: vi.fn((name) => {
    // Clear all stores for this database
    const keysToDelete = Array.from(globalStorage.keys()).filter(key => key.startsWith(`${name}:`));
    keysToDelete.forEach(key => globalStorage.delete(key));
    
    const request = {
      result: undefined,
      error: null,
      onsuccess: null as any,
      onerror: null as any,
    };
    
    setTimeout(() => {
      if (request.onsuccess) request.onsuccess();
    }, 0);
    
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