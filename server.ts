import express from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import { synthesizeEdgeTTS } from './api/tts';

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  app.all('/api/tts', async (req, res) => {
    if (req.method !== 'GET' && req.method !== 'POST') {
      return res.status(405).json({ error: 'Method not allowed' });
    }

    const text = (req.method === 'GET' ? req.query.text : req.body?.text) as string | undefined;
    const voice = (req.method === 'GET' ? req.query.voice : req.body?.voice) as string | undefined;

    if (!text || typeof text !== 'string' || !text.trim()) {
      return res.status(400).json({ error: 'Text parameter is required' });
    }

    if (text.length > 1000) {
      return res.status(400).json({ error: 'Text is too long (max 1000 characters)' });
    }

    try {
      const result = await synthesizeEdgeTTS(text, voice || 'en-GB-SoniaNeural');
      res.setHeader('Cache-Control', 'public, max-age=31536000, s-maxage=31536000, immutable');
      return res.status(200).json(result);
    } catch (error: any) {
      console.error('Edge TTS Error:', error);
      return res.status(500).json({ error: error.message || 'Failed to synthesize speech' });
    }
  });

  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*all', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
