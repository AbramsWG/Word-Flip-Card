
import React, { useMemo, useEffect } from 'react';
import htm from 'htm';
import * as Lucide from 'lucide-react';
import FlashCard from './FlashCard.js';

const html = htm.bind(React.createElement);

const FlashCardContainer = ({ words, settings, progress, onUpdateProgress, onToggleMastery, onGoToInput, onLoadDefault }) => {
  const { currentIndex, selectedGrade, selectedUnits } = progress;

  // 动态计算所有存在的 Grade
  const allGrades = useMemo(() => {
    const grades = new Set();
    words.forEach(w => { if (w.grade) grades.add(w.grade); });
    return Array.from(grades);
  }, [words]);

  // 默认选择第一个年级
  useEffect(() => {
    if (allGrades.length > 0 && !selectedGrade) {
      onUpdateProgress({ selectedGrade: allGrades[0] });
    }
  }, [allGrades, selectedGrade]);

  // 动态计算当前年级下存在的 Unit
  const allUnits = useMemo(() => {
    const units = new Set();
    words.forEach(w => { 
      if (w.grade === selectedGrade && w.unit) units.add(w.unit); 
    });
    return Array.from(units).sort((a, b) => {
      const numA = parseInt(a.replace(/\D/g, '')) || 0;
      const numB = parseInt(b.replace(/\D/g, '')) || 0;
      return numA - numB;
    });
  }, [words, selectedGrade]);

  // 综合过滤逻辑：Grade 过滤 + Unit 过滤 + 已记住过滤
  const displayWords = useMemo(() => {
    let filtered = words;
    
    // 年级过滤
    if (selectedGrade) {
      filtered = filtered.filter(w => w.grade === selectedGrade);
    }

    // 单元过滤逻辑：多选，如果全不选或全选，显示全部
    if (selectedUnits.length > 0 && selectedUnits.length < allUnits.length) {
      filtered = filtered.filter(w => selectedUnits.includes(w.unit));
    }

    // 已记住过滤逻辑
    if (settings.hideMastered) {
      filtered = filtered.filter(w => !w.mastered);
    }
    
    return filtered;
  }, [words, selectedGrade, selectedUnits, allUnits, settings.hideMastered]);

  // 确保索引不越界
  useEffect(() => {
    if (displayWords.length > 0 && currentIndex >= displayWords.length) {
      onUpdateProgress({ currentIndex: Math.max(0, displayWords.length - 1) });
    }
  }, [displayWords.length, currentIndex]);

  const toggleUnit = (unit) => {
    const newUnits = selectedUnits.includes(unit) 
      ? selectedUnits.filter(u => u !== unit) 
      : [...selectedUnits, unit];
    onUpdateProgress({ selectedUnits: newUnits, currentIndex: 0 });
  };

  const handleGradeChange = (grade) => {
    onUpdateProgress({ selectedGrade: grade, selectedUnits: [], currentIndex: 0 });
  };

  const currentWord = displayWords[currentIndex];

  const handleNext = () => onUpdateProgress({ currentIndex: (currentIndex < displayWords.length - 1 ? currentIndex + 1 : 0) });
  const handlePrev = () => onUpdateProgress({ currentIndex: (currentIndex > 0 ? currentIndex - 1 : Math.max(0, displayWords.length - 1)) });

  if (words.length === 0) return html`
    <div className="flex flex-col items-center py-20 gap-8 text-center px-6">
      <div className="w-24 h-24 bg-indigo-100 text-indigo-600 rounded-full flex items-center justify-center shadow-inner"><${Lucide.BookOpen} size=${40} /></div>
      <div className="space-y-2">
        <h3 className="text-xl font-bold text-slate-800">词库目前是空的</h3>
        <p className="text-slate-500 max-w-xs">您可以加载内置的默认词库，或者手动输入您想背诵的单词。</p>
      </div>
      <div className="flex flex-col sm:flex-row gap-4">
        <button onClick=${onLoadDefault} className="px-8 py-4 bg-white border-2 border-indigo-600 text-indigo-600 rounded-2xl font-bold hover:bg-indigo-50 transition-colors">加载默认词库</button>
        <button onClick=${onGoToInput} className="px-8 py-4 bg-indigo-600 text-white rounded-2xl font-bold shadow-lg shadow-indigo-100 hover:bg-indigo-700 transition-colors">手动导入单词</button>
      </div>
    </div>
  `;

  return html`
    <div className="w-full max-w-4xl flex flex-col items-center gap-6">
      
      <!-- Grade 选择器 -->
      ${allGrades.length > 1 && html`
        <div className="w-full flex flex-col items-center gap-3 px-4">
          <div className="flex items-center gap-2 text-xs font-bold text-slate-400 uppercase tracking-widest self-start ml-4">
            <${Lucide.GraduationCap} size=${14} /> 选择年级
          </div>
          <div className="flex flex-wrap justify-center gap-2 p-1 bg-slate-200/50 rounded-2xl w-full">
            ${allGrades.map(grade => html`
              <button 
                key=${grade}
                onClick=${() => handleGradeChange(grade)}
                className=${`px-6 py-2 rounded-xl text-sm font-bold transition-all ${selectedGrade === grade ? 'bg-indigo-600 text-white shadow-md' : 'bg-white text-slate-600 hover:text-indigo-600'}`}
              >
                ${grade}
              </button>
            `)}
          </div>
        </div>
      `}

      <!-- Unit 选择器 -->
      ${allUnits.length > 0 && html`
        <div className="w-full flex flex-col items-center gap-3 px-4">
          <div className="flex items-center gap-2 text-xs font-bold text-slate-400 uppercase tracking-widest self-start ml-4">
            <${Lucide.Filter} size=${14} /> 筛选单元
          </div>
          <div className="flex flex-wrap justify-center gap-2 p-1 bg-slate-200/50 rounded-2xl w-full">
            ${allUnits.map(unit => {
              const isActive = selectedUnits.includes(unit) || selectedUnits.length === 0 || selectedUnits.length === allUnits.length;
              const isStrictlySelected = selectedUnits.includes(unit);
              return html`
                <button 
                  key=${unit}
                  onClick=${() => toggleUnit(unit)}
                  className=${`px-4 py-2 rounded-xl text-sm font-bold transition-all ${isStrictlySelected ? 'bg-indigo-600 text-white shadow-md' : 'bg-white text-slate-600 hover:text-indigo-600'}`}
                >
                  ${unit}
                </button>
              `;
            })}
          </div>
        </div>
      `}

      <div className="w-full flex items-center justify-between px-2 sm:px-12 mt-4">
        <button onClick=${handlePrev} className="p-4 bg-white rounded-full shadow-lg border active:scale-90 transition-all text-slate-600 shrink-0"><${Lucide.ChevronLeft} size=${32} /></button>
        
        <div className="flex-1 max-w-md mx-4">
          ${displayWords.length > 0 
            ? html`<${FlashCard} word=${currentWord} settings=${settings} onToggleMastery=${() => onToggleMastery(currentWord.id)} />`
            : html`
              <div className="h-[450px] w-full flex flex-col items-center justify-center bg-white rounded-[2.5rem] border-2 border-dashed border-slate-200 p-10 text-center">
                <div className="text-5xl mb-4">✨</div>
                <h3 className="text-xl font-bold text-slate-800">当前筛选条件下没有单词</h3>
                <p className="text-slate-400 mt-2">请尝试选择更多单元或在设置中显示已记住的单词</p>
              </div>
            `
          }
        </div>

        <button onClick=${handleNext} className="p-4 bg-white rounded-full shadow-lg border active:scale-90 transition-all text-slate-600 shrink-0"><${Lucide.ChevronRight} size=${32} /></button>
      </div>

      ${displayWords.length > 0 && html`
        <div className="flex flex-col items-center gap-2 mt-4">
          <div className="text-xs font-bold text-slate-400 uppercase tracking-widest">${currentIndex + 1} / ${displayWords.length}</div>
          <div className="w-48 h-1.5 bg-slate-200 rounded-full overflow-hidden shadow-inner">
            <div className="h-full bg-indigo-600 transition-all duration-500" style=${{ width: `${((currentIndex + 1) / displayWords.length) * 100}%` }} />
          </div>
        </div>
      `}
    </div>
  `;
};

export default FlashCardContainer;
