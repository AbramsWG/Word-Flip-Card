
import React, { useState, useMemo, useEffect, useRef } from 'react';
import htm from 'htm';
import * as Lucide from 'lucide-react';
import FlashCard from './FlashCard.js';

const html = htm.bind(React.createElement);

const FlashCardContainer = ({ words, settings, onUpdateSettings, progress, onUpdateProgress, onToggleMastery, onGoToInput, onLoadDefault }) => {
  const { currentIndex, selectedGrade, selectedUnits } = progress;
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const searchContainerRef = useRef(null);
  const searchInputRef = useRef(null);

  // 点击或触摸外部收起搜索下拉框（兼容 iOS / 触摸屏）
  useEffect(() => {
    const handlePointerOutside = (e) => {
      if (searchContainerRef.current && !searchContainerRef.current.contains(e.target)) {
        setIsSearchOpen(false);
      }
    };
    document.addEventListener('pointerdown', handlePointerOutside);
    document.addEventListener('touchstart', handlePointerOutside, { passive: true });
    return () => {
      document.removeEventListener('pointerdown', handlePointerOutside);
      document.removeEventListener('touchstart', handlePointerOutside);
    };
  }, []);

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

  // 搜索匹配逻辑（支持中英文模糊检索与优先级排序）
  const searchResults = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return [];

    const matched = words.filter(w => 
      w.english.toLowerCase().includes(q) || 
      w.chinese.toLowerCase().includes(q)
    );

    return matched.sort((a, b) => {
      const aEng = a.english.toLowerCase();
      const bEng = b.english.toLowerCase();
      const aChi = a.chinese.toLowerCase();
      const bChi = b.chinese.toLowerCase();

      // 完全匹配优先
      const aExact = aEng === q || aChi === q;
      const bExact = bEng === q || bChi === q;
      if (aExact && !bExact) return -1;
      if (!aExact && bExact) return 1;

      // 英文前缀匹配次之
      const aStarts = aEng.startsWith(q);
      const bStarts = bEng.startsWith(q);
      if (aStarts && !bStarts) return -1;
      if (!aStarts && bStarts) return 1;

      return 0;
    });
  }, [words, searchQuery]);

  // 选中搜索结果并智能定位到对应单词卡片
  const handleSelectSearchResult = (targetWord) => {
    if (!targetWord) return;

    const nextGrade = targetWord.grade || selectedGrade;

    // 计算目标年级下的所有单元
    const unitsInTargetGrade = Array.from(new Set(
      words.filter(w => w.grade === nextGrade && w.unit).map(w => w.unit)
    ));

    // 联动选中目标单词所在的单元
    const nextUnits = targetWord.unit ? [targetWord.unit] : [];

    // 处理“隐藏已记住单词”冲突
    let nextHideMastered = settings.hideMastered;
    if (settings.hideMastered && targetWord.mastered) {
      nextHideMastered = false;
      if (onUpdateSettings) {
        onUpdateSettings({ ...settings, hideMastered: false });
      }
    }

    // 按照同步后的筛选条件计算目标单词在列表中的索引
    let filtered = words;
    if (nextGrade) {
      filtered = filtered.filter(w => w.grade === nextGrade);
    }
    if (nextUnits.length > 0 && nextUnits.length < unitsInTargetGrade.length) {
      filtered = filtered.filter(w => nextUnits.includes(w.unit));
    }
    if (nextHideMastered) {
      filtered = filtered.filter(w => !w.mastered);
    }

    const targetIndex = filtered.findIndex(w => w.id === targetWord.id);

    onUpdateProgress({
      selectedGrade: nextGrade,
      selectedUnits: nextUnits,
      currentIndex: targetIndex !== -1 ? targetIndex : 0
    });

    setSearchQuery('');
    setIsSearchOpen(false);
    if (searchInputRef.current) {
      searchInputRef.current.blur();
    }
  };

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
      
      <!-- 全局单词搜索栏 -->
      <div ref=${searchContainerRef} className="w-full max-w-md px-4 relative z-40">
        <div className="relative flex items-center">
          <div className="absolute left-4 text-slate-400 pointer-events-none flex items-center">
            <${Lucide.Search} size=${18} />
          </div>
          <input
            ref=${searchInputRef}
            type="text"
            value=${searchQuery}
            autoCapitalize="none"
            autoCorrect="off"
            autoComplete="off"
            spellCheck="false"
            enterKeyHint="search"
            onFocus=${() => setIsSearchOpen(true)}
            onChange=${(e) => {
              setSearchQuery(e.target.value);
              setIsSearchOpen(true);
            }}
            onKeyDown=${(e) => {
              if (e.key === 'Enter' && searchResults.length > 0) {
                e.preventDefault();
                handleSelectSearchResult(searchResults[0]);
              } else if (e.key === 'Escape') {
                setIsSearchOpen(false);
                if (searchInputRef.current) searchInputRef.current.blur();
              }
            }}
            placeholder="搜索英文单词、短语或中文释义..."
            className="w-full pl-11 pr-10 py-3 bg-white border border-slate-200 rounded-2xl shadow-sm text-base sm:text-sm font-bold text-slate-700 placeholder:text-slate-400 placeholder:font-medium outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/10 transition-all"
          />
          ${searchQuery && html`
            <button
              onClick=${() => {
                setSearchQuery('');
                setIsSearchOpen(false);
              }}
              className="absolute right-3 p-1 text-slate-400 hover:text-slate-600 rounded-full hover:bg-slate-100 transition-colors"
            >
              <${Lucide.X} size=${16} />
            </button>
          `}
        </div>

        <!-- 搜索候选下拉列表 -->
        ${isSearchOpen && searchQuery.trim() && html`
          <div 
            style=${{ WebkitOverflowScrolling: 'touch' }}
            className="absolute left-4 right-4 mt-2 bg-white rounded-2xl shadow-xl border border-slate-100 max-h-72 overflow-y-auto overscroll-contain divide-y divide-slate-50"
          >
            ${searchResults.length > 0 ? searchResults.map((item, idx) => html`
              <button
                key=${item.id}
                onClick=${() => handleSelectSearchResult(item)}
                className="w-full px-4 py-3 text-left hover:bg-indigo-50/70 active:bg-indigo-100/80 transition-colors flex items-center justify-between gap-3 group"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-extrabold text-slate-800 group-hover:text-indigo-600 truncate transition-colors">
                      ${item.english}
                    </span>
                    ${item.mastered && html`
                      <span className="text-[10px] px-1.5 py-0.5 bg-emerald-50 text-emerald-600 rounded-md font-bold shrink-0">
                        已记住
                      </span>
                    `}
                    ${idx === 0 && html`
                      <span className="text-[10px] px-1.5 py-0.5 bg-slate-100 text-slate-400 rounded-md font-medium shrink-0 hidden sm:inline-block">
                        回车直达
                      </span>
                    `}
                  </div>
                  <p className="text-xs text-slate-500 truncate mt-0.5">
                    ${item.chinese.replace(/\n/g, ' ')}
                  </p>
                </div>
                <div className="flex flex-col items-end shrink-0 text-[11px] font-bold text-slate-400">
                  ${item.grade && html`<span className="text-indigo-500/80">${item.grade}</span>`}
                  ${item.unit && html`<span>${item.unit}</span>`}
                </div>
              </button>
            `) : html`
              <div className="px-4 py-8 text-center text-sm text-slate-400 font-medium">
                未找到包含 “<span className="text-slate-600 font-bold">${searchQuery}</span>” 的单词或短语
              </div>
            `}
          </div>
        `}
      </div>

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
                className=${`px-6 py-2 rounded-xl text-sm font-bold transition-colors ${selectedGrade === grade ? 'bg-indigo-600 text-white shadow-md' : 'bg-white text-slate-600 hover:text-indigo-600'}`}
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
                  className=${`px-4 py-2 rounded-xl text-sm font-bold transition-colors ${isStrictlySelected ? 'bg-indigo-600 text-white shadow-md' : 'bg-white text-slate-600 hover:text-indigo-600'}`}
                >
                  ${unit}
                </button>
              `;
            })}
          </div>
        </div>
      `}

      <div className="w-full flex items-center justify-between px-2 sm:px-12 mt-4">
        <button onClick=${handlePrev} className="p-4 bg-white rounded-full shadow-lg border transition-colors text-slate-600 shrink-0"><${Lucide.ChevronLeft} size=${32} /></button>
        
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

        <button onClick=${handleNext} className="p-4 bg-white rounded-full shadow-lg border transition-colors text-slate-600 shrink-0"><${Lucide.ChevronRight} size=${32} /></button>
      </div>

      ${displayWords.length > 0 && html`
        <div className="flex flex-col items-center gap-2 mt-4">
          <div className="text-xs font-bold text-slate-400 uppercase tracking-widest">${currentIndex + 1} / ${displayWords.length}</div>
          <div className="w-48 h-1.5 bg-slate-200 rounded-full overflow-hidden shadow-inner">
            <div className="h-full bg-indigo-600" style=${{ width: `${((currentIndex + 1) / displayWords.length) * 100}%` }} />
          </div>
        </div>
      `}
    </div>
  `;
};

export default FlashCardContainer;
