
export const getAvailableVoices = (): SpeechSynthesisVoice[] => {
  if (typeof window === 'undefined' || !window.speechSynthesis) return [];
  
  const allVoices = window.speechSynthesis.getVoices();
  const enVoices = allVoices.filter(v => v.lang.startsWith('en'));
  
  // 优质音色关键词（通常是自然度较高的免费音色）
  const premiumKeywords = ['jenny', 'microsoft ana', 'sonia', 'samantha', 'google us english', 'apple english'];

  // 先尝试过滤出优质音色
  const premiumVoices = enVoices.filter(v => 
    premiumKeywords.some(keyword => v.name.toLowerCase().includes(keyword))
  );

  // 如果找到了优质音色，优先返回它们；否则返回所有英文音色
  return premiumVoices.length > 0 ? premiumVoices : enVoices;
};

export const speak = (text: string, voiceURI: string, rate: number) => {
  if (typeof window === 'undefined' || !window.speechSynthesis) {
    console.warn('Speech synthesis not supported');
    return;
  }

  // 立即停止当前正在进行的朗读，防止堆栈排队延迟
  window.speechSynthesis.cancel();

  const utterance = new SpeechSynthesisUtterance(text);
  const voices = window.speechSynthesis.getVoices();
  
  // 查找用户选择的音色
  let selectedVoice = voices.find(v => v.voiceURI === voiceURI);
  
  // 如果没有指定音色（首次启动）或找不到指定音色，使用“优质音色优先”的逻辑作为降级方案
  if (!selectedVoice) {
    const premiumChoices = getAvailableVoices();
    if (premiumChoices.length > 0) {
      selectedVoice = premiumChoices[0];
    }
  }

  if (selectedVoice) {
    utterance.voice = selectedVoice;
  }

  utterance.rate = rate;
  utterance.lang = 'en-US';

  // 针对某些移动端浏览器的保护机制
  try {
    window.speechSynthesis.speak(utterance);
  } catch (error) {
    console.error('Speech synthesis error:', error);
  }
};
