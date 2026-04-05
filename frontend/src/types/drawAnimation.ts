import type { ResultViewItem } from './resultView';

export type DrawPhase =
  | 'idle'
  | 'intro'
  | 'shuffle'
  | 'reveal_name'
  | 'reveal_role'
  | 'celebration'
  | 'next'
  | 'completed';

export interface AnimationPreferences {
  reducedMotion: boolean;
  animate: boolean; // false = skip all, show results immediately
}

export interface DrawSequenceStep {
  winnerIndex: number; // index in ResultViewItem array
  item: ResultViewItem;
  hasRole: boolean;
}

export interface DrawAnimationState {
  phase: DrawPhase;
  currentIndex: number;      // which winner we're currently revealing
  revealedCount: number;     // how many winners are now fully visible
  sequence: DrawSequenceStep[];
  preferences: AnimationPreferences;
  ranked: boolean;
}

export type DrawAnimationAction =
  | { type: 'START' }
  | { type: 'NEXT_PHASE' }
  | { type: 'SKIP' }
  | { type: 'REPLAY' };
