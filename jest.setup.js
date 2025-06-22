import '@testing-library/jest-dom'
import React from 'react'

// Add TextEncoder/TextDecoder for viem in tests
import { TextEncoder, TextDecoder } from 'util'
global.TextEncoder = TextEncoder
global.TextDecoder = TextDecoder

// Add Request/Response/Headers for API route tests
if (typeof globalThis.Request === 'undefined') {
  global.Request = class Request {
    constructor(url, init) {
      this._url = url;
      this.method = init?.method || 'GET';
      this.headers = new Headers(init?.headers);
      this.body = init?.body;
    }
    
    get url() {
      return this._url;
    }
    
    formData() {
      return Promise.resolve(this.body);
    }
    
    json() {
      return Promise.resolve(JSON.parse(this.body));
    }
    
    text() {
      return Promise.resolve(this.body);
    }
  };
}

if (typeof globalThis.Response === 'undefined') {
  global.Response = class Response {
    constructor(body, init) {
      this.body = body;
      this.status = init?.status || 200;
      this.headers = new Headers(init?.headers);
    }
    async json() {
      return JSON.parse(this.body);
    }
  };
}

if (typeof globalThis.Headers === 'undefined') {
  global.Headers = class Headers {
    constructor(init) {
      this._headers = {};
      if (init) {
        Object.entries(init).forEach(([key, value]) => {
          this._headers[key.toLowerCase()] = value;
        });
      }
    }
    get(key) {
      return this._headers[key.toLowerCase()];
    }
    set(key, value) {
      this._headers[key.toLowerCase()] = value;
    }
  };
}

// Mock ResizeObserver
global.ResizeObserver = jest.fn().mockImplementation(() => ({
  observe: jest.fn(),
  unobserve: jest.fn(),
  disconnect: jest.fn(),
}))

// Mock HapticProvider globally
jest.mock('@/providers/HapticProvider', () => ({
  HapticProvider: ({ children }) => children,
  useHaptic: () => ({
    isEnabled: () => false,
    isSupported: () => false,
    enable: jest.fn(),
    disable: jest.fn(),
    toggle: jest.fn(),
    navigationTap: jest.fn(),
    menuItemSelect: jest.fn(),
    buttonPress: jest.fn(),
    toggleStateChange: jest.fn(),
    dropdownOpen: jest.fn(),
    dropdownItemHover: jest.fn(),
    cardSelect: jest.fn(),
  }),
}))

// Mock IndexedDB for cache tests
class MockIDBRequest {
  constructor() {
    this.onsuccess = null;
    this.onerror = null;
    this.result = null;
  }
}

class MockIDBTransaction {
  constructor() {
    this.oncomplete = null;
    this.onerror = null;
  }
  
  objectStore() {
    return new MockIDBObjectStore();
  }
}

class MockIDBObjectStore {
  constructor() {
    this.indexNames = [];
  }
  
  get() {
    return new MockIDBRequest();
  }
  
  put() {
    return new MockIDBRequest();
  }
  
  delete() {
    return new MockIDBRequest();
  }
  
  clear() {
    return new MockIDBRequest();
  }
  
  index() {
    return new MockIDBIndex();
  }
  
  createIndex() {
    return {};
  }
}

class MockIDBIndex {
  openCursor() {
    return new MockIDBRequest();
  }
}

class MockIDBDatabase {
  constructor() {
    this.objectStoreNames = { contains: () => false };
  }
  
  transaction() {
    return new MockIDBTransaction();
  }
  
  createObjectStore() {
    return new MockIDBObjectStore();
  }
  
  close() {}
}

global.indexedDB = {
  open: jest.fn(() => new MockIDBRequest()),
};

global.IDBKeyRange = {
  upperBound: jest.fn((value) => ({ value, type: 'upperBound' })),
  lowerBound: jest.fn((value) => ({ value, type: 'lowerBound' })),
  bound: jest.fn((lower, upper) => ({ lower, upper, type: 'bound' })),
};