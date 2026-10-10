import crypto from 'crypto';
import tls from 'tls';
import { URL } from 'url';

const TRUSTED_CLIENT_TOKEN = '6A5AA1D4EAFF4E9FB37E23D68491D6F4';
const CHROMIUM_FULL_VERSION = '130.0.2849.68';
const SEC_MS_GEC_VERSION = `1-${CHROMIUM_FULL_VERSION}`;
const EDGE_HOST = 'speech.platform.bing.com';

const ALLOWED_VOICES = new Set([
  'en-US-JennyNeural',
  'en-GB-SoniaNeural',
  'en-US-AnaNeural',
  'en-US-AvaNeural',
  'en-GB-RyanNeural',
  'en-US-AriaNeural',
  'en-US-GuyNeural',
]);

function generateSecMsGec() {
  let ticks = Math.floor(Date.now() / 1000);
  ticks += 11644473600; // Windows epoch offset (1601-01-01)
  ticks -= ticks % 300; // Round down to nearest 5 minutes
  const strToHash = `${(BigInt(ticks) * 10000000n).toString()}${TRUSTED_CLIENT_TOKEN}`;
  return crypto.createHash('sha256').update(strToHash, 'ascii').digest('hex').toUpperCase();
}

function escapeXml(unsafe) {
  return unsafe.replace(/[<>&'"]/g, (c) => {
    switch (c) {
      case '<': return '&lt;';
      case '>': return '&gt;';
      case '&': return '&amp;';
      case '\'': return '&apos;';
      case '"': return '&quot;';
      default: return c;
    }
  });
}

function encodeWsTextFrame(str) {
  const payload = Buffer.from(str, 'utf8');
  const len = payload.length;
  const maskKey = crypto.randomBytes(4);
  let header;

  if (len < 126) {
    header = Buffer.alloc(2);
    header[0] = 0x81; // FIN + Text frame
    header[1] = 0x80 | len; // Masked + length
  } else if (len < 65536) {
    header = Buffer.alloc(4);
    header[0] = 0x81;
    header[1] = 0x80 | 126;
    header.writeUInt16BE(len, 2);
  } else {
    header = Buffer.alloc(10);
    header[0] = 0x81;
    header[1] = 0x80 | 127;
    header.writeBigUInt64BE(BigInt(len), 2);
  }

  const maskedPayload = Buffer.alloc(len);
  for (let i = 0; i < len; i++) {
    maskedPayload[i] = payload[i] ^ maskKey[i & 3];
  }

  return Buffer.concat([header, maskKey, maskedPayload]);
}

