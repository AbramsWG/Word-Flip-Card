
import React, { useState } from 'react';
import htm from 'htm';
import * as Lucide from 'lucide-react';

const html = htm.bind(React.createElement);

const WordInput = ({ initialWords, onSave }) => {
  const [text, setText] = useState(initialWords.map(w => `${w.english} - ${w.chinese.replace(/\n/g, ' | ')}`).join('\n'));
  
  const handleSave = () => {
    const lines = text.split('\n').filter(l => l.trim().length > 0);
    const newWords = lines.map((line, index) => {
      const parts = line.split('-').map(s => s.trim());
      const english = parts[0] || 'Empty';
      const chinese = parts.slice(1).join('-').replace(/\s*\|\s*/g, '\n') || '无解释';
      return { id: `word-${Date.now()}-${index}`, english, chinese, mastered: false };
    });
    onSave(newWords);
  };

  return html`
    <div className="w-full max-w-3xl flex flex-col gap-6 p-4">
      <div className="bg-white p-8 rounded-[2.5rem] shadow-xl border">
        <div className="flex justify-between items-center mb-8">
          <h2 className="text-2xl font-black text-slate-800">词库录入</h2>
          <button onClick=${handleSave} className="px-8 py-3 bg-indigo-600 text-white font-bold rounded-2xl shadow-lg hover:bg-indigo-700 active:scale-95 transition-all">保存</button>
        </div>
        <textarea value=${text} onChange=${(e) => setText(e.target.value)} className="w-full h-80 p-6 bg-slate-50 border rounded-3xl focus:ring-4 focus:ring-indigo-100 outline-none resize-none font-mono" />
      </div>
    </div>
  `;
};

export default WordInput;
