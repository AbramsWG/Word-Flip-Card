
import React, { useState, useEffect } from 'react';
import htm from 'htm';
import * as Lucide from 'lucide-react';
import { getAvailableVoices } from '../utils/speech.js';

const html = htm.bind(React.createElement);

const SettingsPanel = ({ settings, onUpdateSettings }) => {
  const [voices, setVoices] = useState([]);

  useEffect(() => {
    const load = () => {
      const availableVoices = getAvailableVoices();
      setVoices(availableVoices);
    };

    load();
    if (window.speechSynthesis) {
      window.speechSynthesis.onvoiceschanged = load;
    }
    return () => { 
      if (window.speechSynthesis) window.speechSynthesis.onvoiceschanged = null; 
    };
  }, []);

  // 识别高品质音色：同时检测 URI 和名称，确保 iOS 系统音色能被识别
  const isHighQuality = (voice) => {
    const uri = (voice.voiceURI || '').toLowerCase();
    const name = (voice.name || '').toLowerCase();
    return uri.includes('enhanced') || uri.includes('premium') || name.includes('enhanced') || name.includes('premium');
  };

  return html`
    <div className="w-full max-w-2xl p-4">
      <div className="bg-white p-8 sm:p-10 rounded-[3rem] shadow-xl border">
        <h2 className="text-3xl font-black mb-10 flex items-center gap-4 text-slate-800">
          <span className="p-3 bg-indigo-100 text-indigo-600 rounded-2xl"><${Lucide.Sliders} /></span>
          偏好设置
        </h2>
        
        <div className="space-y-10">
          <!-- 语音选择：改为卡片列表以适配 iOS -->
          <section className="space-y-4">
            <label className="text-sm font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2">
              <${Lucide.Globe} size=${16} /> 推荐音色 (精选英文)
            </label>
            <div className="grid grid-cols-1 gap-3 max-h-[300px] overflow-y-auto pr-2 custom-scrollbar">
              ${voices.map(v => {
                const highQuality = isHighQuality(v);
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
                    <div className="flex flex-col">
                      <span className=${`font-bold ${isSelected ? 'text-indigo-700' : 'text-slate-700'}`}>
                        ${v.name.replace(/Microsoft |Google |Apple /g, '')}
                      </span>
                      <span className="text-xs text-slate-400">${v.lang}</span>
                    </div>
                    ${highQuality && html`
                      <span className="bg-amber-100 text-amber-700 text-[10px] px-2 py-1 rounded-full font-black flex items-center gap-1 shrink-0">
                        ✨ 高级感
                      </span>
                    `}
                    ${isSelected && html`<${Lucide.Check} size=${18} className="text-indigo-600 ml-2" />`}
                  </button>
                `;
              })}
            </div>
          </section>

          <!-- 语速控制 -->
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

          <!-- 过滤选项 -->
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
