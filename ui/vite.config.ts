import { defineConfig } from 'vite';
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
    port: 8888,
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
  },
});
