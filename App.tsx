
import React, { useState, useEffect } from 'react';
import { Settings, Edit3, BookOpen, BrainCircuit } from 'lucide-react';
import { WordEntry, AppSettings, ViewMode } from './types';
import WordInput from './components/WordInput';
import FlashCardContainer from './components/FlashCardContainer';
import SettingsPanel from './components/SettingsPanel';
import { getAvailableVoices } from './utils/speech';

const STORAGE_KEY_WORDS = 'smart_vocab_words';
const STORAGE_KEY_SETTINGS = 'smart_vocab_settings';

const App: React.FC = () => {
  const [view, setView] = useState<ViewMode>(ViewMode.LEARN);
  const [words, setWords] = useState<WordEntry[]>([]);
  const [settings, setSettings] = useState<AppSettings>({
    speechRate: 1.0,
    voiceURI: '',
    hideMastered: false,
  });

  // Load from local storage
  useEffect(() => {
    const savedWords = localStorage.getItem(STORAGE_KEY_WORDS);
    const savedSettings = localStorage.getItem(STORAGE_KEY_SETTINGS);

    if (savedWords) setWords(JSON.parse(savedWords));
    if (savedSettings) {
      const parsedSettings = JSON.parse(savedSettings);
      setSettings(parsedSettings);
    }
  }, []);

  // Initialize Voice Logic - Auto-select the best voice on startup
  useEffect(() => {
    const initVoice = () => {
      const available = getAvailableVoices();
      if (available.length > 0 && !settings.voiceURI) {
        setSettings(prev => ({ ...prev, voiceURI: available[0].voiceURI }));
      }
    };

    // Try immediately
    initVoice();
    
    // Voices are often loaded asynchronously
    if (typeof window !== 'undefined' && window.speechSynthesis) {
      window.speechSynthesis.onvoiceschanged = initVoice;
    }
    
    return () => {
      if (typeof window !== 'undefined' && window.speechSynthesis) {
        window.speechSynthesis.onvoiceschanged = null;
      }
    };
  }, [settings.voiceURI]);

  // Save to local storage
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY_WORDS, JSON.stringify(words));
  }, [words]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY_SETTINGS, JSON.stringify(settings));
  }, [settings]);

  const handleUpdateWords = (newWords: WordEntry[]) => {
    setWords(newWords);
    setView(ViewMode.LEARN);
  };

  const loadDefaultWords = async () => {
    try {
      const response = await fetch('./words.md');
      const text = await response.text();
      const lines = text.split('\n').filter(line => line.trim().length > 0);
      
      const defaultWords: WordEntry[] = lines.map((line, index) => {
        const [english, ...chineseParts] = line.split('-').map(s => s.trim());
        const chinese = chineseParts.join('-').replace(/\s*\|\s*/g, '\n');
        return {
          id: `default-${index}-${Date.now()}`,
          english: english || 'Empty',
          chinese: chinese || '无解释',
          mastered: false
        };
      });

      setWords(defaultWords);
    } catch (error) {
      console.error('Failed to load default words:', error);
      alert('加载默认词库失败，请手动导入。');
    }
  };

  const toggleMastery = (id: string) => {
    setWords(prev => prev.map(w => w.id === id ? { ...w, mastered: !w.mastered } : w));
  };

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 text-slate-900">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between sticky top-0 z-50">
        <div className="flex items-center gap-2 cursor-pointer" onClick={() => setView(ViewMode.LEARN)}>
          <div className="bg-indigo-600 p-2 rounded-xl text-white">
            <BrainCircuit size={24} />
          </div>
          <h1 className="text-xl font-bold tracking-tight text-slate-800 hidden sm:block">Smart Vocab</h1>
        </div>

        <nav className="flex items-center gap-1 sm:gap-4 bg-slate-100 p-1 rounded-full">
          <button
            onClick={() => setView(ViewMode.LEARN)}
            className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium transition-all ${
              view === ViewMode.LEARN ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            <BookOpen size={18} />
            <span className="hidden xs:inline">学习</span>
          </button>
          <button
            onClick={() => setView(ViewMode.INPUT)}
            className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium transition-all ${
              view === ViewMode.INPUT ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            <Edit3 size={18} />
            <span className="hidden xs:inline">导入</span>
          </button>
          <button
            onClick={() => setView(ViewMode.SETTINGS)}
            className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium transition-all ${
              view === ViewMode.SETTINGS ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            <Settings size={18} />
            <span className="hidden xs:inline">设置</span>
          </button>
        </nav>
      </header>

      {/* Main Content */}
      <main className="flex-1 flex flex-col items-center justify-center p-4">
        {view === ViewMode.LEARN && (
          <FlashCardContainer 
            words={words} 
            settings={settings} 
            onToggleMastery={toggleMastery}
            onGoToInput={() => setView(ViewMode.INPUT)}
            onLoadDefault={loadDefaultWords}
          />
        )}
        {view === ViewMode.INPUT && (
          <WordInput initialWords={words} onSave={handleUpdateWords} />
        )}
        {view === ViewMode.SETTINGS && (
          <SettingsPanel settings={settings} onUpdateSettings={setSettings} />
        )}
      </main>

      <footer className="text-center py-4 text-xs text-slate-400">
        &copy; {new Date().getFullYear()} Smart Vocab Flip • 高效背词
      </footer>
    </div>
  );
};

export default App;
