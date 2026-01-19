import { expect, afterEach, vi } from 'vitest';
import { cleanup } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';

// Cleanup after each test
afterEach(() => {
  cleanup();
});

// Mock Holochain client
vi.mock('@holochain/client', () => ({
  AppWebsocket: {
    connect: vi.fn(() => Promise.resolve({
      appInfo: vi.fn(() => Promise.resolve({
        agent_pub_key: new Uint8Array([1, 2, 3]),
      })),
      callZome: vi.fn(),
      on: vi.fn(),
    })),
  },
  AdminWebsocket: {
    connect: vi.fn(() => Promise.resolve({
      listApps: vi.fn(() => Promise.resolve([])),
      installApp: vi.fn(),
      enableApp: vi.fn(),
      attachAppInterface: vi.fn(),
    })),
  },
  CellType: {
    Provisioned: 'provisioned',
  },
  SignalType: {
    App: 0,
    System: 1,
  },
}));

// Mock environment variables
vi.stubGlobal('import.meta', {
  env: {
    DEV: true,
    PROD: false,
    MODE: 'test',
    VITE_HC_HOST: 'localhost',
    VITE_HC_PORT: '8888',
    VITE_HC_ADMIN_PORT: '37397',
  },
});
