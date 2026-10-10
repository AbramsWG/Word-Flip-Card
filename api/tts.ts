import crypto from 'crypto';
import WebSocket from 'ws';

export interface WordBoundary {
  word: string;
  offsetMs: number;
  durationMs: number;
}

export interface TTSResponsePayload {
  audio: string; // base64 encoded mp3
  boundaries: WordBoundary[];
  voice: string;
}

const TRUSTED_CLIENT_TOKEN = '6A5AA1D4EAFF4E9FB37E23D68491D6F4';
const CHROMIUM_FULL_VERSION = '143.0.3650.75';
const CHROMIUM_MAJOR_VERSION = CHROMIUM_FULL_VERSION.split('.')[0];
const SEC_MS_GEC_VERSION = `1-${CHROMIUM_FULL_VERSION}`;

const ALLOWED_VOICES: Record<string, string> = {
  'en-GB-SoniaNeural': 'en-GB',
  'en-US-JennyNeural': 'en-US',
  'en-US-AnaNeural': 'en-US',
};

let clockSkewSeconds = 0;

function generateSecMsGec(): string {
  // Windows epoch offset: seconds between 1601-01-01 and 1970-01-01
  let ticks = Math.floor(Date.now() / 1000 + clockSkewSeconds) + 11644473600;
  // Round down to the nearest 5 minutes (300 seconds)
  ticks -= ticks % 300;
  // Convert seconds to 100-nanosecond intervals (* 10,000,000)
  const strToHash = `${ticks}0000000${TRUSTED_CLIENT_TOKEN}`;
  return crypto.createHash('sha256').update(strToHash, 'ascii').digest('hex').toUpperCase();
}

