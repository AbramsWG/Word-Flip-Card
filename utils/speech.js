
export const getAvailableVoices = () => {
  if (typeof window === 'undefined' || !window.speechSynthesis) return [];
  
  // 获取所有音色，过滤掉包含 "Default" 字样的系统占位符（如果存在）
  // const allVoices = window.speechSynthesis.getVoices().filter(v => !v.name.toLowerCase().includes('default'));
  
  // 仅保留英文音色
  // const enVoices = allVoices.filter(v => v.lang.startsWith('en'));

  const enVoices = window.speechSynthesis.getVoices().filter(v => v.lang.startsWith('en'));
  
  // 优质音色关键词匹配
  const premiumKeywords = ['jenny', 'microsoft ana', 'sonia', 'samantha', 'enhanced'];
  //const premiumKeywords = [];
  const premium = enVoices.filter(v => premiumKeywords.some(k => v.name.toLowerCase().includes(k)));
  
  // 优先返回优质音色，否则返回所有英文音色
  return premium.length > 0 ? premium : enVoices;
};

export const speak = (text, voiceURI, rate) => {
  if (!window.speechSynthesis) return;
  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(text.toLowerCase());
  const voices = window.speechSynthesis.getVoices();
  const selectedVoice = voices.find(v => v.voiceURI === voiceURI);
  if (selectedVoice) utterance.voice = selectedVoice;
  utterance.rate = rate || 1.0;
  utterance.lang = 'en-US';
  window.speechSynthesis.speak(utterance);
};
