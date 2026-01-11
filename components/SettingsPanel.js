
import React, { useState, useEffect, useCallback } from 'react';
import htm from 'htm';
import * as Lucide from 'lucide-react';
import { getAvailableVoices } from '../utils/speech.js';

const html = htm.bind(React.createElement);

const SettingsPanel = ({ settings, onUpdateSettings }) => {
  const [voices, setVoices] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  const loadVoices = useCallback(() => {
    const availableVoices = getAvailableVoices();
    if (availableVoices.length > 0) {
      setVoices(availableVoices);
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadVoices();
    
    // 某些浏览器需要一点时间加载语音包
    const timer = setTimeout(loadVoices, 100);
    const timerLong = setTimeout(loadVoices, 500);

    if (window.speechSynthesis) {
      window.speechSynthesis.onvoiceschanged = loadVoices;
    }
    
    return () => { 
      clearTimeout(timer);
      clearTimeout(timerLong);
      if (window.speechSynthesis) window.speechSynthesis.onvoiceschanged = null; 
    };
  }, [loadVoices]);

  const isHighQuality = (voice, allVoices) => {
    const uri = (voice.voiceURI || '').toLowerCase();
    const name = (voice.name || '').toLowerCase();
    
    const hasQualityKeyword = [
      'enhanced', 'premium', 'plus', 'hi-fi', 'high', 'natural', 'online'
    ].some(keyword => uri.includes(keyword) || name.includes(keyword));

    if (hasQualityKeyword) return true;

    const siblings = allVoices.filter(v => v.name === voice.name && v.lang === voice.lang);
    if (siblings.length > 1) {
      const longestUri = siblings.reduce((prev, current) => 
        (prev.voiceURI.length > current.voiceURI.length) ? prev : current
      );
      return voice.voiceURI === longestUri.voiceURI;
    }

    return false;
  };

  return html`
    <div className="w-full max-w-2xl p-4">
      <div className="bg-white p-8 sm:p-10 rounded-[3rem] shadow-xl border">
        <h2 className="text-3xl font-black mb-10 flex items-center gap-4 text-slate-800">
          <span className="p-3 bg-indigo-100 text-indigo-600 rounded-2xl"><${Lucide.Sliders} /></span>
          偏好设置
        </h2>
        
        <div className="space-y-10">
          <section className="space-y-4">
            <label className="text-sm font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2">
              <${Lucide.Globe} size=${16} /> 推荐音色 (精选英文)
            </label>
            
            <div className="grid grid-cols-1 gap-3 max-h-[350px] overflow-y-auto pr-2 custom-scrollbar">
              ${isLoading && voices.length === 0 ? html`
                <div className="flex flex-col items-center justify-center py-12 bg-slate-50 rounded-2xl border-2 border-dashed border-slate-200">
                  <div className="animate-spin text-indigo-600 mb-4"><${Lucide.Loader2} size=${32} /></div>
                  <p className="text-sm text-slate-400">正在检索系统音色...</p>
                </div>
              ` : voices.map(v => {
                const highQuality = isHighQuality(v, voices);
                const isSelected = settings.voiceURI === v.voiceURI;
                return html`
                  <button 
                    key=${v.voiceURI}
                    onClick=${() => onUpdateSettings({...settings, voiceURI: v.voiceURI})}
                    className=${`flex items-center justify-between p-4 rounded-2xl border-2 transition-all text-left ${
                      isSelected 
                        ? 'border-indigo-600 bg-indigo-50 ring-2 ring-indigo-100' 
                        : 'border-slate-100 bg-slate-50 hover:border-indigo-200'
                    }`}
                  >
                    <div className="flex flex-col pr-4 overflow-hidden">
                      <span className=${`font-bold truncate ${isSelected ? 'text-indigo-700' : 'text-slate-700'}`}>
                        ${v.name.replace(/Microsoft |Google |Apple /g, '')}
                      </span>
                      <span className="text-[10px] text-slate-400 font-mono truncate">${v.voiceURI.split('.').pop()}</span>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      ${highQuality && html`
                        <span className="bg-amber-100 text-amber-700 text-[10px] px-2 py-1 rounded-full font-black flex items-center gap-1">
                          ✨ 高级感
                        </span>
                      `}
                      ${isSelected && html`<${Lucide.Check} size=${18} className="text-indigo-600" />`}
                    </div>
                  </button>
                `;
              })}
            </div>
            ${!isLoading && html`<p className="text-[10px] text-slate-400 px-2 italic">提示：若看到多个同名音色，通常标注为“高级感”的音色发音更加自然。</p>`}
          </section>

          <section className="space-y-4">
            <div className="flex justify-between items-center">
              <label className="text-sm font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2">
                <${Lucide.Zap} size=${16} /> 朗读语速
              </label>
              <span className="px-3 py-1 bg-indigo-50 text-indigo-600 rounded-lg font-black">${settings.speechRate.toFixed(1)}x</span>
            </div>
            <input 
              type="range" min="0.5" max="2" step="0.1" 
              value=${settings.speechRate} 
              onChange=${e => onUpdateSettings({...settings, speechRate: parseFloat(e.target.value)})} 
              className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-indigo-600" 
            />
          </section>

          <section className="pt-8 border-t border-slate-100 flex justify-between items-center">
            <div className="space-y-1">
              <span className="font-bold text-slate-700 flex items-center gap-2">
                <${Lucide.EyeOff} size=${18} /> 自动过滤已记住单词
              </span>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input 
                type="checkbox" 
                checked=${settings.hideMastered} 
                onChange=${e => onUpdateSettings({...settings, hideMastered: e.target.checked})} 
                className="sr-only peer"
              />
              <div className="w-12 h-7 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[4px] after:left-[4px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
            </label>
          </section>
        </div>
      </div>
    </div>
  `;
};

export default SettingsPanel;
