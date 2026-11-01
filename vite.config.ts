/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  base: './',
  server: { port: 5173, strictPort: true, host: '127.0.0.1' },
  preview: { port: 4173, strictPort: true, host: '127.0.0.1' },
  build: {
    target: 'es2022',
    chunkSizeWarningLimit: 1600,
    rollupOptions: {
      output: {
        manualChunks: (id: string) => {
          if (id.includes('node_modules/phaser')) return 'phaser';
          if (id.includes('node_modules/react')) return 'react';
          return undefined;
        },
      },
    },
  },
  test: {
    include: ['src/**/*.test.ts'],
    environment: 'node',
  },
});
