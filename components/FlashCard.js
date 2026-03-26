
import React, { useState, useEffect, useCallback } from 'react';
import htm from 'htm';
import * as Lucide from 'lucide-react';
import { speak } from '../utils/speech.js';

const html = htm.bind(React.createElement);

const FlashCard = ({ word, settings, onToggleMastery }) => {
  // 核心 Bug 修复：如果 word 不存在（在过滤瞬间可能发生），直接返回 null
  if (!word) return null;

  const [isFlipped, setIsFlipped] = useState(settings.practiceMode ? false : settings.defaultSide === 'ENGLISH');
  const [userInput, setUserInput] = useState('');
  const [testResult, setTestResult] = useState(null); // null, 'correct', 'incorrect'
  const [isTested, setIsTested] = useState(false);
  const [isSwitching, setIsSwitching] = useState(false);
  const [prevWordId, setPrevWordId] = useState(word.id);

  // 核心修复：在渲染期间直接检测 ID 变化
  if (word.id !== prevWordId) {
    setPrevWordId(word.id);
    setIsSwitching(true);
    // 同步重置状态，防止渲染旧状态
    if (settings.practiceMode) {
      setIsFlipped(false);
    } else {
      setIsFlipped(settings.defaultSide === 'ENGLISH');
    }
    setUserInput('');
    setTestResult(null);
    setIsTested(false);
  }

  useEffect(() => {
    // 仅负责在动画结束后关闭“障眼法”
    if (isSwitching) {
      const timer = setTimeout(() => setIsSwitching(false), 700);
      return () => clearTimeout(timer);
    }
  }, [isSwitching]);

  const handleFlip = useCallback(() => {
    if (settings.practiceMode && !isTested && !isFlipped) {
      // 在练习模式下，如果还没测试且当前是正面，不允许翻转
      return;
    }
    setIsFlipped(v => !v);
  }, [settings.practiceMode, isTested, isFlipped]);

  const handleTest = (e) => {
    e.preventDefault();
    e.stopPropagation();
    const isCorrect = userInput.trim().toLowerCase() === word.english.trim().toLowerCase();
    setTestResult(isCorrect ? 'correct' : 'incorrect');
    setIsTested(true);
    if (isCorrect) {
      // 如果正确，延迟一小会儿自动翻转
      setTimeout(() => setIsFlipped(true), 800);
    }
  };

  const handleAction = (e, action) => {
    e.preventDefault();
    e.stopPropagation();
    action();
  };

  const stopPropagation = (e) => {
    e.stopPropagation();
  };

  const getFontSizeClass = (text) => {
    const len = text.length;
    if (len < 12) return 'text-5xl sm:text-7xl';
    if (len < 22) return 'text-4xl sm:text-5xl';
    return 'text-2xl sm:text-3xl';
  };

  return html`
    <div className="perspective-1000 w-full h-[450px] group select-none relative">
      <div className=${`relative w-full h-full transition-transform duration-700 preserve-3d ${isFlipped ? 'rotate-y-180' : ''}`}>
        
        <!-- 正面: 中文 -->
        <div 
          onClick=${handleFlip}
          style=${{ zIndex: isFlipped ? 0 : 10 }}
          className=${`absolute inset-0 w-full h-full backface-hidden bg-[#A7F3D0] rounded-[2.5rem] shadow-2xl border border-[#A7F3D0] flex flex-col p-8 sm:p-10 overflow-hidden cursor-pointer transition-all duration-300 ${isFlipped ? 'opacity-0' : 'opacity-100'}`}
        >
          <div className="absolute top-0 right-0 p-8 text-emerald-900 opacity-5 pointer-events-none">
            <${Lucide.BrainCircuit} size=${180} />
          </div>

          <div className="flex justify-between items-start relative z-30">
            <div className="bg-emerald-900/10 p-2.5 rounded-xl text-emerald-900">
              <${Lucide.BrainCircuit} size=${28} />
            </div>
            <button 
              onClick=${(e) => handleAction(e, onToggleMastery)}
              onPointerDown=${stopPropagation}
              className=${`transition-all transform active:scale-90 p-2 rounded-full ${word.mastered ? 'text-emerald-700' : 'text-emerald-900/20 hover:text-emerald-900/40'}`}
            >
              <${Lucide.CheckCircle2} size=${40} />
            </button>
          </div>

          <div className="flex-1 flex flex-col items-center justify-center text-center px-4 z-10 pointer-events-none">
            ${(isSwitching && settings.defaultSide === 'ENGLISH') ? null : html`
              <div className="flex flex-col items-center gap-4">
                ${word.chinese.split('\n').map((line, i) => html`
                  <p key=${i} className=${i === 0 ? "text-3xl sm:text-5xl font-extrabold text-slate-900 leading-tight tracking-tight" : "text-lg sm:text-2xl font-medium text-slate-700 leading-snug max-w-[90%] opacity-80 border-t border-emerald-900/10 pt-2"}>
                    ${line}
                  </p>
                `)}
              </div>
            `}

            ${settings.practiceMode && html`
              <div className="mt-8 w-full max-w-xs pointer-events-auto flex flex-col items-center" onClick=${stopPropagation}>
                <div className="relative w-full">
                  <input
                    type="text"
                    value=${userInput || ''}
                    onChange=${e => setUserInput(e.target.value)}
                    placeholder="输入英文单词..."
                    className=${`w-full px-6 py-4 rounded-2xl border-2 outline-none transition-all font-bold text-center text-xl ${
                      testResult === 'correct' ? 'border-emerald-500 bg-emerald-50 text-emerald-700' : 
                      'border-emerald-900/10 bg-white/50 focus:border-[#87D2B2] focus:bg-white'
                    }`}
                    onKeyDown=${e => e.key === 'Enter' && handleTest(e)}
                  />
                  ${testResult && html`
                    <div className="absolute -right-12 top-1/2 -translate-y-1/2">
                      ${testResult === 'correct' ? 
                        html`<${Lucide.CheckCircle2} className="text-emerald-500 animate-bounce" size=${32} />` : 
                        html`<${Lucide.XCircle} className="text-white fill-orange-500 animate-shake" size=${32} />`
                      }
                    </div>
                  `}
                </div>
                <button
                  onClick=${handleTest}
                  className=${`mt-6 p-5 sm:p-6 rounded-full shadow-lg border transition-all active:scale-90 flex items-center justify-center ${
                    testResult === 'correct' ? 'bg-emerald-100/80 text-emerald-600 border-emerald-200/50' : 
                    'bg-white/40 text-emerald-900/30 border-emerald-900/5 hover:bg-white/60 hover:text-emerald-900/50'
                  }`}
                >
                  <${Lucide.Zap} size=${32} />
                </button>
              </div>
            `}
          </div>
          <div className="text-center text-emerald-900/40 text-sm font-bold z-10 animate-pulse pointer-events-none">
            ${settings.practiceMode && !isTested ? '请先完成拼写测试' : '点击翻转'}
          </div>
        </div>

        <!-- 反面: 英文 -->
        <div 
          onClick=${handleFlip}
          style=${{ zIndex: isFlipped ? 10 : 0 }}
          className=${`absolute inset-0 w-full h-full backface-hidden bg-indigo-600 rounded-[2.5rem] shadow-2xl border-2 border-indigo-500 flex flex-col p-8 sm:p-10 rotate-y-180 text-white cursor-pointer transition-all duration-300 ${isFlipped ? 'opacity-100' : 'opacity-0'}`}
        >
           <div className="absolute top-0 right-0 p-8 text-white opacity-10 pointer-events-none">
            <${Lucide.BrainCircuit} size=${180} />
          </div>

          <div className="flex justify-between items-start relative z-30">
             <div className="bg-white/20 p-2.5 rounded-xl text-white">
              <${Lucide.BrainCircuit} size=${28} />
            </div>
            <button 
              onClick=${(e) => handleAction(e, onToggleMastery)}
              onPointerDown=${stopPropagation}
              className=${`transition-all transform active:scale-90 p-2 rounded-full ${word.mastered ? 'text-green-300' : 'text-white/30 hover:text-white/50'}`}
            >
              <${Lucide.CheckCircle2} size=${40} />
            </button>
          </div>

          <div className="flex-1 flex flex-col items-center justify-center text-center px-2 z-10 relative">
            ${(isSwitching && settings.defaultSide === 'CHINESE') ? null : html`
              <h3 key="word-eng" className=${`font-extrabold tracking-tight mb-8 leading-tight break-words hyphens-auto ${getFontSizeClass(word.english)}`}>
                ${word.english}
              </h3>
              <button
                key="word-audio"
                onClick=${(e) => handleAction(e, () => speak(word.english, settings.voiceURI, settings.speechRate))}
                onPointerDown=${stopPropagation}
                className="p-6 sm:p-8 bg-white/20 hover:bg-white/30 rounded-full transition-all group/speak active:scale-90 shadow-lg relative z-40"
              >
                <${Lucide.Volume2} size=${40} className="sm:w-11 sm:h-11 group-hover/speak:scale-110 transition-transform" />
              </button>
            `}
          </div>
          <div className="text-center text-indigo-100 text-sm font-bold z-10 pointer-events-none">返回解释</div>
        </div>
      </div>
    </div>
  `;
};

export default FlashCard;
