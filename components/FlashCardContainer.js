
import React, { useState, useMemo, useEffect } from 'react';
import htm from 'htm';
import * as Lucide from 'lucide-react';
import FlashCard from './FlashCard.js';

const html = htm.bind(React.createElement);

const FlashCardContainer = ({ words, settings, onToggleMastery, onGoToInput, onLoadDefault }) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  
  const displayWords = useMemo(() => 
    settings.hideMastered ? words.filter(w => !w.mastered) : words, 
    [words, settings.hideMastered]
  );

  // 核心 Bug 修复：当显示列表长度变化（如单词被隐藏）时，确保索引不越界
  useEffect(() => {
    if (displayWords.length > 0 && currentIndex >= displayWords.length) {
      setCurrentIndex(displayWords.length - 1);
    }
  }, [displayWords.length, currentIndex]);

  const currentWord = displayWords[currentIndex];

  const handleNext = () => setCurrentIndex(c => (c < displayWords.length - 1 ? c + 1 : 0));
  const handlePrev = () => setCurrentIndex(c => (c > 0 ? c - 1 : Math.max(0, displayWords.length - 1)));

  if (words.length === 0) return html`
    <div className="flex flex-col items-center py-20 gap-8">
      <div className="w-24 h-24 bg-indigo-100 text-indigo-600 rounded-full flex items-center justify-center"><${Lucide.Plus} size=${48} /></div>
      <div className="flex gap-4">
        <button onClick=${onLoadDefault} className="px-8 py-4 bg-white border-2 border-indigo-600 text-indigo-600 rounded-2xl font-bold">默认词库</button>
        <button onClick=${onGoToInput} className="px-8 py-4 bg-indigo-600 text-white rounded-2xl font-bold">手动导入</button>
      </div>
    </div>
  `;

  if (displayWords.length === 0) return html`
    <div className="py-20 flex flex-col items-center gap-6">
      <div className="text-6xl text-emerald-500 animate-bounce">🎉</div>
      <div className="text-xl font-bold text-slate-800 text-center">所有单词都记住啦！<br/><span className="text-sm font-normal text-slate-500">（或者你可以在设置中关闭过滤）</span></div>
    </div>
  `;

  return html`
    <div className="w-full max-w-4xl flex flex-col items-center gap-10">
      <div className="w-full flex items-center justify-between px-4 sm:px-12">
        <button onClick=${handlePrev} className="p-4 bg-white rounded-full shadow-lg border active:scale-90 transition-all text-slate-600"><${Lucide.ChevronLeft} size=${32} /></button>
        <div className="flex-1 max-w-md mx-4">
          <!-- 确保 currentWord 存在才渲染 -->
          ${currentWord && html`<${FlashCard} word=${currentWord} settings=${settings} onToggleMastery=${() => onToggleMastery(currentWord.id)} />`}
        </div>
        <button onClick=${handleNext} className="p-4 bg-white rounded-full shadow-lg border active:scale-90 transition-all text-slate-600"><${Lucide.ChevronRight} size=${32} /></button>
      </div>
      <div className="flex flex-col items-center gap-2">
        <div className="text-xs font-bold text-slate-400 uppercase tracking-widest">${currentIndex + 1} / ${displayWords.length}</div>
        <div className="w-48 h-1.5 bg-slate-200 rounded-full overflow-hidden">
          <div className="h-full bg-indigo-600 transition-all duration-500" style=${{ width: `${((currentIndex + 1) / displayWords.length) * 100}%` }} />
        </div>
      </div>
    </div>
  `;
};

export default FlashCardContainer;
