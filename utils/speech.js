
export const getAvailableVoices = () => {
  if (typeof window === 'undefined' || !window.speechSynthesis) return [];
  
  const allVoices = window.speechSynthesis.getVoices();
  
  // 恢复您最初要求的优质音色白名单
  const recommendedNames = [
    'jenny', 'microsoft ana', 'sonia', 'samantha'
  ];

  return allVoices.filter(v => {
    const name = v.name.toLowerCase();
    const isEnglish = v.lang.startsWith('en');
    // 逻辑：必须在白名单内，且过滤掉手机自带的低质量 'compact' 版本
    const isRecommended = recommendedNames.some(rec => name.includes(rec));
    const isNotCompact = !name.includes('compact');
    
    return isEnglish && isRecommended && isNotCompact;
  }).sort((a, b) => a.name.localeCompare(b.name));
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
