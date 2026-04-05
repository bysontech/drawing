import { motion } from 'framer-motion';
import { useEffect, useRef } from 'react';

interface CelebrationFxProps {
  active: boolean;
  reducedMotion: boolean;
  compact?: boolean;
}

// Lightweight canvas-based confetti (no external lib)
function drawConfetti(canvas: HTMLCanvasElement) {
  const ctx = canvas.getContext('2d');
  if (!ctx) return () => {};

  const W = canvas.width;
  const H = canvas.height;
  const COLORS = ['#fbbf24', '#a855f7', '#3b82f6', '#10b981', '#ef4444', '#f9fafb'];
  const count = 80;

  interface Piece { x: number; y: number; r: number; d: number; color: string; tilt: number; tiltAngle: number; tiltAngleInc: number; }
  const pieces: Piece[] = Array.from({ length: count }, () => ({
    x: Math.random() * W,
    y: Math.random() * H - H,
    r: Math.random() * 8 + 4,
    d: Math.random() * count,
    color: COLORS[Math.floor(Math.random() * COLORS.length)],
    tilt: Math.floor(Math.random() * 10) - 10,
    tiltAngle: 0,
    tiltAngleInc: Math.random() * 0.07 + 0.05,
  }));

  let angle = 0;
  let raf: number;

  const draw = () => {
    ctx.clearRect(0, 0, W, H);
    angle += 0.01;

    for (const p of pieces) {
      p.tiltAngle += p.tiltAngleInc;
      p.y += (Math.cos(angle + p.d) + 2 + p.r / 2) * 1.2;
      p.tilt = Math.sin(p.tiltAngle) * 12;
      ctx.beginPath();
      ctx.lineWidth = p.r / 2;
      ctx.strokeStyle = p.color;
      ctx.moveTo(p.x + p.tilt + p.r / 4, p.y);
      ctx.lineTo(p.x + p.tilt, p.y + p.tilt + p.r / 4);
      ctx.stroke();
      if (p.y > H) { p.x = Math.random() * W; p.y = -10; }
    }
    raf = requestAnimationFrame(draw);
  };

  draw();
  return () => { cancelAnimationFrame(raf); ctx.clearRect(0, 0, W, H); };
}

export default function CelebrationFx({ active, reducedMotion, compact = false }: CelebrationFxProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const cleanupRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    if (active && !reducedMotion && canvasRef.current) {
      cleanupRef.current = drawConfetti(canvasRef.current);
    }
    return () => { cleanupRef.current?.(); cleanupRef.current = null; };
  }, [active, reducedMotion]);

  if (reducedMotion || !active) return null;

  return (
    <div style={{ ...styles.wrapper, pointerEvents: 'none' }}>
      <canvas
        ref={canvasRef}
        width={compact ? 400 : 800}
        height={compact ? 300 : 600}
        style={styles.canvas}
      />
      {/* Glow flash */}
      <motion.div
        style={styles.glow}
        initial={{ opacity: 0 }}
        animate={{ opacity: [0, 0.6, 0] }}
        transition={{ duration: 0.6, ease: 'easeOut' }}
      />
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  wrapper: { position: 'absolute', inset: 0, zIndex: 10 },
  canvas: { position: 'absolute', inset: 0, width: '100%', height: '100%' },
  glow: {
    position: 'absolute', inset: 0,
    background: 'radial-gradient(circle at 50% 50%, rgba(251,191,36,0.35) 0%, transparent 70%)',
  },
};
