import { VoiceOption } from '../types';

export const CLOUD_NEURAL_VOICES: VoiceOption[] = [
  {
    voiceURI: 'en-US-JennyNeural',
    name: '✨ Jenny - 微软美式自然女声 (推荐)',
    lang: 'en-US',
    isCloud: true,
  },
  {
    voiceURI: 'en-GB-SoniaNeural',
    name: '✨ Sonia - 微软英式自然女声 (推荐)',
    lang: 'en-GB',
    isCloud: true,
  },
  {
    voiceURI: 'en-US-AnaNeural',
    name: '✨ Ana - 微软美式绘本童声',
    lang: 'en-US',
    isCloud: true,
  },
  {
    voiceURI: 'en-US-AvaNeural',
    name: '✨ Ava - 微软美式清晰女声',
    lang: 'en-US',
    isCloud: true,
  },
  {
    voiceURI: 'en-GB-RyanNeural',
    name: '✨ Ryan - 微软英式自然男声',
    lang: 'en-GB',
    isCloud: true,
  },
];

const CLOUD_VOICE_MAP: Record<string, string> = {
  'en-US-JennyNeural': 'jenny online (natural)',
  'en-GB-SoniaNeural': 'sonia online (natural)',
  'en-US-AnaNeural': 'ana online (natural)',
  'en-US-AvaNeural': 'ava online (natural)',
  'en-GB-RyanNeural': 'ryan online (natural)',
};

const DB_NAME = 'smart_vocab_tts_db_v1';
const STORE_NAME = 'tts_audio_store';

// 内存级 ObjectURL 缓存，实现 0ms 同步读取
const memoryUrlCache = new Map<string, string>();
// 正在请求中的 Promise 去重池，避免预加载与点击同时触发两次网络请求
const inflightRequests = new Map<string, Promise<string>>();

let sharedAudio: HTMLAudioElement | null = null;
let currentPlayToken = 0;

function getSharedAudio(): HTMLAudioElement {
  if (!sharedAudio && typeof window !== 'undefined') {
    sharedAudio = new Audio();
    sharedAudio.preload = 'auto';
  }
  return sharedAudio!;
}

function getCacheKey(voiceURI: string, text: string): string {
  return `${voiceURI}::${text.trim().toLowerCase()}`;
}

