/// <reference types="vitest" />
import { defineConfig } from 'vite';
import type { PreRenderedChunk } from 'rollup';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': resolve(__dirname, './src'),
      // Force libsodium-wrappers to use the CJS version instead of ESM
      'libsodium-wrappers': resolve(__dirname, 'node_modules/libsodium-wrappers/dist/modules/libsodium-wrappers.js'),
    },
  },
  optimizeDeps: {
    // Force these to be pre-bundled
    include: ['@holochain/client'],
  },
  server: {
    port: 8891,
    // Holochain websocket connection
    proxy: {
      '/holochain': {
        target: 'ws://localhost:8888',
        ws: true,
      },
    },
  },
  build: {
    outDir: 'dist',
    sourcemap: true,
    target: 'esnext',
    // Use commonjs for these packages in the build
    commonjsOptions: {
      include: [/libsodium/, /node_modules/],
    },
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        serviceWorker: resolve(__dirname, 'src/serviceWorker.ts'),
      },
      output: {
        entryFileNames: (chunkInfo: PreRenderedChunk) => {
          return chunkInfo.name === 'serviceWorker' 
            ? 'serviceWorker.js' 
            : 'assets/[name]-[hash].js';
        },
      },
    },
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: './src/test/setup.ts',
    css: true,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: [
        'node_modules/',
        'src/test/',
        '**/*.d.ts',
        '**/*.config.*',
        '**/mockData',
        '**/__tests__',
      ],
    },
  },
} as any);
