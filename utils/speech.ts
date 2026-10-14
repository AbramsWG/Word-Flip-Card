import { WordEntry } from '../types';

export interface WordBoundary {
  word: string;
  offsetMs: number;
  durationMs: number;
}

export interface TTSData {
  audio: string; // base64 mp3
  boundaries: WordBoundary[];
  voice: string;
}

export interface NaturalVoiceOption {
  id: string;
  shortName: string;
  label: string;
  lang: string;
}

export const NATURAL_VOICES: NaturalVoiceOption[] = [
  { id: 'en-GB-SoniaNeural', shortName: 'Sonia (英音)', label: 'Sonia - 英式自然女声 (en-GB)', lang: 'en-GB' },
  { id: 'en-US-JennyNeural', shortName: 'Jenny (美音)', label: 'Jenny - 美式自然女声 (en-US)', lang: 'en-US' },
  { id: 'en-US-AnaNeural', shortName: 'Ana (童声)', label: 'Ana - 美式少儿童声 (en-US)', lang: 'en-US' },
];

const TTS_DB_NAME = 'smart_vocab_tts_db';
const TTS_STORE_NAME = 'tts_cache';

const memoryTTSCache = new Map<string, TTSData>();
const inflightRequests = new Map<string, Promise<TTSData>>();

let dbPromise: Promise<IDBDatabase> | null = null;
let sharedAudio: HTMLAudioElement | null = null;
let activePlaySessionId = 0;

function getSharedAudio(): HTMLAudioElement | null {
  if (typeof window === 'undefined') return null;
  if (!sharedAudio) {
    sharedAudio = new Audio();
    sharedAudio.preload = 'auto';
  }
  return sharedAudio;
}

function getTTSKey(text: string, voiceId: string): string {
  return `${voiceId}::${text.trim()}`;
}

function openTTSDatabase(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    if (typeof window === 'undefined' || !window.indexedDB) {
      reject(new Error('IndexedDB not supported'));
      return;
    }
    const request = window.indexedDB.open(TTS_DB_NAME, 1);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(TTS_STORE_NAME)) {
        db.createObjectStore(TTS_STORE_NAME);
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => {
      dbPromise = null;
      reject(request.error);
    };
  });
  return dbPromise;
}

async function getTTSFromIDB(key: string): Promise<TTSData | null> {
  try {
    const db = await openTTSDatabase();
    return new Promise((resolve) => {
      const tx = db.transaction(TTS_STORE_NAME, 'readonly');
      const store = tx.objectStore(TTS_STORE_NAME);
      const req = store.get(key);
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => resolve(null);
    });
  } catch {
    return null;
  }
}

async function saveTTSToIDB(key: string, data: TTSData): Promise<void> {
  try {
    const db = await openTTSDatabase();
    return new Promise((resolve) => {
      const tx = db.transaction(TTS_STORE_NAME, 'readwrite');
      const store = tx.objectStore(TTS_STORE_NAME);
      store.put(data, key);
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
    });
  } catch {
    // ignore storage errors
  }
}

export async function clearTTSCache(): Promise<void> {
  stopSpeech();
  memoryTTSCache.clear();
  inflightRequests.clear();
  try {
    const db = await openTTSDatabase();
    await new Promise<void>((resolve) => {
      const tx = db.transaction(TTS_STORE_NAME, 'readwrite');
      const store = tx.objectStore(TTS_STORE_NAME);
      store.clear();
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
    });
  } catch {
    // ignore
  }
}