function openTTSDatabase(): Promise<IDBDatabase | null> {
  if (typeof window === 'undefined' || !window.indexedDB) {
    return Promise.resolve(null);
  }
  return new Promise((resolve) => {
    try {
      const request = window.indexedDB.open(DB_NAME, 1);
      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME);
        }
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

async function getBlobFromIndexedDB(key: string): Promise<Blob | null> {
  const db = await openTTSDatabase();
  if (!db) return null;
  return new Promise((resolve) => {
    try {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const req = store.get(key);
      req.onsuccess = () => {
        const result = req.result;
        resolve(result instanceof Blob ? result : null);
      };
      req.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

async function saveBlobToIndexedDB(key: string, blob: Blob): Promise<void> {
  const db = await openTTSDatabase();
  if (!db) return;
  return new Promise((resolve) => {
    try {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      store.put(blob, key);
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
    } catch {
      resolve();
    }
  });
}

/**
 * 检测当前设备（如电脑端 Edge 浏览器）是否已经内置了对应的微软 Natural 语音
 * 如果已内置，则直接走本地 Web Speech API，0 服务端消耗
 */
function findLocalMatchingNaturalVoice(voiceURI: string): SpeechSynthesisVoice | null {
  if (typeof window === 'undefined' || !window.speechSynthesis) return null;
  const targetKeyword = CLOUD_VOICE_MAP[voiceURI];
  if (!targetKeyword) return null;
  const voices = window.speechSynthesis.getVoices();
  return voices.find((v) => v.name.toLowerCase().includes(targetKeyword)) || null;
}

export const getAvailableVoices = (useEdgeTTS: boolean = true): VoiceOption[] => {
  if (useEdgeTTS) {
    return [...CLOUD_NEURAL_VOICES];
  }

  if (typeof window === 'undefined' || !window.speechSynthesis) return [];

  const enVoices = window.speechSynthesis
    .getVoices()
    .filter((v) => v.lang.startsWith('en'));

  // 原有优质本地音色关键词匹配
  const premiumKeywords = ['jenny', 'microsoft ana', 'sonia', 'samantha', 'enhanced'];
  const premium = enVoices.filter((v) =>
    premiumKeywords.some((k) => v.name.toLowerCase().includes(k))
  );
  const selectedList = premium.length > 0 ? premium : enVoices;

  return selectedList.map((v) => ({
    voiceURI: v.voiceURI,
    name: v.name.replace(/Microsoft |Google |Apple /g, ''),
    lang: v.lang,
    isCloud: false,
  }));
};

/**
 * 获取或拉取云端语音的本地 ObjectURL（先后查找：内存 -> IndexedDB -> /api/tts）
 */
async function getOrCreateAudioUrl(text: string, voiceURI: string): Promise<string> {
  const normalized = text.trim().toLowerCase();
  const key = getCacheKey(voiceURI, normalized);

  // 1. 内存级命中（0ms）
  const memUrl = memoryUrlCache.get(key);
  if (memUrl) return memUrl;

  // 2. 复用正在进行的相同请求
  const existingPromise = inflightRequests.get(key);
  if (existingPromise) return existingPromise;

  const fetchPromise = (async () => {
    try {
      // 3. 查找浏览器 IndexedDB 持久化缓存
      const cachedBlob = await getBlobFromIndexedDB(key);
      if (cachedBlob && cachedBlob.size > 0) {
        const url = URL.createObjectURL(cachedBlob);
        memoryUrlCache.set(key, url);
        return url;
      }

      // 4. 请求 /api/tts（支持 Vercel CDN 边缘缓存）
      const params = new URLSearchParams({
        text: normalized,
        voice: voiceURI,
      });
      const response = await fetch(`/api/tts?${params.toString()}`);
      if (!response.ok) {
        throw new Error(`TTS HTTP ${response.status}`);
      }
      const blob = await response.blob();
      if (!blob || blob.size === 0) {
        throw new Error('Empty TTS blob');
      }

      // 异步写入 IndexedDB 供下次永久复用
      saveBlobToIndexedDB(key, blob);

      const url = URL.createObjectURL(blob);
      memoryUrlCache.set(key, url);
      return url;
    } finally {
      inflightRequests.delete(key);
    }
  })();

  inflightRequests.set(key, fetchPromise);
  return fetchPromise;
}

/**
 * 后台静默预加载指定文本音频（若本地 Edge 已自带该自然语音则无需网络预加载）
 */
export async function preloadSpeech(
  text: string,
  voiceURI: string = 'en-US-JennyNeural',
  spellOutLoud: boolean = false,
  useEdgeTTS: boolean = true
): Promise<void> {
  if (!useEdgeTTS || !text || typeof window === 'undefined') return;
  const effectiveVoice = voiceURI || 'en-US-JennyNeural';
  const isCloudVoice = Boolean(CLOUD_VOICE_MAP[effectiveVoice]);

  // 如果选中的是本地系统语音，或者当前是电脑端 Edge 浏览器自带该 Natural 音色，0 网络请求
  if (!isCloudVoice || findLocalMatchingNaturalVoice(effectiveVoice)) {
    return;
  }

  try {
    await getOrCreateAudioUrl(text, effectiveVoice);
    if (spellOutLoud) {
      const uniqueLetters = Array.from(
        new Set(text.toLowerCase().replace(/[^a-z]/g, '').split(''))
      );
      // 小批量静默预热当前单词包含的字母
      await Promise.allSettled(
        uniqueLetters.map((letter) => getOrCreateAudioUrl(letter, effectiveVoice))
      );
    }
  } catch {
    // 静默预加载忽略网络异常，真正点击时会自动重试或兜底
  }
}

/**
 * 原生 Web Speech API 朗读（用于关闭 Edge TTS 时、电脑端 Edge 直连或断网兜底）
 */
function speakWithNativeSynthesis(
  text: string,
  voiceURI: string,
  rate: number,
  onEnd?: () => void,
  preferredVoice?: SpeechSynthesisVoice | null
) {
  if (typeof window === 'undefined' || !window.speechSynthesis) {
    if (onEnd) onEnd();
    return;
  }
  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(text.toLowerCase());
  const voices = window.speechSynthesis.getVoices();
  const selectedVoice =
    preferredVoice ||
    voices.find((v) => v.voiceURI === voiceURI);

  if (selectedVoice) utterance.voice = selectedVoice;
  utterance.rate = rate || 1.0;
  utterance.lang = 'en-US';
  if (onEnd) {
    utterance.onend = () => onEnd();
    utterance.onerror = () => onEnd();
  }
  window.speechSynthesis.speak(utterance);
}

/**
 * 停止当前正在播放的所有语音
 */
export function stopSpeech() {
  currentPlayToken++;
  if (sharedAudio) {
    try {
      sharedAudio.pause();
      sharedAudio.onended = null;
      sharedAudio.onerror = null;
    } catch {}
  }
  if (typeof window !== 'undefined' && window.speechSynthesis) {
    window.speechSynthesis.cancel();
  }
}

/**
 * 统一智能朗读入口：
 * 1. 若关闭了 useEdgeTTS -> 直接使用原来的本地 Web Speech API 方案
 * 2. 若在电脑端 Edge 检测到同名本地 Natural 音色 -> 直接用本地语音 (0 服务端消耗)
 * 3. 若开启 useEdgeTTS -> 优先读取内存 / IndexedDB / /api/tts 并通过 <audio> 变速播放
 * 4. 若断网或异常 -> 自动无缝降级回系统原生语音兜底
 */
export const speak = async (
  text: string,
  voiceURI: string,
  rate: number = 1.0,
  onEnd?: () => void,
  useEdgeTTS: boolean = true
): Promise<void> => {
  if (!text) {
    if (onEnd) onEnd();
    return;
  }

  const playToken = ++currentPlayToken;

  // 停止之前的播放
  if (sharedAudio) {
    try {
      sharedAudio.pause();
      sharedAudio.onended = null;
      sharedAudio.onerror = null;
    } catch {}
  }
  if (typeof window !== 'undefined' && window.speechSynthesis) {
    window.speechSynthesis.cancel();
  }

  // 如果开关关闭，直接使用原来旧的本地 TTS 方案
  if (!useEdgeTTS) {
    speakWithNativeSynthesis(text, voiceURI, rate, () => {
      if (playToken === currentPlayToken && onEnd) onEnd();
    });
    return;
  }

  const effectiveVoice = voiceURI || 'en-US-JennyNeural';
  const isCloudVoice = Boolean(CLOUD_VOICE_MAP[effectiveVoice]);

  // 智能检测：电脑端 Edge 已自带该 Natural 语音时直接本地播放
  const localNaturalVoice = findLocalMatchingNaturalVoice(effectiveVoice);
  if (!isCloudVoice || localNaturalVoice) {
    speakWithNativeSynthesis(text, effectiveVoice, rate, () => {
      if (playToken === currentPlayToken && onEnd) onEnd();
    }, localNaturalVoice);
    return;
  }

  try {
    const audioUrl = await getOrCreateAudioUrl(text, effectiveVoice);
    if (playToken !== currentPlayToken) return;

    const audio = getSharedAudio();
    audio.src = audioUrl;

    const clampedRate = Math.max(0.5, Math.min(2.0, rate || 1.0));
    audio.playbackRate = clampedRate;
    audio.defaultPlaybackRate = clampedRate;
    if ('preservesPitch' in audio) {
      (audio as any).preservesPitch = true;
    } else if ('webkitPreservesPitch' in audio) {
      (audio as any).webkitPreservesPitch = true;
    }

    audio.onended = () => {
      if (playToken === currentPlayToken && onEnd) {
        onEnd();
      }
    };

    audio.onerror = () => {
      if (playToken !== currentPlayToken) return;
      speakWithNativeSynthesis(text, effectiveVoice, rate, onEnd);
    };

    await audio.play();
  } catch {
    if (playToken !== currentPlayToken) return;
    // 网络异常或离线时自动降级回系统原生语音
    speakWithNativeSynthesis(text, effectiveVoice, rate, onEnd);
  }
};
