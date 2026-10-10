import React, { useState, useEffect, useRef, useMemo } from 'react';
import { BrainCircuit } from 'lucide-react';
import FlashCardContainer from './components/FlashCardContainer';
import WordInput from './components/WordInput';
import SettingsPanel from './components/SettingsPanel';
import { getAvailableVoices, preloadWordsTTS } from './utils/speech';
import { WordEntry, AppSettings, LearningProgress, ViewMode } from './types';

const App: React.FC = () => {
  const [view, setView] = useState<ViewMode>('LEARN');
  const [words, setWords] = useState<WordEntry[]>([]);
  const [settings, setSettings] = useState<AppSettings>({
    speechRate: 1.0,
    voiceURI: '',
    hideMastered: false,
    defaultSide: 'CHINESE', // 'CHINESE' or 'ENGLISH'
    practiceMode: false,
    spellOutLoud: false,
    useEdgeTTS: true,
    edgeVoice: 'en-GB-SoniaNeural',
  });
  const [isLoaded, setIsLoaded] = useState(false);

  // 学习进度持久化状态
  const [learningProgress, setLearningProgress] = useState<LearningProgress>({
    currentIndex: 0,
    selectedGrade: '',
    selectedUnits: []
  });

  const voicesInitialized = useRef(false);

  useEffect(() => {
    const savedWords = localStorage.getItem('smart_vocab_words_v3');
    const savedSettings = localStorage.getItem('smart_vocab_settings_v3');
    const savedProgress = localStorage.getItem('smart_vocab_progress_v3');

    if (savedWords) setWords(JSON.parse(savedWords));
    if (savedSettings) {
      const parsed = JSON.parse(savedSettings);
      setSettings(prev => ({ ...prev, ...parsed }));
    }
    if (savedProgress) {
      const parsed = JSON.parse(savedProgress);
      setLearningProgress(prev => ({ ...prev, ...parsed }));
    }

    setIsLoaded(true);
  }, []);

  useEffect(() => {
    if (isLoaded && settings.practiceMode && settings.defaultSide !== 'CHINESE') {
      setSettings(prev => ({ ...prev, defaultSide: 'CHINESE' }));
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
      localStorage.setItem('smart_vocab_progress_v3', JSON.stringify(learningProgress));
    }
  }, [learningProgress, isLoaded]);

  // 计算当前激活筛选条件下的单词列表，用于顶层静默预加载（即使在设置页切换音色/默认面也立即预热）
  const activeDisplayWords = useMemo(() => {
    if (words.length === 0) return [];
    const allGrades = Array.from(new Set(words.filter(w => w.grade).map(w => w.grade!)));
    const activeGrade = learningProgress.selectedGrade || allGrades[0] || '';

    const allUnitsInGrade = Array.from(
      new Set(words.filter(w => w.grade === activeGrade && w.unit).map(w => w.unit!))
    );

    let filtered = words;
    if (activeGrade) {
      filtered = filtered.filter(w => w.grade === activeGrade);
    }
    if (
      learningProgress.selectedUnits.length > 0 &&
      learningProgress.selectedUnits.length < allUnitsInGrade.length
    ) {
      filtered = filtered.filter(
        w => w.unit && learningProgress.selectedUnits.includes(w.unit)
      );
    }
    if (settings.hideMastered) {
      filtered = filtered.filter(w => !w.mastered);
    }
    return filtered;
  }, [words, learningProgress.selectedGrade, learningProgress.selectedUnits, settings.hideMastered]);

  // 当开启 Edge TTS 时，按优先级预热当前卡片、前后相邻卡片及当前单元所有单词
  useEffect(() => {
    if (!isLoaded || !settings.useEdgeTTS || activeDisplayWords.length === 0) return;

    const cancelPreload = preloadWordsTTS({
      words: activeDisplayWords,
      currentIndex: learningProgress.currentIndex,
      voiceId: settings.edgeVoice || 'en-GB-SoniaNeural',
      spellOutLoud: settings.spellOutLoud,
    });

    return cancelPreload;
  }, [
    isLoaded,
    settings.useEdgeTTS,
    settings.edgeVoice,
    settings.spellOutLoud,
    activeDisplayWords,
    learningProgress.currentIndex,
  ]);

  const updateProgress = (newProgress: Partial<LearningProgress>) => {
    setLearningProgress(prev => ({ ...prev, ...newProgress }));
  };

  useEffect(() => {
    const initializeVoice = () => {
      const voices = getAvailableVoices();
      if (voices.length > 0 && !voicesInitialized.current) {
        const isValid = voices.some(v => v.voiceURI === settings.voiceURI);
        if (!settings.voiceURI || !isValid) {
          const soniaVoice = voices.find(v => v.name.toLowerCase().includes('sonia'));
          setSettings(s => ({ ...s, voiceURI: (soniaVoice || voices[0]).voiceURI }));
          voicesInitialized.current = true;
        }
      }
    };
    initializeVoice();
    if (window.speechSynthesis) window.speechSynthesis.onvoiceschanged = initializeVoice;
  }, [settings.voiceURI]);

  const toggleMastery = (id: string) => {
    setWords(prev => prev.map(w => w.id === id ? { ...w, mastered: !w.mastered } : w));
  };

  const loadDefault = async () => {
    try {
      const res = await fetch('./words.md');
      const text = await res.text();
      let currentGrade = "默认年级";
      let currentUnit = "General";
      const defaultWords: WordEntry[] = [];

      text.split('\n').forEach((line, i) => {
        const trimmed = line.trim();
        if (!trimmed) return;

        // 识别 Grade 标记 ***年级名称***
        const gradeMatch = trimmed.match(/^\*\*\*(.+)\*\*\*$/);
        if (gradeMatch) {
          currentGrade = gradeMatch[1];
          return;
        }

        // 识别 Unit 标记
        const unitMatch = trimmed.match(/---Unit\s*(\d+)---/i);
        if (unitMatch) {
          currentUnit = `Unit ${unitMatch[1]}`;
          return;
        }

        if (trimmed.includes('-')) {
          const parts = trimmed.split('-').map(s => s.trim());
          const eng = parts[0];
          const chi = parts.slice(1).join('-').replace(/\s*\|\s*/g, '\n');
          defaultWords.push({
            id: `def-${i}-${Date.now()}`,
            english: eng,
            chinese: chi,
            mastered: false,
            grade: currentGrade,
            unit: currentUnit
          });
        }
      });
      setWords(defaultWords);
    } catch (e) {
      alert('加载失败');
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 text-slate-900">
      <header className="bg-white/80 backdrop-blur-md border-b px-6 py-4 flex items-center justify-between sticky top-0 z-50">
        <div className="flex items-center gap-3 cursor-pointer" onClick={() => setView('LEARN')}>
          <div className="bg-indigo-600 p-2 rounded-xl text-white shadow-lg shadow-indigo-100">
            <BrainCircuit size={24} />
          </div>
          <h1 className="text-xl font-black text-slate-800 hidden sm:block">Smart Vocab</h1>
        </div>
        <nav className="flex gap-1 bg-slate-100 p-1 rounded-2xl border">
          <button
            onClick={() => setView('LEARN')}
            className={`px-6 py-2 rounded-xl text-sm font-bold transition-colors ${view === 'LEARN' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}
          >
            学习
          </button>
          <button
            onClick={() => setView('INPUT')}
            className={`px-6 py-2 rounded-xl text-sm font-bold transition-colors ${view === 'INPUT' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}
          >
            词库
          </button>
          <button
            onClick={() => setView('SETTINGS')}
            className={`px-6 py-2 rounded-xl text-sm font-bold transition-colors ${view === 'SETTINGS' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}
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
            onSave={w => {
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
