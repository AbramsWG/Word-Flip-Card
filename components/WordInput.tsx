
import React, { useState } from 'react';
import { Save, AlertCircle } from 'lucide-react';
import { WordEntry } from '../types';

interface WordInputProps {
  initialWords: WordEntry[];
  onSave: (words: WordEntry[]) => void;
}

const WordInput: React.FC<WordInputProps> = ({ initialWords, onSave }) => {
  const [text, setText] = useState(
    initialWords.map(w => `${w.english} - ${w.chinese.replace(/\n/g, ' | ')}`).join('\n')
  );

  const handleSave = () => {
    const lines = text.split('\n').filter(line => line.trim().length > 0);
    const newWords: WordEntry[] = lines.map((line, index) => {
      const [english, ...chineseParts] = line.split('-').map(s => s.trim());
      const chinese = chineseParts.join('-').replace(/\s*\|\s*/g, '\n');
      
      // Check if it already exists to preserve mastery state
      const existing = initialWords.find(w => w.english.toLowerCase() === english.toLowerCase());
      
      return {
        id: existing?.id || `word-${Date.now()}-${index}`,
        english: english || 'Empty',
        chinese: chinese || '无解释',
        mastered: existing?.mastered || false
      };
    });

    onSave(newWords);
  };

  return (
    <div className="w-full max-w-3xl flex flex-col gap-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="bg-white p-8 rounded-3xl shadow-xl border border-slate-100">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-2xl font-bold text-slate-800">导入词库</h2>
            <p className="text-slate-500 text-sm mt-1">
              格式：英文单词 - 中文解释 (使用 | 换行)
            </p>
          </div>
          <button
            onClick={handleSave}
            className="flex items-center gap-2 px-6 py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-2xl transition-all shadow-lg shadow-indigo-200"
          >
            <Save size={20} />
            保存词库
          </button>
        </div>

        <div className="relative group">
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="例如：&#10;apple - 苹果 | 健康&#10;banana - 香蕉 | 热带水果"
            className="w-full h-96 p-6 text-lg bg-slate-50 border border-slate-200 rounded-2xl focus:ring-4 focus:ring-indigo-100 focus:border-indigo-400 outline-none transition-all resize-none font-mono"
          />
          <div className="absolute top-4 right-4 text-indigo-400 opacity-20 group-focus-within:opacity-40 transition-opacity">
            <Edit3 size={48} />
          </div>
        </div>

        <div className="mt-6 p-4 bg-indigo-50 rounded-2xl border border-indigo-100 flex items-start gap-3">
          <AlertCircle className="text-indigo-500 mt-0.5 shrink-0" size={20} />
          <p className="text-sm text-indigo-800 leading-relaxed">
            提示：每个单词占一行。点击“保存”后，系统会自动更新学习列表。若单词已存在，将保留之前的“已记住”状态。
          </p>
        </div>
      </div>
    </div>
  );
};

import { Edit3 } from 'lucide-react';
export default WordInput;
