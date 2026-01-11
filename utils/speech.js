
export const getAvailableVoices = () => {
  if (typeof window === 'undefined' || !window.speechSynthesis) return [];
  
  const allVoices = window.speechSynthesis.getVoices();
  
  // 扩展白名单，包含更多常见的高品质音色系列
  const recommendedNames = [
    'samantha', 'jenny', 'ana', 'sonia', 'aria', 'guy', 'sarah', 'daniel', 'alex', 'karen'
  ];

  const filtered = allVoices.filter(v => {
    const name = v.name.toLowerCase();
    const uri = (v.voiceURI || '').toLowerCase();
    const isEnglish = v.lang.startsWith('en');
    
    // 基础过滤：英文 + 在白名单中
    const isRecommended = recommendedNames.some(rec => name.includes(rec));
    // 排除明确标为低质量的 'compact' 版本
    const isNotCompact = !name.includes('compact') && !uri.includes('compact');
    
    return isEnglish && isRecommended && isNotCompact;
  });

  // 排序：名称排序，如果名称相同，则 URI 较长的（通常包含 premium/enhanced 后缀）排在前面
  return filtered.sort((a, b) => {
    if (a.name === b.name) {
      return b.voiceURI.length - a.voiceURI.length;
    }
    return a.name.localeCompare(b.name);
  });
};

export const speak = (text, voiceURI, rate) => {
  if (!window.speechSynthesis) return;
  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  const voices = window.speechSynthesis.getVoices();
  const selectedVoice = voices.find(v => v.voiceURI === voiceURI);
  if (selectedVoice) utterance.voice = selectedVoice;
  utterance.rate = rate || 1.0;
  utterance.lang = 'en-US';
  window.speechSynthesis.speak(utterance);
};
