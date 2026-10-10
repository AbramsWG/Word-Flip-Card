import React, { useState, useEffect, useCallback, useRef } from 'react';
import * as Lucide from 'lucide-react';
import { Word, Settings } from '../types';
import { speak, preloadSpeech, stopSpeech } from '../utils/speech';

interface FlashCardProps {
  word: Word;
  settings: Settings;
  onToggleMastery: () => void;
}

const FlashCard: React.FC<FlashCardProps> = ({ word, settings, onToggleMastery }) => {
  if (!word) return null;

  const [isFlipped, setIsFlipped] = useState<boolean>(
    settings.practiceMode ? false : settings.defaultSide === 'ENGLISH'
  );
  const [userInput, setUserInput] = useState<string>('');
  const [testResult, setTestResult] = useState<'correct' | 'incorrect' | null>(null);
  const [isTested, setIsTested] = useState<boolean>(false);
  const [isSwitching, setIsSwitching] = useState<boolean>(false);
  const [prevWordId, setPrevWordId] = useState<string>(word.id);
  const [highlightedIndex, setHighlightedIndex] = useState<number>(-1);
  const [isAudioLoading, setIsAudioLoading] = useState<boolean>(false);
  const spellingSessionRef = useRef<number>(0);

  if (word.id !== prevWordId) {
    setPrevWordId(word.id);
    setIsSwitching(true);
    setHighlightedIndex(-1);
    setIsAudioLoading(false);
    spellingSessionRef.current++;
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
    if (isSwitching) {
      const timer = setTimeout(() => setIsSwitching(false), 700);
      return () => clearTimeout(timer);
    }
  }, [isSwitching]);

  // 当翻转回正面或切换卡片时停止正在进行的拼读
  useEffect(() => {
    if (!isFlipped) {
      setHighlightedIndex(-1);
      spellingSessionRef.current++;
      stopSpeech();
    }
  }, [isFlipped]);

  const handleFlip = useCallback(() => {
    if (settings.practiceMode && !isTested && !isFlipped) {
      return;
    }
    setIsFlipped((v) => !v);
  }, [settings.practiceMode, isTested, isFlipped]);

  const handleSpeak = useCallback(
    async (text: string) => {
      setHighlightedIndex(-1);
      const sessionId = ++spellingSessionRef.current;
      const useEdge = settings.useEdgeTTS !== false;

      // 若开启了逐字母朗读，在朗读完整单词的同时静默预热所有字母音频
      if (settings.spellOutLoud && useEdge) {
        preloadSpeech(text, settings.voiceURI, true, true);
      }

      setIsAudioLoading(true);
      const loadingTimer = setTimeout(() => setIsAudioLoading(false), 600);

      await speak(
        text,
        settings.voiceURI,
        settings.speechRate,
        () => {
          clearTimeout(loadingTimer);
          setIsAudioLoading(false);

          if (settings.spellOutLoud && sessionId === spellingSessionRef.current) {
            const letters = text.replace(/[^a-zA-Z]/g, '').split('');
            let current = 0;

            const spellNext = () => {
              if (sessionId !== spellingSessionRef.current) return;

              if (current < letters.length) {
                setHighlightedIndex(current);
                speak(
                  letters[current],
                  settings.voiceURI,
                  settings.speechRate,
                  () => {
                    current++;
                    setTimeout(spellNext, 100);
                  },
                  useEdge
                );
              } else {
                setHighlightedIndex(-1);
              }
            };

            setTimeout(spellNext, 350);
          }
        },
        useEdge
      );

      clearTimeout(loadingTimer);
      setIsAudioLoading(false);
    },
    [settings.voiceURI, settings.speechRate, settings.spellOutLoud, settings.useEdgeTTS]
  );

  const handleTest = (e: React.SyntheticEvent) => {
    e.preventDefault();
    e.stopPropagation();

    const normalize = (str: string) =>
      str
        .toLowerCase()
        .replace(/[^a-z0-9\s]/g, '')
        .replace(/\s+/g, ' ')
        .trim();

    const isCorrect = normalize(userInput) === normalize(word.english);
    setTestResult(isCorrect ? 'correct' : 'incorrect');
    setIsTested(true);
    if (isCorrect) {
      setTimeout(() => {
        setIsFlipped(true);
        handleSpeak(word.english);
      }, 800);
    }
  };

  const handleAction = (e: React.SyntheticEvent, action: () => void) => {
    e.preventDefault();
    e.stopPropagation();
    action();
  };

  const stopPropagation = (e: React.SyntheticEvent) => {
    e.stopPropagation();
  };

  const getFontSizeClass = (text: string) => {
    const len = text.length;
    if (len < 15) return 'text-5xl sm:text-7xl';
    if (len < 25) return 'text-4xl sm:text-5xl';
    return 'text-2xl sm:text-3xl';
  };

  const segments = word.english.split(/(\s+)/);

  return (
    <div className="perspective-1000 w-full h-[450px] group select-none relative">
      <div
        className={`relative w-full h-full transition-transform duration-700 preserve-3d ${
          isFlipped ? 'rotate-y-180' : ''
        }`}
      >
        {/* 正面: 中文 */}
        <div
          onClick={handleFlip}
          style={{ zIndex: isFlipped ? 0 : 10 }}
          className={`absolute inset-0 w-full h-full backface-hidden bg-[#A7F3D0] rounded-[2.5rem] shadow-2xl border border-[#A7F3D0] flex flex-col p-8 sm:p-10 overflow-hidden cursor-pointer transition-all duration-300 ${
            isFlipped ? 'opacity-0' : 'opacity-100'
          }`}
        >
          <div className="absolute top-0 right-0 p-8 text-emerald-900 opacity-5 pointer-events-none">
            <Lucide.BrainCircuit size={180} />
          </div>

          <div className="flex justify-between items-start relative z-30">
            <div className="bg-emerald-900/10 p-2.5 rounded-xl text-emerald-900">
              <Lucide.BrainCircuit size={28} />
            </div>
            <button
              onClick={(e) => handleAction(e, onToggleMastery)}
              onPointerDown={stopPropagation}
              className={`transition-all transform active:scale-90 p-2 rounded-full ${
                word.mastered
                  ? 'text-emerald-700'
                  : 'text-emerald-900/20 hover:text-emerald-900/40'
              }`}
            >
              <Lucide.CheckCircle2 size={40} />
            </button>
          </div>

          <div className="flex-1 flex flex-col items-center justify-center text-center px-4 z-10 pointer-events-none">
            {isSwitching && settings.defaultSide === 'ENGLISH' ? null : (
              <div className="flex flex-col items-center gap-4">
                {word.chinese.split('\n').map((line, i) => (
                  <p
                    key={i}
                    className={
                      i === 0
                        ? 'text-3xl sm:text-5xl font-extrabold text-slate-900 leading-tight tracking-tight'
                        : 'text-lg sm:text-2xl font-medium text-slate-700 leading-snug max-w-[90%] opacity-80 border-t border-emerald-900/10 pt-2'
                    }
                  >
                    {line}
                  </p>
                ))}
              </div>
            )}

            {settings.practiceMode && (
              <div
                className="mt-8 w-full max-w-xs pointer-events-auto flex flex-col items-center"
                onClick={stopPropagation}
              >
                <div className="relative w-full">
                  <input
                    type="text"
                    value={userInput || ''}
                    autoCapitalize="none"
                    autoCorrect="off"
                    autoComplete="off"
                    spellCheck={false}
                    enterKeyHint="done"
                    onChange={(e) => setUserInput(e.target.value)}
                    placeholder="输入英文单词..."
                    className={`w-full px-6 py-4 rounded-2xl border-2 outline-none transition-all font-bold text-center text-xl ${
                      testResult === 'correct'
                        ? 'border-emerald-500 bg-emerald-50 text-emerald-700'
                        : 'border-emerald-900/10 bg-white/50 focus:border-[#87D2B2] focus:bg-white'
                    }`}
                    onKeyDown={(e) => e.key === 'Enter' && handleTest(e)}
                  />
                  {testResult && (
                    <div className="absolute -right-12 top-1/2 -translate-y-1/2">
                      {testResult === 'correct' ? (
                        <Lucide.CheckCircle2
                          className="text-emerald-500 animate-bounce"
                          size={32}
                        />
                      ) : (
                        <Lucide.XCircle
                          className="text-white fill-orange-500 animate-shake"
                          size={32}
                        />
                      )}
                    </div>
                  )}
                </div>
                <button
                  onClick={handleTest}
                  className={`mt-6 p-5 sm:p-6 rounded-full shadow-lg border transition-all active:scale-90 flex items-center justify-center ${
                    testResult === 'correct'
                      ? 'bg-emerald-100/80 text-emerald-600 border-emerald-200/50'
                      : 'bg-white/40 text-emerald-900/30 border-emerald-900/5 hover:bg-white/60 hover:text-emerald-900/50'
                  }`}
                >
                  <Lucide.Zap size={32} />
                </button>
              </div>
            )}
          </div>
          <div className="text-center text-emerald-900/40 text-sm font-bold z-10 animate-pulse pointer-events-none">
            {settings.practiceMode && !isTested ? '请先完成拼写测试' : '点击翻转'}
          </div>
        </div>

        {/* 反面: 英文 */}
        <div
          onClick={handleFlip}
          style={{ zIndex: isFlipped ? 10 : 0 }}
          className={`absolute inset-0 w-full h-full backface-hidden bg-indigo-600 rounded-[2.5rem] shadow-2xl border-2 border-indigo-500 flex flex-col p-8 sm:p-10 rotate-y-180 text-white cursor-pointer transition-all duration-300 ${
            isFlipped ? 'opacity-100' : 'opacity-0'
          }`}
        >
          <div className="absolute top-0 right-0 p-8 text-white opacity-10 pointer-events-none">
            <Lucide.BrainCircuit size={180} />
          </div>

          <div className="flex justify-between items-start relative z-30">
            <div className="bg-white/20 p-2.5 rounded-xl text-white">
              <Lucide.BrainCircuit size={28} />
            </div>
            <button
              onClick={(e) => handleAction(e, onToggleMastery)}
              onPointerDown={stopPropagation}
              className={`transition-all transform active:scale-90 p-2 rounded-full ${
                word.mastered ? 'text-green-300' : 'text-white/30 hover:text-white/50'
              }`}
            >
              <Lucide.CheckCircle2 size={40} />
            </button>
          </div>

          <div className="flex-1 flex flex-col items-center justify-center text-center px-2 z-10 relative">
            {isSwitching && settings.defaultSide === 'CHINESE' ? null : (
              <>
                <h3
                  key="word-eng"
                  className={`font-extrabold tracking-tight mb-8 leading-tight break-words hyphens-auto flex flex-wrap justify-center items-center ${getFontSizeClass(
                    word.english
                  )}`}
                >
                  {segments.map((segment, sIndex) => {
                    if (/^\s+$/.test(segment)) {
                      return (
                        <span key={`s-${sIndex}`} className="inline-block whitespace-pre">
                          {'\u00A0'}
                        </span>
                      );
                    }

                    const prefixLength = segments.slice(0, sIndex).join('').length;
                    return (
                      <span key={`w-${sIndex}`} className="inline-block whitespace-nowrap">
                        {segment.split('').map((char, cIndex) => {
                          const absoluteIndex = prefixLength + cIndex;
                          const isLetter = /[a-zA-Z]/.test(char);
                          const letterIndex = isLetter
                            ? word.english
                                .substring(0, absoluteIndex)
                                .replace(/[^a-zA-Z]/g, '').length
                            : -1;
                          const isHighlighted =
                            isLetter && highlightedIndex !== -1 && highlightedIndex === letterIndex;

                          return (
                            <span
                              key={cIndex}
                              className={`transition duration-200 ${
                                isHighlighted ? 'text-yellow-300 scale-125 inline-block' : ''
                              }`}
                            >
                              {char}
                            </span>
                          );
                        })}
                      </span>
                    );
                  })}
                </h3>
                <button
                  key="word-audio"
                  onClick={(e) => handleAction(e, () => handleSpeak(word.english))}
                  onPointerDown={stopPropagation}
                  className="p-6 sm:p-8 bg-white/20 hover:bg-white/30 rounded-full transition-all group/speak active:scale-90 shadow-lg relative z-40"
                >
                  {isAudioLoading ? (
                    <Lucide.Loader2
                      size={40}
                      className="sm:w-11 sm:h-11 animate-spin text-white/90"
                    />
                  ) : (
                    <Lucide.Volume2
                      size={40}
                      className="sm:w-11 sm:h-11 group-hover/speak:scale-110 transition-transform"
                    />
                  )}
                </button>
              </>
            )}
          </div>
          <div className="text-center text-indigo-100 text-sm font-bold z-10 pointer-events-none">
            返回解释
          </div>
        </div>
      </div>
    </div>
  );
};

export default FlashCard;
