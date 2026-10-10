import React, { useState, useEffect, useRef } from 'react';
import * as Lucide from 'lucide-react';
import { Word, Settings, LearningProgress } from './types';
import FlashCardContainer from './components/FlashCardContainer';
import WordInput from './components/WordInput';
import SettingsPanel from './components/SettingsPanel';
import { getAvailableVoices } from './utils/speech';
import defaultWordsText from './words.md?raw';

const App: React.FC = () => {
  const [view, setView] = useState<'LEARN' | 'INPUT' | 'SETTINGS'>('LEARN');
  const [words, setWords] = useState<Word[]>([]);
  const [settings, setSettings] = useState<Settings>({
    speechRate: 1.0,
    voiceURI: 'en-US-JennyNeural',
    useEdgeTTS: true,
    hideMastered: false,
    defaultSide: 'CHINESE',
    practiceMode: false,
    spellOutLoud: false,
  });
  const [isLoaded, setIsLoaded] = useState<boolean>(false);

  const [learningProgress, setLearningProgress] = useState<LearningProgress>({
    currentIndex: 0,
    selectedGrade: '',
    selectedUnits: [],
  });

  const voicesInitialized = useRef<boolean>(false);

  useEffect(() => {
    const savedWords = localStorage.getItem('smart_vocab_words_v3');
    const savedSettings = localStorage.getItem('smart_vocab_settings_v3');
    const savedProgress = localStorage.getItem('smart_vocab_progress_v3');

    if (savedWords) {
      try {
        setWords(JSON.parse(savedWords));
      } catch {}
    }
    if (savedSettings) {
      try {
        const parsed = JSON.parse(savedSettings);
        const useEdge = parsed.useEdgeTTS !== false;
        if (
          useEdge &&
          (!parsed.voiceURI ||
            parsed.voiceURI.toLowerCase().includes('samantha'))
        ) {
          parsed.voiceURI = 'en-US-JennyNeural';
        }
        setSettings((prev) => ({ ...prev, ...parsed, useEdgeTTS: useEdge }));
      } catch {}
    }
    if (savedProgress) {
      try {
        const parsed = JSON.parse(savedProgress);
        setLearningProgress((prev) => ({ ...prev, ...parsed }));
      } catch {}
    }

    setIsLoaded(true);
  }, []);

  useEffect(() => {
    if (isLoaded && settings.practiceMode && settings.defaultSide !== 'CHINESE') {
      setSettings((prev) => ({ ...prev, defaultSide: 'CHINESE' }));
    }
  }, [settings.practiceMode, settings.defaultSide, isLoaded]);

  useEffect(() => {
    if (isLoaded) {
      localStorage.setItem('smart_vocab_words_v3', JSON.stringify(words));
    }
  }, [words, isLoaded]);

  useEffect(() => {
    if (isLoaded) {
      localStorage.setItem('smart_vocab_settings_v3', JSON.stringify(settings));
    }
  }, [settings, isLoaded]);

  useEffect(() => {
    if (isLoaded) {
      localStorage.setItem(
        'smart_vocab_progress_v3',
        JSON.stringify(learningProgress)
      );
    }
  }, [learningProgress, isLoaded]);

  const updateProgress = (newProgress: Partial<LearningProgress>) => {
    setLearningProgress((prev) => ({ ...prev, ...newProgress }));
  };

  useEffect(() => {
    const initializeVoice = () => {
      const voices = getAvailableVoices(settings.useEdgeTTS !== false);
      if (voices.length > 0) {
        const isValid = voices.some((v) => v.voiceURI === settings.voiceURI);
        if (!settings.voiceURI || !isValid) {
          setSettings((s) => ({ ...s, voiceURI: voices[0].voiceURI }));
          voicesInitialized.current = true;
        }
      }
    };
    initializeVoice();
    if (window.speechSynthesis) {
      window.speechSynthesis.onvoiceschanged = initializeVoice;
    }
  }, [settings.voiceURI, settings.useEdgeTTS]);

  const toggleMastery = (id: string) => {
    setWords((prev) =>
      prev.map((w) => (w.id === id ? { ...w, mastered: !w.mastered } : w))
    );
  };

  const loadDefault = async () => {
    try {
      let text = defaultWordsText;
      if (!text) {
        const res = await fetch('./words.md');
        text = await res.text();
      }
      let currentGrade = '默认年级';
      let currentUnit = 'General';
      const defaultWords: Word[] = [];

      text.split('\n').forEach((line, i) => {
        const trimmed = line.trim();
        if (!trimmed) return;

        const gradeMatch = trimmed.match(/^\*\*\*(.+)\*\*\*$/);
        if (gradeMatch) {
          currentGrade = gradeMatch[1];
          return;
        }

        const unitMatch = trimmed.match(/---Unit\s*(\d+)---/i);
        if (unitMatch) {
          currentUnit = `Unit ${unitMatch[1]}`;
          return;
        }

        if (trimmed.includes('-')) {
          const parts = trimmed.split('-').map((s) => s.trim());
          const eng = parts[0];
          const chi = parts.slice(1).join('-').replace(/\s*\|\s*/g, '\n');
          defaultWords.push({
            id: `def-${i}-${Date.now()}`,
            english: eng,
            chinese: chi,
            mastered: false,
            grade: currentGrade,
            unit: currentUnit,
          });
        }
      });
      setWords(defaultWords);
    } catch (e) {
      console.error('加载默认词库失败:', e);
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 text-slate-900">
      <header className="bg-white/80 backdrop-blur-md border-b px-6 py-4 flex items-center justify-between sticky top-0 z-50">
        <div
          className="flex items-center gap-3 cursor-pointer"
          onClick={() => setView('LEARN')}
        >
          <div className="bg-indigo-600 p-2 rounded-xl text-white shadow-lg shadow-indigo-100">
            <Lucide.BrainCircuit size={24} />
          </div>
          <h1 className="text-xl font-black text-slate-800 hidden sm:block">
            Smart Vocab
          </h1>
        </div>
        <nav className="flex gap-1 bg-slate-100 p-1 rounded-2xl border">
          <button
            onClick={() => setView('LEARN')}
            className={`px-6 py-2 rounded-xl text-sm font-bold transition-colors ${
              view === 'LEARN'
                ? 'bg-white text-indigo-600 shadow-sm'
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            学习
          </button>
          <button
            onClick={() => setView('INPUT')}
            className={`px-6 py-2 rounded-xl text-sm font-bold transition-colors ${
              view === 'INPUT'
                ? 'bg-white text-indigo-600 shadow-sm'
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            词库
          </button>
          <button
            onClick={() => setView('SETTINGS')}
            className={`px-6 py-2 rounded-xl text-sm font-bold transition-colors ${
              view === 'SETTINGS'
                ? 'bg-white text-indigo-600 shadow-sm'
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            设置
          </button>
        </nav>
      </header>

      <main className="flex-1 flex flex-col items-center justify-start pt-4 sm:pt-6 pb-8 px-4">
        {view === 'LEARN' && (
          <FlashCardContainer
            words={words}
            settings={settings}
            onUpdateSettings={setSettings}
            progress={learningProgress}
            onUpdateProgress={updateProgress}
            onToggleMastery={toggleMastery}
            onGoToInput={() => setView('INPUT')}
            onLoadDefault={loadDefault}
          />
        )}
        {view === 'INPUT' && (
          <WordInput
            initialWords={words}
            onSave={(w) => {
              setWords(w);
              setView('LEARN');
            }}
          />
        )}
        {view === 'SETTINGS' && (
          <SettingsPanel settings={settings} onUpdateSettings={setSettings} />
        )}
      </main>
    </div>
  );
};

export default App;
