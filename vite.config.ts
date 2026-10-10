import path from 'path';
import { defineConfig, loadEnv, Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import ttsHandler from './api/tts.js';

function edgeTtsApiPlugin(): Plugin {
  return {
    name: 'edge-tts-api-middleware',
    configureServer(server) {
      server.middlewares.use('/api/tts', (req, res) => {
        ttsHandler(req, res);
      });
    },
    configurePreviewServer(server) {
      server.middlewares.use('/api/tts', (req, res) => {
        ttsHandler(req, res);
      });
    },
  };
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '.', '');
  return {
    server: {
      port: 3000,
      host: '0.0.0.0',
    },
    plugins: [react(), edgeTtsApiPlugin()],
    define: {
      'process.env.API_KEY': JSON.stringify(env.GEMINI_API_KEY),
      'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY),
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
  };
});
