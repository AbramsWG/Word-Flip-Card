
import React, { useState, useMemo } from 'react';
import { ChevronLeft, ChevronRight, PlusCircle, Filter, BookText } from 'lucide-react';
import { WordEntry, AppSettings } from '../types';
import FlashCard from './FlashCard';

interface FlashCardContainerProps {
  words: WordEntry[];
  settings: AppSettings;
  onToggleMastery: (id: string) => void;
  onGoToInput: () => void;
  onLoadDefault: () => void;
}

const FlashCardContainer: React.FC<FlashCardContainerProps> = ({ 
  words, 
  settings, 
  onToggleMastery,
  onGoToInput,
  onLoadDefault
}) => {
  const [currentIndex, setCurrentIndex] = useState(0);

  const displayWords = useMemo(() => {
    if (settings.hideMastered) {
      return words.filter(w => !w.mastered);
    }
    return words;
  }, [words, settings.hideMastered]);

  const currentWord = displayWords[currentIndex];

  const handleNext = () => {
    if (currentIndex < displayWords.length - 1) {
      setCurrentIndex(prev => prev + 1);
    } else {
      setCurrentIndex(0); // Loop back
    }
  };

  const handlePrev = () => {
    if (currentIndex > 0) {
      setCurrentIndex(prev => prev - 1);
    } else {
      setCurrentIndex(displayWords.length - 1); // Loop to end
    }
  };

  if (words.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-8 py-20 animate-in fade-in zoom-in duration-500">
        <div className="w-32 h-32 bg-indigo-100 text-indigo-600 rounded-full flex items-center justify-center">
          <PlusCircle size={64} strokeWidth={1.5} />
        </div>
        <div className="text-center">
          <h2 className="text-2xl font-bold text-slate-800">词库还是空的</h2>
          <p className="text-slate-500 mt-2">选择一个方式开始学习吧</p>
        </div>
        
        <div className="flex flex-col sm:flex-row gap-4">
          <button
            onClick={onLoadDefault}
            className="flex items-center gap-2 px-8 py-4 bg-white text-indigo-600 border-2 border-indigo-600 rounded-2xl font-bold hover:bg-indigo-50 transition-all shadow-lg"
          >
            <BookText size={20} />
            使用默认词库
          </button>
          <button
            onClick={onGoToInput}
            className="flex items-center gap-2 px-8 py-4 bg-indigo-600 text-white rounded-2xl font-bold hover:bg-indigo-700 transition-all shadow-xl shadow-indigo-100"
          >
            <PlusCircle size={20} />
            手动导入单词
          </button>
        </div>
      </div>
    );
  }

  if (displayWords.length === 0) {
    return (
      <div className="text-center py-20">
        <div className="w-24 h-24 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto mb-6">
          <Filter size={48} />
        </div>
        <h2 className="text-2xl font-bold text-slate-800">太棒了！</h2>
        <p className="text-slate-500 mt-2">当前列表所有单词都已记住。前往“设置”关闭“隐藏已记住”即可查看全部。</p>
      </div>
    );
  }

  return (
    <div className="w-full max-w-4xl flex flex-col items-center gap-8 animate-in fade-in duration-700">
      <div className="w-full flex items-center justify-between px-4 sm:px-12">
        <button 
          onClick={handlePrev}
          className="p-4 bg-white hover:bg-indigo-50 text-indigo-600 rounded-full shadow-lg border border-slate-100 transition-all active:scale-95 z-20"
        >
          <ChevronLeft size={32} />
        </button>

        <div className="flex-1 max-w-lg mx-4">
          <FlashCard 
            word={currentWord} 
            settings={settings}
            onToggleMastery={() => onToggleMastery(currentWord.id)}
          />
        </div>

        <button 
          onClick={handleNext}
          className="p-4 bg-white hover:bg-indigo-50 text-indigo-600 rounded-full shadow-lg border border-slate-100 transition-all active:scale-95 z-20"
        >
          <ChevronRight size={32} />
        </button>
      </div>

      <div className="flex flex-col items-center gap-2">
        <div className="text-sm font-medium text-slate-400">
          进度: <span className="text-indigo-600 font-bold">{currentIndex + 1}</span> / {displayWords.length}
        </div>
        <div className="w-48 h-1.5 bg-slate-200 rounded-full overflow-hidden">
          <div 
            className="h-full bg-indigo-600 transition-all duration-300"
            style={{ width: `${((currentIndex + 1) / displayWords.length) * 100}%` }}
          />
        </div>
      </div>
    </div>
  );
};

export default FlashCardContainer;
