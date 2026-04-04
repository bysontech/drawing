import { useParams } from 'react-router-dom';

const PARTICIPANT_NICKNAME_KEY = 'party_lottery_participant_nickname';

export default function ParticipantWaitingPage() {
  const { roomId } = useParams<{ roomId: string }>();
  const nickname = localStorage.getItem(PARTICIPANT_NICKNAME_KEY) ?? '';

  return (
    <div style={styles.container}>
      <div style={styles.card}>
        <div style={styles.icon}>🎉</div>
        <h1 style={styles.title}>参加完了!</h1>
        {nickname && (
          <p style={styles.nicknameText}>
            ニックネーム: <strong>{nickname}</strong>
          </p>
        )}
        <p style={styles.waitingText}>主催者がくじ引きを開始するまでお待ちください。</p>
        <div style={styles.spinner} />
        <p style={styles.roomIdText}>ルームID: {roomId}</p>
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    maxWidth: 480,
    margin: '0 auto',
    padding: '40px 16px',
    fontFamily: 'system-ui, sans-serif',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: '60vh',
  },
  card: {
    textAlign: 'center',
    padding: '32px 24px',
    border: '1px solid #e0e0e0',
    borderRadius: 12,
    background: '#fafafa',
    width: '100%',
  },
  icon: {
    fontSize: 48,
    marginBottom: 16,
  },
  title: {
    fontSize: 24,
    fontWeight: 700,
    marginBottom: 12,
    color: '#1a1a1a',
  },
  nicknameText: {
    fontSize: 16,
    color: '#333',
    marginBottom: 16,
  },
  waitingText: {
    fontSize: 15,
    color: '#555',
    marginBottom: 24,
  },
  spinner: {
    width: 32,
    height: 32,
    border: '3px solid #e0e0e0',
    borderTop: '3px solid #3b82f6',
    borderRadius: '50%',
    animation: 'spin 1s linear infinite',
    margin: '0 auto 16px',
  },
  roomIdText: {
    fontSize: 12,
    color: '#aaa',
    fontFamily: 'monospace',
    marginTop: 8,
  },
};
