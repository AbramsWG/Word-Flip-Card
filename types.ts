
export interface WordEntry {
  id: string;
  english: string;
  chinese: string;
  mastered: boolean;
}

export interface AppSettings {
  speechRate: number;
  voiceURI: string;
  hideMastered: boolean;
}

export enum ViewMode {
  LEARN = 'LEARN',
  INPUT = 'INPUT',
  SETTINGS = 'SETTINGS'
}