export async function fetchOrGetCachedTTS(
  rawText: string,
  voiceId: string,
  urgent = false
): Promise<TTSData> {
  const cleanText = rawText.trim();
  const cacheKey = getTTSKey(cleanText, voiceId);

  // 1. Check L1 in-memory cache (0ms)
  const memCached = memoryTTSCache.get(cacheKey);
  if (memCached) {
    return memCached;
  }

  // 2. Check L2 IndexedDB persistent cache (~1ms)
  const idbCached = await getTTSFromIDB(cacheKey);
  if (idbCached && idbCached.audio) {
    memoryTTSCache.set(cacheKey, idbCached);
    return idbCached;
  }

  // 3. Deduplicate in-flight requests for the same word
  const existingPromise = inflightRequests.get(cacheKey);
  if (existingPromise) {
    return existingPromise;
  }

  // 4. Request from /api/tts (with v=2 param to bypass any legacy binary HTTP cache)
  const fetchPromise = (async () => {
    try {
      const params = new URLSearchParams({
        text: cleanText,
        voice: voiceId,
        v: '2',
      });
      if (urgent) {
        params.append('urgent', '1');
      }
      const response = await fetch(`/api/tts?${params.toString()}`, {
        method: 'GET',
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.error || `语音合成失败 (${response.status})`);
      }

      const data: TTSData = await response.json();
      memoryTTSCache.set(cacheKey, data);
      await saveTTSToIDB(cacheKey, data);
      return data;
    } finally {
      inflightRequests.delete(cacheKey);
    }
  })();

  inflightRequests.set(cacheKey, fetchPromise);
  return fetchPromise;
}

/**
 * Priority-based preloader:
 * 1. Exclusive Priority 0: Current card word (so even defaultSide === 'ENGLISH' is ready immediately)
 * 2. Priority 1: Adjacent sliding window cards (next 1, next 2, next 3, prev 1) + current word's spelling letters
 * 3. Priority 2: Background queue (concurrency = 2) for remaining words in current filter + alphabet letters
 */
export function preloadWordsTTS(options: {
  words: WordEntry[];
  currentIndex: number;
  voiceId: string;
  spellOutLoud: boolean;
}): () => void {
  const { words, currentIndex, voiceId, spellOutLoud } = options;
  if (!words || words.length === 0) return () => {};

  let cancelled = false;
  const activeVoice = voiceId || 'en-GB-SoniaNeural';

  const runPreload = async () => {
    const safeIdx = Math.max(0, Math.min(currentIndex, words.length - 1));
    const currentWord = words[safeIdx];

    // Step 1: Exclusive highest priority for the current visible card
    if (currentWord?.english) {
      try {
        await fetchOrGetCachedTTS(currentWord.english, activeVoice);
      } catch {
        // silent ignore
      }
    }

    if (cancelled) return;

    // Step 2: Sliding window around currentIndex (next 1, next 2, next 3, prev 1)
    const priorityTexts: string[] = [];
    const offsets = [1, 2, 3, -1];
    for (const offset of offsets) {
      const idx = (safeIdx + offset + words.length) % words.length;
      const w = words[idx];
      if (w?.english) {
        priorityTexts.push(w.english);
      }
    }

    // If spellOutLoud is enabled, prioritize letters of the current word right away
    if (spellOutLoud && currentWord?.english) {
      const currentLetters = Array.from(
        new Set(currentWord.english.toLowerCase().replace(/[^a-z]/g, '').split(''))
      );
      priorityTexts.push(...currentLetters);
    }

    for (const text of priorityTexts) {
      if (cancelled) return;
      const key = getTTSKey(text, activeVoice);
      if (!memoryTTSCache.has(key)) {
        try {
          await fetchOrGetCachedTTS(text, activeVoice);
          // Small pause between preload requests to prevent server spikes
          await new Promise(r => setTimeout(r, 200));
        } catch {
          // silent ignore
        }
      }
    }

    if (cancelled) return;

    // Step 3: Remaining words in the unit/grade list (ordered starting from currentIndex)
    const remainingTexts: string[] = [];
    for (let i = 0; i < words.length; i++) {
      const idx = (safeIdx + i) % words.length;
      const text = words[idx]?.english;
      if (text && !memoryTTSCache.has(getTTSKey(text, activeVoice))) {
        remainingTexts.push(text);
      }
    }

    if (spellOutLoud) {
      const alphabet = 'abcdefghijklmnopqrstuvwxyz'.split('');
      for (const letter of alphabet) {
        if (!memoryTTSCache.has(getTTSKey(letter, activeVoice))) {
          remainingTexts.push(letter);
        }
      }
    }

    if (remainingTexts.length === 0) return;

    // Concurrency = 1 with a healthy 350ms delay between words to avoid rate limiting
    let queueIndex = 0;
    while (!cancelled && queueIndex < remainingTexts.length) {
      const item = remainingTexts[queueIndex++];
      if (!item) continue;
      const key = getTTSKey(item, activeVoice);
      if (memoryTTSCache.has(key)) continue;
      try {
        await fetchOrGetCachedTTS(item, activeVoice);
        await new Promise(r => setTimeout(r, 350));
      } catch {
        // backoff a bit if rate limited or error
        await new Promise(r => setTimeout(r, 1000));
      }
    }
  };

  runPreload();

  return () => {
    cancelled = true;
  };
}

