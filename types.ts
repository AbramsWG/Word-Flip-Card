export interface Word {
  id: string;
  english: string;
  chinese: string;
  mastered: boolean;
  grade: string;
  unit: string;
}

export interface Settings {
  speechRate: number;
  voiceURI: string;
  useEdgeTTS: boolean;
  hideMastered: boolean;
  defaultSide: 'CHINESE' | 'ENGLISH';
  practiceMode: boolean;
  spellOutLoud: boolean;
}

export interface LearningProgress {
  currentIndex: number;
  selectedGrade: string;
  selectedUnits: string[];
}

export interface VoiceOption {
  voiceURI: string;
  name: string;
  lang: string;
  isCloud?: boolean;
}
