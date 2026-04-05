import { AnimatePresence, motion } from 'framer-motion';
import { useEffect, useRef, useState } from 'react';

interface ShuffleReelProps {
  names: string[];         // all participant names to cycle through
  finalName: string;       // name that will "land"
  running: boolean;        // true during shuffle phase
  compact?: boolean;
}

const FAST_INTERVAL = 60;
const SLOW_INTERVAL = 160;
const SLOWDOWN_AT = 0.6; // fraction through duration when we start slowing

export default function ShuffleReel({ names, finalName, running, compact = false }: ShuffleReelProps) {
  const [displayed, setDisplayed] = useState(names[0] ?? '');
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const indexRef = useRef(0);
  const startRef = useRef<number>(0);
  const durationRef = useRef<number>(running ? 2000 : 0);

  useEffect(() => {
    if (!running || names.length === 0) {
      setDisplayed(finalName);
      return;
    }

    startRef.current = Date.now();
    durationRef.current = 2000;

    const tick = () => {
      const elapsed = Date.now() - startRef.current;
      const progress = Math.min(elapsed / durationRef.current, 1);

      // Ease from fast to slow
      const interval = FAST_INTERVAL + (SLOW_INTERVAL - FAST_INTERVAL) * Math.max(0, (progress - SLOWDOWN_AT) / (1 - SLOWDOWN_AT));

      indexRef.current = (indexRef.current + 1) % names.length;
      setDisplayed(names[indexRef.current]);

      if (intervalRef.current) clearInterval(intervalRef.current);
      if (progress < 1) {
        intervalRef.current = setInterval(tick, interval);
      }
    };

    intervalRef.current = setInterval(tick, FAST_INTERVAL);
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [running, finalName]); // eslint-disable-line react-hooks/exhaustive-deps

  const fontSize = compact ? 28 : 52;

  return (
    <div style={{ ...styles.reel, fontSize }}>
      <AnimatePresence mode="wait">
        <motion.span
          key={displayed}
          initial={{ opacity: 0, y: running ? -18 : 0, scale: running ? 0.92 : 1 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 18, scale: 0.92 }}
          transition={{ duration: running ? 0.06 : 0.3, ease: 'easeOut' }}
          style={{ display: 'block', color: '#fff', fontWeight: 800, textShadow: '0 2px 12px rgba(0,0,0,0.5)' }}
        >
          {displayed}
        </motion.span>
      </AnimatePresence>
      {/* Slot border lines */}
      <div style={styles.topLine} />
      <div style={styles.bottomLine} />
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  reel: {
    position: 'relative',
    padding: '12px 32px',
    minWidth: 280,
    textAlign: 'center',
    overflow: 'hidden',
    background: 'rgba(255,255,255,0.07)',
    borderRadius: 12,
    backdropFilter: 'blur(4px)',
  },
  topLine: { position: 'absolute', top: 0, left: 0, right: 0, height: 2, background: 'linear-gradient(90deg, transparent, #a78bfa, transparent)' },
  bottomLine: { position: 'absolute', bottom: 0, left: 0, right: 0, height: 2, background: 'linear-gradient(90deg, transparent, #a78bfa, transparent)' },
};
