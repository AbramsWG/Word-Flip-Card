import React, { useState, useEffect } from 'react';
import { Sliders, Globe, ChevronDown, Zap, Layout, Edit3, Type, EyeOff, Trash2 } from 'lucide-react';
import { getAvailableVoices, NATURAL_VOICES, clearTTSCache } from '../utils/speech';
import { AppSettings } from '../types';

interface SettingsPanelProps {
  settings: AppSettings;
  onUpdateSettings: React.Dispatch<React.SetStateAction<AppSettings>>;
}

const SettingsPanel: React.FC<SettingsPanelProps> = ({ settings, onUpdateSettings }) => {
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [cacheCleared, setCacheCleared] = useState(false);

  const handleClearCache = async () => {
    await clearTTSCache();
    setCacheCleared(true);
    setTimeout(() => setCacheCleared(false), 2000);
  };

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

  return (
    <div className="w-full max-w-2xl p-4">
      <div className="bg-white p-10 rounded-[3rem] shadow-xl border">
        <h2 className="text-3xl font-black mb-10 flex items-center gap-4 text-slate-800">
          <span className="p-3 bg-indigo-100 text-indigo-600 rounded-2xl"><Sliders /></span>
          偏好设置
        </h2>

        <div className="space-y-10">
          {/* Edge TTS 自然语音开关 */}
          <section className="flex justify-between items-center">
            <div className="space-y-1">
              <span className="font-bold text-slate-700 flex items-center gap-2">
                <Globe size={18} /> 自然语音 (Edge TTS)
              </span>
              <p className="text-xs text-slate-400">开启后调用微软 Edge TTS 输出自然语音，关闭则使用本地系统语音</p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={!!settings.useEdgeTTS}
                onChange={e => onUpdateSettings({ ...settings, useEdgeTTS: e.target.checked })}
                className="sr-only peer"
              />
              <div className="w-12 h-7 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[4px] after:left-[4px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
            </label>
          </section>

          {/* 语音选择 */}
          <section className="space-y-4">
            <label className="text-sm font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2">
              <Globe size={16} /> 推荐音色 (英文)
            </label>
            <div className="relative">
              {settings.useEdgeTTS ? (
                <select
                  value={settings.edgeVoice || 'en-GB-SoniaNeural'}
                  onChange={e => onUpdateSettings({ ...settings, edgeVoice: e.target.value })}
                  className="w-full p-5 bg-slate-50 border-2 border-slate-100 rounded-2xl outline-none focus:border-indigo-500 transition-colors cursor-pointer appearance-none text-slate-700 font-medium"
                >
                  {NATURAL_VOICES.map(v => (
                    <option key={v.id} value={v.id}>
                      {v.label}
                    </option>
                  ))}
                </select>
              ) : (
                <select
                  value={settings.voiceURI || ''}
                  onChange={e => onUpdateSettings({ ...settings, voiceURI: e.target.value })}
                  className="w-full p-5 bg-slate-50 border-2 border-slate-100 rounded-2xl outline-none focus:border-indigo-500 transition-colors cursor-pointer appearance-none text-slate-700 font-medium"
                >
                  {voices.map(v => (
                    <option key={v.voiceURI} value={v.voiceURI}>
                      {v.name.replace(/Microsoft |Google |Apple /g, '')} ({v.lang})
                    </option>
                  ))}
                </select>
              )}
              <div className="absolute right-5 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">
                <ChevronDown size={20} />
              </div>
            </div>
          </section>

          {/* 语速控制 */}
          <section className="space-y-4">
            <div className="flex justify-between items-center">
              <label className="text-sm font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2">
                <Zap size={16} /> 朗读语速
              </label>
              <span className="px-3 py-1 bg-indigo-50 text-indigo-600 rounded-lg font-black">{settings.speechRate.toFixed(1)}x</span>
            </div>
            <input
              type="range"
              min="0.5"
              max="2"
              step="0.1"
              value={settings.speechRate || 1.0}
              onInput={e => onUpdateSettings({ ...settings, speechRate: parseFloat((e.target as HTMLInputElement).value) })}
              onChange={e => onUpdateSettings({ ...settings, speechRate: parseFloat(e.target.value) })}
              onTouchStart={e => {
                if (!e.touches || !e.touches[0]) return;
                const rect = e.currentTarget.getBoundingClientRect();
                const ratio = Math.max(0, Math.min(1, (e.touches[0].clientX - rect.left) / rect.width));
                const nextRate = Math.round((0.5 + ratio * 1.5) * 10) / 10;
                if (nextRate !== settings.speechRate) {
                  onUpdateSettings({ ...settings, speechRate: nextRate });
                }
              }}
              onTouchMove={e => {
                if (!e.touches || !e.touches[0]) return;
                const rect = e.currentTarget.getBoundingClientRect();
                const ratio = Math.max(0, Math.min(1, (e.touches[0].clientX - rect.left) / rect.width));
                const nextRate = Math.round((0.5 + ratio * 1.5) * 10) / 10;
                if (nextRate !== settings.speechRate) {
                  onUpdateSettings({ ...settings, speechRate: nextRate });
                }
              }}
              className="touch-range-slider"
            />
          </section>

          {/* 默认显示面 */}
          <section className="space-y-4">
            <div className="flex justify-between items-center">
              <label className="text-sm font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2">
                <Layout size={16} /> 默认显示面
              </label>
              {settings.practiceMode && (
                <span className="text-[10px] bg-amber-100 text-amber-600 px-2 py-0.5 rounded-full font-bold animate-pulse">练习模式已锁定</span>
              )}
            </div>
            <div className={`flex gap-2 p-1 bg-slate-100 rounded-2xl border transition-opacity ${settings.practiceMode ? 'opacity-60 grayscale-[0.5]' : ''}`}>
              <button
                disabled={settings.practiceMode}
                onClick={() => onUpdateSettings({ ...settings, defaultSide: 'CHINESE' })}
                className={`flex-1 py-3 rounded-xl text-sm font-bold transition-all ${settings.defaultSide === 'CHINESE' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-800'} ${settings.practiceMode ? 'cursor-not-allowed' : ''}`}
              >
                中文 (释义)
              </button>
              <button
                disabled={settings.practiceMode}
                onClick={() => onUpdateSettings({ ...settings, defaultSide: 'ENGLISH' })}
                className={`flex-1 py-3 rounded-xl text-sm font-bold transition-all ${settings.defaultSide === 'ENGLISH' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-800'} ${settings.practiceMode ? 'cursor-not-allowed' : ''}`}
              >
                英文 (单词)
              </button>
            </div>
          </section>

          {/* 练习模式 */}
          <section className="pt-8 border-t border-slate-100 flex justify-between items-center">
            <div className="space-y-1">
              <span className="font-bold text-slate-700 flex items-center gap-2">
                <Edit3 size={18} /> 练习模式 (拼写测试)
              </span>
              <p className="text-xs text-slate-400">开启后需正确输入英文单词才能翻转卡片</p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={!!settings.practiceMode}
                onChange={e => {
                  const isChecked = e.target.checked;
                  onUpdateSettings({
                    ...settings,
                    practiceMode: isChecked,
                    ...(isChecked ? { defaultSide: 'CHINESE' } : {})
                  });
                }}
                className="sr-only peer"
              />
              <div className="w-12 h-7 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[4px] after:left-[4px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
            </label>
          </section>

          {/* 逐字母朗读 */}
          <section className="pt-8 border-t border-slate-100 flex justify-between items-center">
            <div className="space-y-1">
              <span className="font-bold text-slate-700 flex items-center gap-2">
                <Type size={18} /> 逐字母朗读 (拼读)
              </span>
              <p className="text-xs text-slate-400">朗读完单词后自动拼读每个字母并高亮</p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={!!settings.spellOutLoud}
                onChange={e => onUpdateSettings({ ...settings, spellOutLoud: e.target.checked })}
                className="sr-only peer"
              />
              <div className="w-12 h-7 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[4px] after:left-[4px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
            </label>
          </section>

          {/* 过滤选项 */}
          <section className="pt-8 border-t border-slate-100 flex justify-between items-center">
            <div className="space-y-1">
              <span className="font-bold text-slate-700 flex items-center gap-2">
                <EyeOff size={18} /> 自动过滤已记住单词
              </span>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={!!settings.hideMastered}
                onChange={e => onUpdateSettings({ ...settings, hideMastered: e.target.checked })}
                className="sr-only peer"
              />
              <div className="w-12 h-7 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[4px] after:left-[4px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
            </label>
          </section>

          {/* 清除语音缓存 */}
          <section className="pt-8 border-t border-slate-100 flex justify-between items-center">
            <div className="space-y-1">
              <span className="font-bold text-slate-700 flex items-center gap-2">
                <Trash2 size={18} /> 单词语音缓存
              </span>
              <p className="text-xs text-slate-400">清空本地 IndexedDB 与内存中已缓存的所有单词语音</p>
            </div>
            <button
              type="button"
              onClick={handleClearCache}
              className={`px-5 py-2.5 rounded-xl text-sm font-bold border transition-colors flex items-center gap-2 ${
                cacheCleared
                  ? 'border-emerald-200 bg-emerald-50 text-emerald-600'
                  : 'border-red-200 text-red-500 hover:bg-red-50'
              }`}
            >
              <Trash2 size={16} />
              {cacheCleared ? '已清除' : '清除缓存'}
            </button>
          </section>
        </div>
      </div>
    </div>
  );
};

export default SettingsPanel;