export const getAvailableVoices = (): SpeechSynthesisVoice[] => {
  if (typeof window === 'undefined' || !window.speechSynthesis) return [];

  const enVoices = window.speechSynthesis.getVoices().filter(v => v.lang.startsWith('en'));

  // 优质音色关键词匹配
  const premiumKeywords = ['jenny', 'microsoft ana', 'sonia', 'samantha', 'enhanced'];
  const premium = enVoices.filter(v => premiumKeywords.some(k => v.name.toLowerCase().includes(k)));

  // 优先返回优质音色，否则返回所有英文音色
  return premium.length > 0 ? premium : enVoices;
};

export const stopSpeech = (): void => {
  activePlaySessionId += 1;
  if (sharedAudio) {
    sharedAudio.pause();
    sharedAudio.onended = null;
    sharedAudio.onerror = null;
  }
  if (typeof window !== 'undefined' && window.speechSynthesis) {
    window.speechSynthesis.cancel();
  }
};

function speakLocal(text: string, voiceURI: string, rate: number, onEnd?: () => void): void {
  if (typeof window === 'undefined' || !window.speechSynthesis) return;
  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(text.toLowerCase());
  const voices = window.speechSynthesis.getVoices();
  const selectedVoice = voices.find(v => v.voiceURI === voiceURI);
  if (selectedVoice) {
    utterance.voice = selectedVoice;
    utterance.lang = selectedVoice.lang;
  } else {
    utterance.lang = 'en-US';
  }
  utterance.rate = rate || 1.0;
  if (onEnd) utterance.onend = () => onEnd();
  window.speechSynthesis.speak(utterance);
}

export const speak = (
  text: string,
  voiceURI: string,
  rate: number,
  onEnd?: () => void,
  options?: { useEdgeTTS?: boolean; edgeVoice?: string }
): void => {
  stopSpeech();
  const sessionId = activePlaySessionId;

  if (options?.useEdgeTTS) {
    const audio = getSharedAudio();
    if (!audio) {
      speakLocal(text, voiceURI, rate, onEnd);
      return;
    }

    const edgeVoiceId = options.edgeVoice || 'en-GB-SoniaNeural';

    (async () => {
      try {
        const ttsData = await fetchOrGetCachedTTS(text, edgeVoiceId, true);
        if (activePlaySessionId !== sessionId) return;

        audio.src = `data:audio/mp3;base64,${ttsData.audio}`;
        audio.currentTime = 0;
        audio.playbackRate = rate || 1.0;
        (audio as any).preservesPitch = true;
        (audio as any).webkitPreservesPitch = true;
        (audio as any).mozPreservesPitch = true;

        audio.onended = () => {
          if (activePlaySessionId === sessionId && onEnd) {
            onEnd();
          }
        };

        audio.onerror = (e) => {
          console.warn('Edge TTS Audio playback error, falling back to local speech:', e);
          if (activePlaySessionId === sessionId) {
            speakLocal(text, voiceURI, rate, onEnd);
          }
        };

        await audio.play();
      } catch (err) {
        if (activePlaySessionId !== sessionId) return;
        console.warn('Edge TTS fallback to local speech:', err);
        // Fallback gracefully so audio is never broken
        speakLocal(text, voiceURI, rate, onEnd);
      }
    })();
  } else {
    speakLocal(text, voiceURI, rate, onEnd);
  }
};

