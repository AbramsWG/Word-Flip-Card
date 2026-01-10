
import React, { useState } from 'react';
import htm from 'htm';
import * as Lucide from 'lucide-react';

const html = htm.bind(React.createElement);

const WordInput = ({ initialWords, onSave }) => {
  // 初始化时将 word 对象还原为带 Unit 标记的文本
  const getInitialText = () => {
    let text = "";
    let lastUnit = null;
    initialWords.forEach(w => {
      if (w.unit && w.unit !== lastUnit && w.unit !== 'General') {
        text += `---${w.unit}---\n`;
        lastUnit = w.unit;
      }
      text += `${w.english} - ${w.chinese.replace(/\n/g, ' | ')}\n`;
    });
    return text || initialWords.map(w => `${w.english} - ${w.chinese.replace(/\n/g, ' | ')}`).join('\n');
  };

  const [text, setText] = useState(getInitialText());
  
  const handleSave = () => {
    const lines = text.split('\n').filter(l => l.trim().length > 0);
    let currentUnit = "General";
    const newWords = [];

    lines.forEach((line, index) => {
      const trimmed = line.trim();
      const unitMatch = trimmed.match(/---Unit\s*(\d+)---/i);
      
      if (unitMatch) {
        currentUnit = `Unit ${unitMatch[1]}`;
      } else if (trimmed.includes('-')) {
        const parts = trimmed.split('-').map(s => s.trim());
        const english = parts[0] || 'Empty';
        const chinese = parts.slice(1).join('-').replace(/\s*\|\s*/g, '\n') || '无解释';
        newWords.push({ 
          id: `word-${Date.now()}-${index}`, 
          english, 
          chinese, 
          mastered: false,
          unit: currentUnit
        });
      }
    });
    onSave(newWords);
  };

  const handleClear = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setText('');
  };

  return html`
    <div className="w-full max-w-3xl flex flex-col gap-6 p-4">
      <div className="bg-white p-8 rounded-[2.5rem] shadow-xl border">
        <div className="flex justify-between items-center mb-8">
          <h2 className="text-2xl font-black text-slate-800">词库录入</h2>
          <div className="flex gap-3">
            <button 
              type="button"
              onPointerDown=${handleClear}
              onClick=${handleClear} 
              className="px-6 py-3 border border-red-200 text-red-500 font-bold rounded-2xl hover:bg-red-50 active:scale-95 transition-all flex items-center gap-2"
            >
              <${Lucide.Trash2} size=${18} />
              清空
            </button>
            <button 
              type="button"
              onClick=${handleSave} 
              className="px-8 py-3 bg-indigo-600 text-white font-bold rounded-2xl shadow-lg hover:bg-indigo-700 active:scale-95 transition-all"
            >
              保存
            </button>
          </div>
        </div>
        <textarea 
          value=${text} 
          onChange=${(e) => setText(e.target.value)} 
          placeholder="请输入单词，格式：单词 - 解释"
          className="w-full h-80 p-6 bg-slate-50 border border-slate-200 rounded-3xl focus:ring-4 focus:ring-indigo-100 outline-none resize-none font-mono text-slate-700 transition-all" 
        />
        <div className="mt-4 p-4 bg-slate-50 rounded-xl border border-dashed text-xs text-slate-500 leading-relaxed">
          <p className="font-bold mb-1 uppercase tracking-wider text-slate-400">支持格式：</p>
          <code className="block mb-1">---Unit 1---</code>
          <code className="block">Apple - 苹果 | 沙果</code>
        </div>
      </div>
    </div>
  `;
};

export default WordInput;
