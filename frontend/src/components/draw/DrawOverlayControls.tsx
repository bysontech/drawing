import { motion } from 'framer-motion';
import type { DrawPhase } from '../../types/drawAnimation';

interface DrawOverlayControlsProps {
  phase: DrawPhase;
  onSkip: () => void;
  onReplay: () => void;
  onBack?: () => void;
}

const ACTIVE_PHASES: DrawPhase[] = ['intro', 'shuffle', 'reveal_name', 'reveal_role', 'celebration', 'next'];

export default function DrawOverlayControls({ phase, onSkip, onReplay, onBack }: DrawOverlayControlsProps) {
  const isActive = ACTIVE_PHASES.includes(phase);
  const isDone = phase === 'completed';

  return (
    <div style={styles.wrapper}>
      {isActive && (
        <motion.button
          style={styles.skipBtn}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1 }}
          onClick={onSkip}
          whileTap={{ scale: 0.95 }}
        >
          スキップ →
        </motion.button>
      )}

      {isDone && (
        <motion.div
          style={styles.doneRow}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
        >
          <button style={styles.replayBtn} onClick={onReplay}>
            🔁 もう一度見る
          </button>
          {onBack && (
            <button style={styles.backBtn} onClick={onBack}>
              ← 主催者画面に戻る
            </button>
          )}
        </motion.div>
      )}
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  wrapper: { position: 'absolute', bottom: 24, left: 0, right: 0, display: 'flex', justifyContent: 'center', zIndex: 20, gap: 12, flexWrap: 'wrap' },
  skipBtn: {
    background: 'rgba(255,255,255,0.15)', color: '#fff',
    border: '1px solid rgba(255,255,255,0.3)', borderRadius: 20,
    padding: '8px 20px', fontSize: 13, cursor: 'pointer',
    backdropFilter: 'blur(4px)',
  },
  doneRow: { display: 'flex', gap: 10, flexWrap: 'wrap', justifyContent: 'center' },
  replayBtn: {
    background: 'rgba(255,255,255,0.15)', color: '#fff',
    border: '1px solid rgba(255,255,255,0.3)', borderRadius: 20,
    padding: '10px 22px', fontSize: 14, cursor: 'pointer',
    backdropFilter: 'blur(4px)',
  },
  backBtn: {
    background: 'rgba(59,130,246,0.25)', color: '#93c5fd',
    border: '1px solid rgba(59,130,246,0.4)', borderRadius: 20,
    padding: '10px 22px', fontSize: 14, cursor: 'pointer',
    backdropFilter: 'blur(4px)',
  },
};
