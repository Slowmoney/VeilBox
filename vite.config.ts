import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    host: '127.0.0.1',
    port: 1430,
    strictPort: true,
    // The Rust side is rebuilt by tauri itself; watching src-tauri/target made
    // Vite crash on files locked by cargo (EBUSY).
    watch: {
      ignored: ['**/src-tauri/**'],
    },
  },
  envPrefix: ['VITE_', 'TAURI_'],
  clearScreen: false,
});
