
import React, { useEffect, useState } from 'react';
import { Sliders, Volume2, Globe, EyeOff, BrainCircuit } from 'lucide-react';
import { AppSettings } from '../types';
import { getAvailableVoices } from '../utils/speech';

interface SettingsPanelProps {
  settings: AppSettings;
  onUpdateSettings: (settings: AppSettings) => void;
}

const SettingsPanel: React.FC<SettingsPanelProps> = ({ settings, onUpdateSettings }) => {
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);

  useEffect(() => {
    const loadVoices = () => {
      const v = getAvailableVoices();
      setVoices(v);
      // Set default voice if none selected
      if (!settings.voiceURI && v.length > 0) {
        onUpdateSettings({ ...settings, voiceURI: v[0].voiceURI });
      }
    };

    loadVoices();
    window.speechSynthesis.onvoiceschanged = loadVoices;
    return () => {
      window.speechSynthesis.onvoiceschanged = null;
    };
  }, [settings, onUpdateSettings]);

  const handleChange = (key: keyof AppSettings, value: any) => {
    onUpdateSettings({ ...settings, [key]: value });
  };

  return (
    <div className="w-full max-w-2xl animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="bg-white p-10 rounded-[2.5rem] shadow-xl border border-slate-100 relative overflow-hidden">
        {/* Subtle decorative background */}
        <div className="absolute -top-24 -right-24 text-slate-50 opacity-50 pointer-events-none">
          <BrainCircuit size={400} />
        </div>

        <div className="flex items-center gap-3 mb-10 z-10 relative">
          <div className="bg-indigo-100 p-2.5 rounded-2xl text-indigo-600">
            <Sliders size={24} />
          </div>
          <h2 className="text-3xl font-bold text-slate-800 tracking-tight">全局设置</h2>
        </div>

        <div className="space-y-10 z-10 relative">
          {/* Voice Selection */}
          <section className="space-y-4">
            <div className="flex items-center gap-2 text-slate-700 font-semibold mb-2">
              <Globe size={18} className="text-indigo-500" />
              <h3>发音音色 (英文)</h3>
            </div>
            <select
              value={settings.voiceURI}
              onChange={(e) => handleChange('voiceURI', e.target.value)}
              className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-4 focus:ring-indigo-100 focus:border-indigo-400 outline-none transition-all appearance-none cursor-pointer"
            >
              {voices.length === 0 && <option>正在加载系统音色...</option>}
              {voices.map(voice => (
                <option key={voice.voiceURI} value={voice.voiceURI}>
                  {voice.name} ({voice.lang})
                </option>
              ))}
            </select>
            <p className="text-xs text-slate-400 italic">注：音色由浏览器/操作系统提供，部分平台需点击“朗读”图标后激活。</p>
          </section>

          {/* Speech Rate */}
          <section className="space-y-4">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2 text-slate-700 font-semibold">
                <Volume2 size={18} className="text-indigo-500" />
                <h3>朗读语速</h3>
              </div>
              <span className="text-indigo-600 font-bold bg-indigo-50 px-3 py-1 rounded-full text-sm">
                {settings.speechRate.toFixed(1)}x
              </span>
            </div>
            <input
              type="range"
              min="0.5"
              max="2"
              step="0.1"
              value={settings.speechRate}
              onChange={(e) => handleChange('speechRate', parseFloat(e.target.value))}
              className="w-full h-2 bg-slate-100 rounded-lg appearance-none cursor-pointer accent-indigo-600"
            />
            <div className="flex justify-between text-xs text-slate-400 font-medium">
              <span>较慢 (0.5x)</span>
              <span>正常 (1.0x)</span>
              <span>较快 (2.0x)</span>
            </div>
          </section>

          {/* Filtering */}
          <section className="pt-4 border-t border-slate-100">
            <label className="flex items-center justify-between cursor-pointer group">
              <div className="flex items-center gap-2 text-slate-700 font-semibold">
                <EyeOff size={18} className="text-indigo-500" />
                <h3>隐藏已记住的卡片</h3>
              </div>
              <div className="relative inline-flex items-center">
                <input
                  type="checkbox"
                  checked={settings.hideMastered}
                  onChange={(e) => handleChange('hideMastered', e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-14 h-7 bg-slate-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-indigo-100 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-6 after:w-6 after:transition-all peer-checked:bg-indigo-600"></div>
              </div>
            </label>
          </section>
        </div>
      </div>
    </div>
  );
};

export default SettingsPanel;
