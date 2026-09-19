import { defineConfig, loadEnv } from 'vite';
import tailwindcss from '@tailwindcss/vite';
import path from 'path';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');

  return {
    define: {
      __APP_ENV__: JSON.stringify(env.APP_ENV),
      __BUILD_DATE__: JSON.stringify(new Date().toISOString().slice(0, 16).replace('T', ' ')),
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
      },
    },
    plugins: [
      tailwindcss(),
    ],
    server: {
      host: '0.0.0.0',
      port: 3000,
      open: false,
      allowedHosts: [
        'macos.tail266e58.ts.net',
      ],
      proxy: {
        '/api/barcodelookup': {
          target: 'https://api.barcodelookup.com/v3',
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/api\/barcodelookup/, ''),
        },
      },
    },
    build: {
      outDir: 'dist',
      emptyOutDir: true,
    },
  };
});
