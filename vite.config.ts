
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  // Fix: Use '.' instead of process.cwd() as 'cwd' might not be defined on the available Process type
  const env = loadEnv(mode, '.', '');
  return {
    plugins: [react()],
    define: {
      // Injeta a API_KEY para ser acessível como process.env.API_KEY no código
      'process.env.API_KEY': JSON.stringify(env.API_KEY || process.env.API_KEY),
    },
    build: {
      target: 'esnext',
      outDir: 'dist',
    }
  };
});
