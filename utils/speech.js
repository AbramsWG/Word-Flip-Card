
export const getAvailableVoices = () => {
  if (typeof window === 'undefined' || !window.speechSynthesis) return [];
  
  const allVoices = window.speechSynthesis.getVoices();
  if (allVoices.length === 0) return [];

  // 1. 定义优质关键词
  const recommendedNames = [
    'samantha', 'jenny', 'ana', 'sonia', 'aria', 'guy', 'sarah', 'daniel', 'alex', 'karen', 'apple', 'google'
  ];

  // 2. 尝试获取优质英文音色
  let filtered = allVoices.filter(v => {
    const name = v.name.toLowerCase();
    const uri = (v.voiceURI || '').toLowerCase();
    const isEnglish = v.lang.startsWith('en');
    
    const isRecommended = recommendedNames.some(rec => name.includes(rec));
    // 仅在有多个选择时才过滤 compact，防止列表变空
    const isNotCompact = !name.includes('compact') && !uri.includes('compact');
    
    return isEnglish && isRecommended && isNotCompact;
  });

  // 3. 保底逻辑：如果优质列表为空，则返回所有英文音色（不过滤 compact）
  if (filtered.length === 0) {
    filtered = allVoices.filter(v => v.lang.startsWith('en'));
  }

  // 4. 排序：名称排序，同名时 URI 长的（高级版）排在前面
  return filtered.sort((a, b) => {
    if (a.name === b.name) {
      return (b.voiceURI || '').length - (a.voiceURI || '').length;
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
