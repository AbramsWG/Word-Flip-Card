
import React, { useState, useEffect, useCallback } from 'react';
import htm from 'htm';
import * as Lucide from 'lucide-react';
import { speak } from '../utils/speech.js';

const html = htm.bind(React.createElement);

const FlashCard = ({ word, settings, onToggleMastery }) => {
  // 核心 Bug 修复：如果 word 不存在（在过滤瞬间可能发生），直接返回 null
  if (!word) return null;

  const [isFlipped, setIsFlipped] = useState(false);

  useEffect(() => {
    setIsFlipped(false);
  }, [word.id]);

  const handleFlip = useCallback(() => {
    setIsFlipped(v => !v);
  }, []);

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
            <div className="flex flex-col items-center gap-4">
              ${word.chinese.split('\n').map((line, i) => html`
                <p key=${i} className=${i === 0 ? "text-3xl sm:text-5xl font-extrabold text-slate-900 leading-tight tracking-tight" : "text-lg sm:text-2xl font-medium text-slate-700 leading-snug max-w-[90%] opacity-80 border-t border-emerald-900/10 pt-2"}>
                  ${line}
                </p>
              `)}
            </div>
          </div>
          <div className="text-center text-emerald-900/40 text-sm font-bold z-10 animate-pulse pointer-events-none">点击翻转</div>
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
            <h3 className=${`font-extrabold tracking-tight mb-8 leading-tight break-words hyphens-auto ${getFontSizeClass(word.english)}`}>
              ${word.english}
            </h3>
            <button
              onClick=${(e) => handleAction(e, () => speak(word.english, settings.voiceURI, settings.speechRate))}
              onPointerDown=${stopPropagation}
              className="p-6 sm:p-8 bg-white/20 hover:bg-white/30 rounded-full transition-all group/speak active:scale-90 shadow-lg relative z-40"
            >
              <${Lucide.Volume2} size=${40} className="sm:w-11 sm:h-11 group-hover/speak:scale-110 transition-transform" />
            </button>
          </div>
          <div className="text-center text-indigo-100 text-sm font-bold z-10 pointer-events-none">返回解释</div>
        </div>
      </div>
    </div>
  `;
};

export default FlashCard;
