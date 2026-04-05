import { AnimatePresence, motion } from 'framer-motion';
import type { DrawAnimationState } from '../../types/drawAnimation';
import type { ResultViewItem } from '../../types/resultView';
import BackgroundFxLayer from './BackgroundFxLayer';
import CelebrationFx from './CelebrationFx';
import DrawOverlayControls from './DrawOverlayControls';
import RevealCard from './RevealCard';
import ShuffleReel from './ShuffleReel';

interface DrawStageProps {
  state: DrawAnimationState;
  allNames: string[];           // all participant names for shuffle reel
  onSkip: () => void;
  onReplay: () => void;
  onBack?: () => void;
  compact?: boolean;            // true for participant view
  meId?: string;
  meNick?: string;
}

export default function DrawStage({
  state, allNames, onSkip, onReplay, onBack, compact = false, meId = '', meNick = '',
}: DrawStageProps) {
  const { phase, currentIndex, revealedCount, sequence, ranked } = state;
  const prefs = state.preferences;

  const currentStep = sequence[currentIndex];
  const visibleItems: ResultViewItem[] = sequence.slice(0, revealedCount).map((s) => s.item);

  const showShuffle  = phase === 'shuffle';
  const showReveal   = phase === 'reveal_name' || phase === 'reveal_role' || phase === 'celebration' || phase === 'completed';
  const showRole     = phase === 'reveal_role' || phase === 'celebration' || phase === 'completed';
  const isCelebrating = phase === 'celebration';

  const stageH = compact ? 340 : 520;

  // ── IDLE state: just show start button (handled by parent) ──
  if (phase === 'idle') return null;

  return (
    <div style={{ ...styles.stage, minHeight: stageH }}>
      {/* Background */}
      <BackgroundFxLayer active={phase !== 'completed'} reducedMotion={prefs.reducedMotion} />

      {/* Intro countdown */}
      <AnimatePresence>
        {phase === 'intro' && (
          <motion.div
            key="intro"
            style={styles.center}
            initial={{ opacity: 0, scale: 1.5 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.5 }}
            transition={{ duration: 0.4 }}
          >
            <div style={{ ...styles.introText, fontSize: compact ? 36 : 56 }}>🎲 抽選開始！</div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Shuffle reel */}
      <AnimatePresence>
        {showShuffle && currentStep && (
          <motion.div
            key="shuffle"
            style={styles.center}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.3 }}
          >
            {ranked && (
              <motion.div style={{ ...styles.rankHint, fontSize: compact ? 14 : 20 }}>
                {currentIndex + 1}番目の当選者は...
              </motion.div>
            )}
            <ShuffleReel
              names={allNames}
              finalName={currentStep.item.nickname}
              running={true}
              compact={compact}
            />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Reveal: ranked — single card at center */}
      <AnimatePresence>
        {showReveal && ranked && currentStep && (
          <motion.div
            key={`reveal-ranked-${currentIndex}`}
            style={styles.center}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <RevealCard
              nickname={currentStep.item.nickname}
              rank={currentStep.item.rank}
              role={currentStep.item.role}
              showRole={showRole && currentStep.hasRole}
              isMe={
                (!!meId && currentStep.item.participantId === meId) ||
                (!!meNick && currentStep.item.nickname === meNick)
              }
              compact={compact}
            />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Reveal: flat — all items staggered */}
      {showReveal && !ranked && (
        <div style={{ ...styles.flatGrid, padding: compact ? '16px' : '24px' }}>
          {visibleItems.map((item, i) => (
            <motion.div
              key={item.participantId}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.12, type: 'spring', stiffness: 200, damping: 20 }}
            >
              <RevealCard
                nickname={item.nickname}
                rank={null}
                role={item.role}
                showRole={true}
                isMe={
                  (!!meId && item.participantId === meId) ||
                  (!!meNick && item.nickname === meNick)
                }
                compact={compact}
              />
            </motion.div>
          ))}
        </div>
      )}

      {/* Completed: ranked — show all results as list */}
      {phase === 'completed' && ranked && (
        <div style={{ ...styles.completedList, padding: compact ? '16px' : '24px 32px' }}>
          {sequence.map((step) => {
            const isMe =
              (!!meId && step.item.participantId === meId) ||
              (!!meNick && step.item.nickname === meNick);
            return (
              <motion.div
                key={step.item.participantId}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                style={{
                  ...styles.resultRow,
                  ...(isMe ? styles.resultRowMe : {}),
                  padding: compact ? '10px 14px' : '12px 20px',
                }}
              >
                {step.item.rank !== null && (
                  <span style={{ ...styles.rowRank, fontSize: compact ? 13 : 16 }}>
                    {step.item.rank}位
                  </span>
                )}
                <span style={{ ...styles.rowName, fontSize: compact ? 15 : 20 }}>
                  {step.item.nickname}
                  {isMe && <span style={styles.meBadge}> あなた</span>}
                </span>
                {step.item.role && (
                  <span style={styles.rowRole}>{step.item.role}</span>
                )}
              </motion.div>
            );
          })}
        </div>
      )}

      {/* Celebration */}
      {isCelebrating && (
        <CelebrationFx
          active={true}
          reducedMotion={prefs.reducedMotion}
          compact={compact}
        />
      )}

      {/* Controls */}
      <DrawOverlayControls
        phase={phase}
        onSkip={onSkip}
        onReplay={onReplay}
        onBack={onBack}
      />
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  stage: {
    position: 'relative',
    borderRadius: 16,
    overflow: 'hidden',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  center: {
    position: 'absolute',
    inset: 0,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
    zIndex: 5,
    padding: 24,
  },
  introText: {
    color: '#fff',
    fontWeight: 800,
    textShadow: '0 4px 20px rgba(0,0,0,0.5)',
    textAlign: 'center',
  },
  rankHint: {
    color: 'rgba(255,255,255,0.75)',
    fontWeight: 600,
    marginBottom: 8,
  },
  flatGrid: {
    position: 'relative',
    zIndex: 5,
    display: 'flex',
    flexWrap: 'wrap',
    gap: 12,
    justifyContent: 'center',
    alignItems: 'center',
    width: '100%',
  },
  completedList: {
    position: 'relative',
    zIndex: 5,
    width: '100%',
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
    overflowY: 'auto',
    maxHeight: 400,
  },
  resultRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    borderRadius: 10,
    background: 'rgba(255,255,255,0.08)',
    border: '1px solid rgba(255,255,255,0.12)',
    color: '#fff',
  },
  resultRowMe: {
    background: 'rgba(251,191,36,0.15)',
    border: '1px solid rgba(251,191,36,0.4)',
  },
  rowRank: {
    fontWeight: 700,
    color: '#fbbf24',
    minWidth: 36,
    textAlign: 'center',
  },
  rowName: { fontWeight: 700, flex: 1 },
  meBadge: { fontSize: 12, color: '#fbbf24', fontWeight: 500, marginLeft: 4 },
  rowRole: {
    background: 'rgba(124,58,237,0.4)',
    color: '#c4b5fd',
    borderRadius: 12,
    padding: '2px 10px',
    fontSize: 12,
    fontWeight: 600,
  },
};