function escapeXml(unsafe: string): string {
  return unsafe
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

async function synthesizeOnce(
  text: string,
  voice: string,
  lang: string
): Promise<TTSResponsePayload> {
  const connectionId = crypto.randomUUID().replace(/-/g, '');
  const requestId = crypto.randomUUID().replace(/-/g, '');
  const secMsGec = generateSecMsGec();
  const muid = crypto.randomBytes(16).toString('hex').toUpperCase();

  const wsUrl =
    `wss://speech.platform.bing.com/consumer/speech/synthesize/readaloud/edge/v1` +
    `?TrustedClientToken=${TRUSTED_CLIENT_TOKEN}` +
    `&Sec-MS-GEC=${secMsGec}` +
    `&Sec-MS-GEC-Version=${SEC_MS_GEC_VERSION}` +
    `&ConnectionId=${connectionId}`;

  return new Promise<TTSResponsePayload>((resolve, reject) => {
    const audioChunks: Buffer[] = [];
    const boundaries: WordBoundary[] = [];
    let settled = false;

    const ws = new WebSocket(wsUrl, {
      headers: {
        Pragma: 'no-cache',
        'Cache-Control': 'no-cache',
        Origin: 'chrome-extension://jdiccldimpdaibmpdkjnbmckianbfold',
        'User-Agent': `Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${CHROMIUM_MAJOR_VERSION}.0.0.0 Safari/537.36 Edg/${CHROMIUM_MAJOR_VERSION}.0.0.0`,
        'Accept-Encoding': 'gzip, deflate, br, zstd',
        'Accept-Language': 'en-US,en;q=0.9',
        Cookie: `muid=${muid};`,
      },
    });

    const timeout = setTimeout(() => {
      if (!settled) {
        settled = true;
        try {
          ws.close();
        } catch {
          // ignore close errors
        }
        reject(new Error('Edge TTS request timed out'));
      }
    }, 12000);

    ws.on('unexpected-response', (_req, res) => {
      const serverDate = res.headers['date'];
      if (serverDate) {
        const parsedServerSeconds = Date.parse(serverDate) / 1000;
        if (!Number.isNaN(parsedServerSeconds)) {
          clockSkewSeconds = parsedServerSeconds - Date.now() / 1000;
        }
      }
      if (!settled) {
        settled = true;
        clearTimeout(timeout);
        reject(new Error(`Unexpected server response: ${res.statusCode}`));
      }
    });

    ws.on('open', () => {
      const timestamp = new Date().toISOString();
      const configHeader =
        `X-Timestamp:${timestamp}\r\n` +
        `Content-Type:application/json; charset=utf-8\r\n` +
        `Path:speech.config\r\n\r\n`;
      const configBody = JSON.stringify({
        context: {
          synthesis: {
            audio: {
              metadataoptions: {
                sentenceBoundaryEnabled: 'false',
                wordBoundaryEnabled: 'true',
              },
              outputFormat: 'audio-24khz-48kbitrate-mono-mp3',
            },
          },
        },
      });

      ws.send(`${configHeader}${configBody}`);

      const ssmlHeader =
        `X-RequestId:${requestId}\r\n` +
        `Content-Type:application/ssml+xml\r\n` +
        `X-Timestamp:${timestamp}Z\r\n` +
        `Path:ssml\r\n\r\n`;
      const ssmlBody =
        `<speak version='1.0' xmlns='http://www.w3.org/2001/10/synthesis' xml:lang='${lang}'>` +
        `<voice name='${voice}'>` +
        `<prosody pitch='+0Hz' rate='+0%' volume='+0%'>${escapeXml(text)}</prosody>` +
        `</voice></speak>`;

      ws.send(`${ssmlHeader}${ssmlBody}`);
    });

    ws.on('message', (data: WebSocket.RawData, isBinary: boolean) => {
      if (settled) return;

      if (!isBinary) {
        const message = data.toString('utf8');
        if (message.includes('Path:audio.metadata')) {
          const splitIdx = message.indexOf('\r\n\r\n');
          if (splitIdx !== -1) {
            try {
              const jsonStr = message.slice(splitIdx + 4);
              const parsed = JSON.parse(jsonStr);
              if (Array.isArray(parsed?.Metadata)) {
                for (const item of parsed.Metadata) {
                  if (item?.Type === 'WordBoundary' && item?.Data) {
                    boundaries.push({
                      word: item.Data.text?.Text || '',
                      offsetMs: Math.round((item.Data.Offset || 0) / 10000),
                      durationMs: Math.round((item.Data.Duration || 0) / 10000),
                    });
                  }
                }
              }
            } catch {
              // ignore malformed metadata chunk
            }
          }
        } else if (message.includes('Path:turn.end')) {
          settled = true;
          clearTimeout(timeout);
          try {
            ws.close();
          } catch {
            // ignore
          }
          const audioBuffer = Buffer.concat(audioChunks);
          if (audioBuffer.length === 0) {
            reject(new Error('Empty audio received from Edge TTS'));
            return;
          }
          resolve({
            audio: audioBuffer.toString('base64'),
            boundaries,
            voice,
          });
        }
      } else {
        const buffer = Buffer.isBuffer(data) ? data : Buffer.from(data as ArrayBuffer);
        if (buffer.length < 2) return;
        const headerLength = buffer.readUInt16BE(0);
        if (buffer.length < 2 + headerLength) return;
        const header = buffer.subarray(2, 2 + headerLength).toString('utf8');
        if (header.includes('Path:audio')) {
          const audioData = buffer.subarray(2 + headerLength);
          if (audioData.length > 0) {
            audioChunks.push(audioData);
          }
        }
      }
    });

    ws.on('error', (err) => {
      if (!settled) {
        settled = true;
        clearTimeout(timeout);
        reject(err);
      }
    });

    ws.on('close', () => {
      if (!settled) {
        settled = true;
        clearTimeout(timeout);
        if (audioChunks.length > 0) {
          resolve({
            audio: Buffer.concat(audioChunks).toString('base64'),
            boundaries,
            voice,
          });
        } else {
          reject(new Error('WebSocket closed before receiving audio'));
        }
      }
    });
  });
}

export async function synthesizeEdgeTTS(
  rawText: string,
  requestedVoice = 'en-GB-SoniaNeural'
): Promise<TTSResponsePayload> {
  const voice = ALLOWED_VOICES[requestedVoice] ? requestedVoice : 'en-GB-SoniaNeural';
  const lang = ALLOWED_VOICES[voice];
  const text = rawText.trim();

  if (!text) {
    throw new Error('Text is required');
  }

  try {
    return await synthesizeOnce(text, voice, lang);
  } catch {
    // Retry once in case clockSkewSeconds was just calibrated
    return await synthesizeOnce(text, voice, lang);
  }
}

export default async function handler(req: any, res: any) {
  if (req.method !== 'GET' && req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const text = (req.method === 'GET' ? req.query?.text : req.body?.text) as string | undefined;
  const voice = (req.method === 'GET' ? req.query?.voice : req.body?.voice) as string | undefined;

  if (!text || typeof text !== 'string' || !text.trim()) {
    return res.status(400).json({ error: 'Text parameter is required' });
  }

  if (text.length > 1000) {
    return res.status(400).json({ error: 'Text is too long (max 1000 characters)' });
  }

  try {
    const result = await synthesizeEdgeTTS(text, voice || 'en-GB-SoniaNeural');
    // Enable Vercel Edge CDN caching for 1 year so repeated requests for the same word cost 0 invocations
    res.setHeader('Cache-Control', 'public, max-age=31536000, s-maxage=31536000, immutable');
    return res.status(200).json(result);
  } catch (error: any) {
    console.error('Edge TTS Error:', error);
    return res.status(500).json({ error: error.message || 'Failed to synthesize speech' });
  }
}
