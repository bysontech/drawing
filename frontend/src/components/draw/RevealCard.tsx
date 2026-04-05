import { motion } from 'framer-motion';

interface RevealCardProps {
  nickname: string;
  rank: number | null;
  role: string | null;
  showRole: boolean;   // true once reveal_role phase reached
  isMe?: boolean;
  compact?: boolean;
}

export default function RevealCard({ nickname, rank, role, showRole, isMe = false, compact = false }: RevealCardProps) {
  const nameSize = compact ? 22 : 40;
  const rankSize = compact ? 14 : 22;

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.7, y: 30 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      transition={{ type: 'spring', stiffness: 260, damping: 20 }}
      style={{
        ...styles.card,
        ...(isMe ? styles.meCard : {}),
        padding: compact ? '16px 20px' : '24px 40px',
      }}
    >
      {rank !== null && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          style={{ ...styles.rankLabel, fontSize: rankSize }}
        >
          {rank}位
        </motion.div>
      )}

      <motion.div
        style={{ ...styles.name, fontSize: nameSize }}
        animate={isMe ? { textShadow: ['0 0 0px #fbbf24', '0 0 20px #fbbf24', '0 0 0px #fbbf24'] } : {}}
        transition={{ duration: 1.5, repeat: Infinity }}
      >
        {nickname}
        {isMe && <span style={styles.meBadge}>あなた</span>}
      </motion.div>

      {role && showRole && (
        <motion.div
          initial={{ opacity: 0, y: 12, scale: 0.8 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ type: 'spring', stiffness: 200, damping: 18, delay: 0.1 }}
          style={styles.roleBadge}
        >
          {role}
        </motion.div>
      )}
    </motion.div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  card: {
    background: 'rgba(255,255,255,0.1)',
    backdropFilter: 'blur(8px)',
    borderRadius: 16,
    border: '1px solid rgba(255,255,255,0.2)',
    textAlign: 'center',
    color: '#fff',
  },
  meCard: {
    background: 'rgba(251,191,36,0.15)',
    border: '1.5px solid rgba(251,191,36,0.5)',
  },
  rankLabel: {
    fontWeight: 700,
    color: '#fbbf24',
    marginBottom: 6,
    textShadow: '0 0 12px rgba(251,191,36,0.6)',
  },
  name: {
    fontWeight: 800,
    color: '#fff',
    textShadow: '0 2px 16px rgba(0,0,0,0.5)',
    marginBottom: 4,
  },
  meBadge: {
    marginLeft: 10,
    fontSize: 14,
    fontWeight: 600,
    color: '#fbbf24',
    background: 'rgba(251,191,36,0.2)',
    borderRadius: 20,
    padding: '2px 10px',
  },
  roleBadge: {
    display: 'inline-block',
    marginTop: 10,
    background: 'linear-gradient(135deg, #7c3aed, #a855f7)',
    color: '#fff',
    borderRadius: 20,
    padding: '5px 18px',
    fontSize: 15,
    fontWeight: 700,
    boxShadow: '0 4px 14px rgba(124,58,237,0.5)',
  },
};
