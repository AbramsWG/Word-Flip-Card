export interface WordEntry {
  id: string;
  english: string;
  chinese: string;
  mastered: boolean;
  grade?: string;
  unit?: string;
}

export interface AppSettings {
  speechRate: number;
  voiceURI: string;
  hideMastered: boolean;
  defaultSide: 'CHINESE' | 'ENGLISH';
  practiceMode: boolean;
  spellOutLoud: boolean;
  useEdgeTTS: boolean;
  edgeVoice: string;
}

export interface LearningProgress {
  currentIndex: number;
  selectedGrade: string;
  selectedUnits: string[];
}

export type ViewMode = 'LEARN' | 'INPUT' | 'SETTINGS';
