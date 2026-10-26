import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '.', '');
  const target = env.API_PROXY_TARGET || 'http://localhost:8080';
  const proxy = Object.fromEntries(['/api', '/oauth2', '/login/oauth2'].map((path) => [path, {
    target, changeOrigin: true, timeout: 1_200_000, proxyTimeout: 1_200_000,
  }]));
  return { plugins: [react()], server: { host: '0.0.0.0', port: 5173, strictPort: true, proxy,
    watch: { ignored: ['**/.artifacts.local/**'] },
  }, preview: { port: 5173, strictPort: true, proxy } };
});
