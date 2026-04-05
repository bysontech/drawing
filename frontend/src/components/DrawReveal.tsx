import { useEffect, useState } from 'react';
import type { ResultViewItem } from '../types/resultView';
import { rankLabel } from '../utils/resultViewModel';

interface DrawRevealProps {
  items: ResultViewItem[];
  /** If true, reveal one item at a time. If false, show all after a short delay. */
  ranked: boolean;
  /** Whether this is a fresh draw (plays animation) or a reload (skip). */
  animate: boolean;
  onComplete?: () => void;
}

const REVEAL_INTERVAL_MS = 700;
const FLAT_DELAY_MS = 1200;

export default function DrawReveal({ items, ranked, animate, onComplete }: DrawRevealProps) {
  const [revealedCount, setRevealedCount] = useState(animate ? 0 : items.length);

  useEffect(() => {
    if (!animate) {
      setRevealedCount(items.length);
      onComplete?.();
      return;
    }

    if (ranked) {
      // Reveal one at a time
      if (revealedCount >= items.length) {
        onComplete?.();
        return;
      }
      const timer = setTimeout(() => {
        setRevealedCount((n) => n + 1);
      }, REVEAL_INTERVAL_MS);
      return () => clearTimeout(timer);
    } else {
      // Reveal all after short delay
      const timer = setTimeout(() => {
        setRevealedCount(items.length);
        onComplete?.();
      }, FLAT_DELAY_MS);
      return () => clearTimeout(timer);
    }
  }, [animate, ranked, revealedCount, items.length, onComplete]);

  const visible = items.slice(0, revealedCount);

  return (
    <div>
      {ranked && animate && revealedCount < items.length && (
        <div style={styles.revealHint}>✨ 発表中...</div>
      )}

      <ul style={styles.list}>
        {visible.map((item, idx) => (
          <li
            key={item.participantId}
            style={{
              ...styles.item,
              ...(item.isMe ? styles.itemMe : {}),
              animation: animate ? 'fadeSlideIn 0.4s ease' : 'none',
            }}
          >
            <div style={styles.rankBox}>
              <span style={{ ...styles.rankBadge, ...(item.rank === 1 ? styles.rank1 : item.rank === 2 ? styles.rank2 : item.rank === 3 ? styles.rank3 : {}) }}>
                {rankLabel(item, idx)}
              </span>
            </div>
            <div style={styles.info}>
              <span style={styles.nickname}>
                {item.nickname}
                {item.isMe && <span style={styles.meTag}> あなた</span>}
              </span>
              {item.role && <span style={styles.roleBadge}>{item.role}</span>}
            </div>
          </li>
        ))}
      </ul>

      {animate && revealedCount < items.length && ranked && (
        <div style={styles.dots}>
          <span style={styles.dot} />
          <span style={styles.dot} />
          <span style={styles.dot} />
        </div>
      )}
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  list: { listStyle: 'none', padding: 0, margin: 0 },
  item: {
    display: 'flex',
    alignItems: 'center',
    gap: 14,
    padding: '12px 14px',
    marginBottom: 8,
    borderRadius: 8,
    border: '1px solid #e5e7eb',
    background: '#fff',
    transition: 'background 0.2s',
  },
  itemMe: {
    background: '#eff6ff',
    border: '1.5px solid #93c5fd',
  },
  rankBox: { width: 44, textAlign: 'center', flexShrink: 0 },
  rankBadge: {
    display: 'inline-block',
    background: '#e0e7ff',
    color: '#3730a3',
    borderRadius: 20,
    padding: '3px 10px',
    fontSize: 13,
    fontWeight: 700,
  },
  rank1: { background: '#fef08a', color: '#92400e', fontSize: 15 },
  rank2: { background: '#e5e7eb', color: '#374151' },
  rank3: { background: '#fed7aa', color: '#92400e' },
  info: { display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', flex: 1 },
  nickname: { fontSize: 16, fontWeight: 600 },
  meTag: { fontSize: 12, fontWeight: 400, color: '#2563eb' },
  roleBadge: {
    fontSize: 12,
    color: '#0369a1',
    background: '#e0f2fe',
    borderRadius: 4,
    padding: '2px 8px',
    fontWeight: 500,
  },
  revealHint: { textAlign: 'center', fontSize: 14, color: '#7c3aed', marginBottom: 12, fontWeight: 600 },
  dots: { display: 'flex', justifyContent: 'center', gap: 6, padding: '16px 0' },
  dot: { width: 8, height: 8, borderRadius: '50%', background: '#c4b5fd', display: 'inline-block' },
};