function synthesizeEdgeTTS(text, voice) {
  return new Promise((resolve, reject) => {
    const connectionId = crypto.randomUUID().replace(/-/g, '');
    const secMsGec = generateSecMsGec();
    const wsKey = crypto.randomBytes(16).toString('base64');
    const pathAndQuery = `/consumer/speech/synthesize/readaloud/edge/v1?TrustedClientToken=${TRUSTED_CLIENT_TOKEN}&Sec-MS-GEC=${secMsGec}&Sec-MS-GEC-Version=${SEC_MS_GEC_VERSION}&ConnectionId=${connectionId}`;

    const socket = tls.connect({
      host: EDGE_HOST,
      port: 443,
      servername: EDGE_HOST,
    });

    let settled = false;
    let upgraded = false;
    let rxBuffer = Buffer.alloc(0);
    let fragOpcode = 0;
    let fragChunks = [];
    const audioChunks = [];

    const finish = (err, result) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      try {
        socket.destroy();
      } catch {}
      if (err) reject(err);
      else resolve(result);
    };

    const timeout = setTimeout(() => {
      finish(new Error('Edge TTS synthesis timed out'));
    }, 8000);

    socket.on('secureConnect', () => {
      const handshake =
        `GET ${pathAndQuery} HTTP/1.1\r\n` +
        `Host: ${EDGE_HOST}\r\n` +
        `Upgrade: websocket\r\n` +
        `Connection: Upgrade\r\n` +
        `Sec-WebSocket-Key: ${wsKey}\r\n` +
        `Sec-WebSocket-Version: 13\r\n` +
        `Pragma: no-cache\r\n` +
        `Cache-Control: no-cache\r\n` +
        `Origin: chrome-extension://jdiccldimpdaibmpdkjnbmckianbfold\r\n` +
        `User-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${CHROMIUM_FULL_VERSION} Safari/537.36 Edg/${CHROMIUM_FULL_VERSION}\r\n` +
        `Accept-Language: en-US,en;q=0.9\r\n\r\n`;

      socket.write(handshake);
    });

    const handleCompleteWsMessage = (opcode, msgBuffer) => {
      if (opcode === 0x2) {
        // Binary frame
        if (msgBuffer.length < 2) return;
        const headerLength = msgBuffer.readUInt16BE(0);
        if (msgBuffer.length < 2 + headerLength) return;
        const headerStr = msgBuffer.subarray(2, 2 + headerLength).toString('utf8');
        if (headerStr.includes('Path:audio')) {
          const audioData = msgBuffer.subarray(2 + headerLength);
          if (audioData.length > 0) {
            audioChunks.push(audioData);
          }
        }
      } else if (opcode === 0x1) {
        // Text frame
        const textMsg = msgBuffer.toString('utf8');
        if (textMsg.includes('Path:turn.end')) {
          const finalBuffer = Buffer.concat(audioChunks);
          if (finalBuffer.length === 0) {
            finish(new Error('Empty audio buffer from Edge TTS'));
          } else {
            finish(null, finalBuffer);
          }
        }
      } else if (opcode === 0x8) {
        // Close frame
        const finalBuffer = Buffer.concat(audioChunks);
        if (finalBuffer.length > 0) {
          finish(null, finalBuffer);
        } else {
          finish(new Error('WebSocket closed before audio received'));
        }
      }
    };

    const parseWsFrames = () => {
      while (rxBuffer.length >= 2 && !settled) {
        const byte0 = rxBuffer[0];
        const byte1 = rxBuffer[1];
        const fin = (byte0 & 0x80) !== 0;
        const opcode = byte0 & 0x0f;
        const masked = (byte1 & 0x80) !== 0;
        let payloadLen = byte1 & 0x7f;
        let offset = 2;

        if (payloadLen === 126) {
          if (rxBuffer.length < 4) return;
          payloadLen = rxBuffer.readUInt16BE(2);
          offset = 4;
        } else if (payloadLen === 127) {
          if (rxBuffer.length < 10) return;
          payloadLen = Number(rxBuffer.readBigUInt64BE(2));
          offset = 10;
        }

        const maskBytes = masked ? 4 : 0;
        if (rxBuffer.length < offset + maskBytes + payloadLen) return;

        let payload = rxBuffer.subarray(
          offset + maskBytes,
          offset + maskBytes + payloadLen
        );
        if (masked) {
          const mask = rxBuffer.subarray(offset, offset + 4);
          const unmasked = Buffer.alloc(payloadLen);
          for (let i = 0; i < payloadLen; i++) {
            unmasked[i] = payload[i] ^ mask[i & 3];
          }
          payload = unmasked;
        }

        rxBuffer = rxBuffer.subarray(offset + maskBytes + payloadLen);

        if (opcode === 0x8 || opcode === 0x9 || opcode === 0xA) {
          // Control frames (Close / Ping / Pong)
          handleCompleteWsMessage(opcode, payload);
          continue;
        }

        if (opcode !== 0x0) {
          fragOpcode = opcode;
          fragChunks = [payload];
        } else {
          fragChunks.push(payload);
        }

        if (fin) {
          const fullMessage =
            fragChunks.length === 1 ? fragChunks[0] : Buffer.concat(fragChunks);
          fragChunks = [];
          handleCompleteWsMessage(fragOpcode, fullMessage);
        }
      }
    };

    socket.on('data', (chunk) => {
      rxBuffer = Buffer.concat([rxBuffer, chunk]);

      if (!upgraded) {
        const headerEnd = rxBuffer.indexOf('\r\n\r\n');
        if (headerEnd === -1) return;

        const headerText = rxBuffer.subarray(0, headerEnd).toString('utf8');
        if (!headerText.startsWith('HTTP/1.1 101')) {
          finish(new Error(`Edge TTS handshake failed: ${headerText.split('\r\n')[0]}`));
          return;
        }

        upgraded = true;
        rxBuffer = rxBuffer.subarray(headerEnd + 4);

        // Send speech.config + SSML request
        const configMsg =
          `X-Timestamp:${new Date().toISOString()}\r\n` +
          `Content-Type:application/json; charset=utf-8\r\n` +
          `Path:speech.config\r\n\r\n` +
          JSON.stringify({
            context: {
              synthesis: {
                audio: {
                  metadataoptions: {
                    sentenceBoundaryEnabled: 'false',
                    wordBoundaryEnabled: 'false',
                  },
                  outputFormat: 'audio-24khz-48kbitrate-mono-mp3',
                },
              },
            },
          });

        const requestId = crypto.randomUUID().replace(/-/g, '');
        const langMatch = voice.match(/^[a-z]{2}-[A-Z]{2}/);
        const xmlLang = langMatch ? langMatch[0] : 'en-US';

        const ssml =
          `<speak version='1.0' xmlns='http://www.w3.org/2001/10/synthesis' xml:lang='${xmlLang}'>` +
          `<voice name='${voice}'>` +
          `<prosody pitch='+0Hz' rate='+0%' volume='+0%'>${escapeXml(text)}</prosody>` +
          `</voice>` +
          `</speak>`;

        const ssmlMsg =
          `X-RequestId:${requestId}\r\n` +
          `Content-Type:application/ssml+xml\r\n` +
          `X-Timestamp:${new Date().toISOString()}Z\r\n` +
          `Path:ssml\r\n\r\n` +
          ssml;

        socket.write(encodeWsTextFrame(configMsg));
        socket.write(encodeWsTextFrame(ssmlMsg));
      }

      parseWsFrames();
    });

    socket.on('error', (err) => finish(err));
    socket.on('end', () => {
      if (!settled) {
        const finalBuffer = Buffer.concat(audioChunks);
        if (finalBuffer.length > 0) finish(null, finalBuffer);
        else finish(new Error('Socket ended unexpectedly'));
      }
    });
  });
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');

  if (req.method === 'OPTIONS') {
    res.statusCode = 200;
    return res.end();
  }

  let rawText = '';
  let rawVoice = 'en-US-JennyNeural';

  if (req.query && typeof req.query === 'object') {
    rawText = (req.query.text || '').toString().trim();
    rawVoice = (req.query.voice || 'en-US-JennyNeural').toString().trim();
  } else if (req.url) {
    const parsedUrl = new URL(req.url, 'http://localhost');
    rawText = (parsedUrl.searchParams.get('text') || '').trim();
    rawVoice = (parsedUrl.searchParams.get('voice') || 'en-US-JennyNeural').trim();
  }

  if (!rawText || rawText.length > 300) {
    res.statusCode = 400;
    res.setHeader('Content-Type', 'application/json');
    return res.end(JSON.stringify({ error: 'Invalid or missing text parameter' }));
  }

  const voice = ALLOWED_VOICES.has(rawVoice) ? rawVoice : 'en-US-JennyNeural';

  try {
    const audioBuffer = await synthesizeEdgeTTS(rawText, voice);
    res.statusCode = 200;
    res.setHeader('Content-Type', 'audio/mpeg');
    res.setHeader('Content-Length', audioBuffer.length);
    // Vercel CDN edge permanent cache: 1 year
    res.setHeader('Cache-Control', 'public, max-age=31536000, s-maxage=31536000, immutable');
    return res.end(audioBuffer);
  } catch (error) {
    console.error('Edge TTS Error:', error);
    res.statusCode = 502;
    res.setHeader('Content-Type', 'application/json');
    return res.end(JSON.stringify({ error: 'Failed to synthesize speech' }));
  }
}
