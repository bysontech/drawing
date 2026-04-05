import { useCallback, useEffect, useReducer, useRef } from 'react';
import type {
  AnimationPreferences,
  DrawAnimationAction,
  DrawAnimationState,
  DrawPhase,
  DrawSequenceStep,
} from '../types/drawAnimation';

// ── Timing constants ──────────────────────────────────
const TIMINGS = {
  intro: 800,
  shuffle_ranked: 2000,
  shuffle_flat: 1500,
  reveal_name: 600,
  reveal_role_delay: 800,
  reveal_role: 500,
  celebration_ranked: 1500,
  celebration_flat: 1000,
  next_pause: 300,
} as const;

function reducedTimings(t: typeof TIMINGS) {
  return {
    ...t,
    shuffle_ranked: 400,
    shuffle_flat: 300,
    intro: 300,
    celebration_ranked: 600,
    celebration_flat: 400,
  };
}

// ── Reducer ───────────────────────────────────────────

function nextPhaseFor(
  state: DrawAnimationState,
  currentPhase: DrawPhase
): DrawPhase {
  const { ranked, sequence, currentIndex } = state;
  switch (currentPhase) {
    case 'idle':    return 'intro';
    case 'intro':   return 'shuffle';
    case 'shuffle': return 'reveal_name';
    case 'reveal_name':
      // If ranked and current item has a role → reveal_role, else celebration
      if (ranked && sequence[currentIndex]?.hasRole) return 'reveal_role';
      return 'celebration';
    case 'reveal_role': return 'celebration';
    case 'celebration':
      if (ranked) {
        // more winners left?
        if (currentIndex + 1 < sequence.length) return 'next';
        return 'completed';
      }
      return 'completed';
    case 'next': return 'shuffle';
    default:      return 'completed';
  }
}

function reducer(
  state: DrawAnimationState,
  action: DrawAnimationAction
): DrawAnimationState {
  switch (action.type) {
    case 'START':
      if (!state.preferences.animate) {
        return { ...state, phase: 'completed', revealedCount: state.sequence.length };
      }
      return { ...state, phase: 'intro' };

    case 'NEXT_PHASE': {
      const next = nextPhaseFor(state, state.phase);
      const nextIndex =
        state.phase === 'next' ? state.currentIndex + 1 : state.currentIndex;
      const revealedCount =
        next === 'celebration' ? nextIndex + 1 : state.revealedCount;
      // For flat (not ranked), reveal all at once during reveal_name
      const flatReveal =
        !state.ranked && next === 'reveal_name'
          ? state.sequence.length
          : revealedCount;
      return {
        ...state,
        phase: next,
        currentIndex: nextIndex,
        revealedCount: state.ranked ? revealedCount : flatReveal,
      };
    }

    case 'SKIP':
      return { ...state, phase: 'completed', revealedCount: state.sequence.length };

    case 'REPLAY':
      return {
        ...state,
        phase: 'idle',
        currentIndex: 0,
        revealedCount: 0,
        preferences: { ...state.preferences, animate: true },
      };

    default:
      return state;
  }
}

// ── Hook ─────────────────────────────────────────────

export function useDrawAnimationController(
  sequence: DrawSequenceStep[],
  ranked: boolean,
  preferences: AnimationPreferences
) {
  const timings = preferences.reducedMotion
    ? reducedTimings(TIMINGS)
    : TIMINGS;

  const [state, dispatch] = useReducer(reducer, {
    phase: 'idle',
    currentIndex: 0,
    revealedCount: 0,
    sequence,
    preferences,
    ranked,
  });

  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearTimer = useCallback(() => {
    if (timerRef.current !== null) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const scheduleNext = useCallback(
    (delay: number) => {
      clearTimer();
      timerRef.current = setTimeout(() => dispatch({ type: 'NEXT_PHASE' }), delay);
    },
    [clearTimer]
  );

  // Auto-advance based on current phase
  useEffect(() => {
    if (state.phase === 'idle' || state.phase === 'completed') return;

    const { phase, ranked: r, currentIndex } = state;
    switch (phase) {
      case 'intro':
        scheduleNext(timings.intro);
        break;
      case 'shuffle':
        scheduleNext(r ? timings.shuffle_ranked : timings.shuffle_flat);
        break;
      case 'reveal_name':
        if (!r) {
          // flat: go straight to celebration
          scheduleNext(timings.reveal_name);
        } else {
          scheduleNext(timings.reveal_name + (sequence[currentIndex]?.hasRole ? timings.reveal_role_delay : 0));
        }
        break;
      case 'reveal_role':
        scheduleNext(timings.reveal_role);
        break;
      case 'celebration':
        scheduleNext(r ? timings.celebration_ranked : timings.celebration_flat);
        break;
      case 'next':
        scheduleNext(timings.next_pause);
        break;
    }

    return clearTimer;
  }, [state.phase, state.currentIndex]); // eslint-disable-line react-hooks/exhaustive-deps

  // Cleanup on unmount
  useEffect(() => () => clearTimer(), [clearTimer]);

  const start = useCallback(() => dispatch({ type: 'START' }), []);
  const skip  = useCallback(() => { clearTimer(); dispatch({ type: 'SKIP' }); }, [clearTimer]);
  const replay = useCallback(() => { clearTimer(); dispatch({ type: 'REPLAY' }); }, [clearTimer]);

  return { state, start, skip, replay };
}
