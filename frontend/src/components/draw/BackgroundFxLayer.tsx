import { motion } from 'framer-motion';

interface BackgroundFxLayerProps {
  active: boolean;
  reducedMotion: boolean;
}

export default function BackgroundFxLayer({ active, reducedMotion }: BackgroundFxLayerProps) {
  if (reducedMotion) {
    return <div style={{ ...styles.base, background: 'linear-gradient(135deg, #1e1b4b 0%, #312e81 100%)' }} />;
  }

  return (
    <div style={styles.base}>
      {/* Gradient base */}
      <motion.div
        style={styles.gradient}
        animate={active ? { opacity: [0.7, 1, 0.7] } : { opacity: 0.7 }}
        transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
      />
      {/* Orbs */}
      {active && (
        <>
          <motion.div
            style={{ ...styles.orb, background: 'radial-gradient(circle, #7c3aed66 0%, transparent 70%)', width: 400, height: 400, left: '-10%', top: '-10%' }}
            animate={{ x: [0, 40, 0], y: [0, 30, 0], scale: [1, 1.15, 1] }}
            transition={{ duration: 5, repeat: Infinity, ease: 'easeInOut' }}
          />
          <motion.div
            style={{ ...styles.orb, background: 'radial-gradient(circle, #a855f766 0%, transparent 70%)', width: 300, height: 300, right: '-5%', bottom: '-5%' }}
            animate={{ x: [0, -30, 0], y: [0, -20, 0], scale: [1, 1.2, 1] }}
            transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut', delay: 1 }}
          />
          <motion.div
            style={{ ...styles.orb, background: 'radial-gradient(circle, #3b82f644 0%, transparent 70%)', width: 250, height: 250, left: '40%', top: '30%' }}
            animate={{ scale: [1, 1.3, 1], opacity: [0.4, 0.7, 0.4] }}
            transition={{ duration: 3.5, repeat: Infinity, ease: 'easeInOut', delay: 0.5 }}
          />
        </>
      )}
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  base: {
    position: 'absolute', inset: 0, overflow: 'hidden', zIndex: 0,
    background: 'linear-gradient(135deg, #0f0c29 0%, #302b63 50%, #24243e 100%)',
  },
  gradient: { position: 'absolute', inset: 0, background: 'linear-gradient(135deg, #1e1b4b 0%, #312e81 50%, #1e1b4b 100%)' },
  orb: { position: 'absolute', borderRadius: '50%', pointerEvents: 'none' },
};
