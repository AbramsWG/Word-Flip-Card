
import React, { useState, useEffect, useRef } from 'react';
import htm from 'htm';
import * as Lucide from 'lucide-react';
import FlashCardContainer from './components/FlashCardContainer.js';
import WordInput from './components/WordInput.js';
import SettingsPanel from './components/SettingsPanel.js';
import { getAvailableVoices } from './utils/speech.js';

const html = htm.bind(React.createElement);

const App = () => {
  const [view, setView] = useState('LEARN');
  const [words, setWords] = useState([]);
  const [settings, setSettings] = useState({ speechRate: 1.0, voiceURI: '', hideMastered: false });
  const [isLoaded, setIsLoaded] = useState(false);
  const voicesInitialized = useRef(false);

  useEffect(() => {
    const savedWords = localStorage.getItem('smart_vocab_words_v3');
    const savedSettings = localStorage.getItem('smart_vocab_settings_v3');
    if (savedWords) setWords(JSON.parse(savedWords));
    if (savedSettings) setSettings(JSON.parse(savedSettings));
    setIsLoaded(true);
  }, []);

  useEffect(() => {
    const initializeVoice = () => {
      const voices = getAvailableVoices();
      if (voices.length > 0 && !voicesInitialized.current) {
        const isValid = voices.some(v => v.voiceURI === settings.voiceURI);
        if (!settings.voiceURI || !isValid) {
          setSettings(s => ({ ...s, voiceURI: voices[0].voiceURI }));
          voicesInitialized.current = true;
        }
      }
    };
    initializeVoice();
    if (window.speechSynthesis) window.speechSynthesis.onvoiceschanged = initializeVoice;
  }, [settings.voiceURI]);

  useEffect(() => {
    if (isLoaded) {
      localStorage.setItem('smart_vocab_words_v3', JSON.stringify(words));
      localStorage.setItem('smart_vocab_settings_v3', JSON.stringify(settings));
    }
  }, [words, settings, isLoaded]);

  const toggleMastery = (id) => {
    setWords(prev => prev.map(w => w.id === id ? { ...w, mastered: !w.mastered } : w));
  };
  
  const loadDefault = async () => {
    try {
      const res = await fetch('./words.md');
      const text = await res.text();
      let currentUnit = "General";
      const defaultWords = [];
      
      text.split('\n').forEach((line, i) => {
        const trimmed = line.trim();
        if (!trimmed) return;
        
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
            unit: currentUnit 
          });
        }
      });
      setWords(defaultWords);
    } catch (e) { alert('加载失败'); }
  };

  return html`
    <div className="min-h-screen flex flex-col bg-slate-50 text-slate-900">
      <header className="bg-white/80 backdrop-blur-md border-b px-6 py-4 flex items-center justify-between sticky top-0 z-50">
        <div className="flex items-center gap-3 cursor-pointer" onClick=${() => setView('LEARN')}>
          <div className="bg-indigo-600 p-2 rounded-xl text-white shadow-lg shadow-indigo-100"><${Lucide.BrainCircuit} size=${24} /></div>
          <h1 className="text-xl font-black text-slate-800 hidden sm:block">Smart Vocab</h1>
        </div>
        <nav className="flex gap-1 bg-slate-100 p-1 rounded-2xl border">
          <button onClick=${() => setView('LEARN')} className=${`px-6 py-2 rounded-xl text-sm font-bold transition-all ${view==='LEARN' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}>学习</button>
          <button onClick=${() => setView('INPUT')} className=${`px-6 py-2 rounded-xl text-sm font-bold transition-all ${view==='INPUT' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}>词库</button>
          <button onClick=${() => setView('SETTINGS')} className=${`px-6 py-2 rounded-xl text-sm font-bold transition-all ${view==='SETTINGS' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}>设置</button>
        </nav>
      </header>

      <main className="flex-1 flex flex-col items-center justify-center p-4">
        ${view === 'LEARN' && html`<${FlashCardContainer} words=${words} settings=${settings} onToggleMastery=${toggleMastery} onGoToInput=${() => setView('INPUT')} onLoadDefault=${loadDefault} />`}
        ${view === 'INPUT' && html`<${WordInput} initialWords=${words} onSave=${w => {setWords(w); setView('LEARN');}} />`}
        ${view === 'SETTINGS' && html`<${SettingsPanel} settings=${settings} onUpdateSettings=${setSettings} />`}
      </main>
    </div>
  `;
};

export default App;
