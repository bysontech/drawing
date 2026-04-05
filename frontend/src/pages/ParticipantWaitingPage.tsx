import { useEffect, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import { api, ApiClientError, storage } from '../lib/api/client';
import type { LotteryResultItem } from '../types/lottery';
import type { RoomStatus } from '../types/room';

const POLL_INTERVAL_MS = 3000;

type ViewState = 'waiting' | 'closed' | 'drawn_public' | 'drawn_private';

export default function ParticipantWaitingPage() {
  const { roomId } = useParams<{ roomId: string }>();
  const { participantToken, nickname } = storage.loadParticipantSession();

  const [viewState, setViewState] = useState<ViewState>('waiting');
  const [results, setResults] = useState<LotteryResultItem[]>([]);
  const [drawnAt, setDrawnAt] = useState('');
  const [ranked, setRanked] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const checkStatus = async () => {
    if (!roomId) return;

    // Check participants endpoint to get room status
    try {
      const data = await api.getParticipants(roomId);
      const status = data.status as RoomStatus;

      if (status === 'waiting') {
        setViewState('waiting');
        return;
      }
      if (status === 'closed') {
        setViewState('closed');
        return;
      }
      if (status === 'drawn') {
        // Try to fetch result
        try {
          const result = await api.getRoomResult(roomId);
          setResults(result.results);
          setDrawnAt(result.drawnAt);
          setRanked(result.results.some((r) => r.rank !== null));
          setViewState('drawn_public');
        } catch (err) {
          if (err instanceof ApiClientError && (err.code === 'RESULT_PRIVATE' || err.status === 403)) {
            setViewState('drawn_private');
          } else {
            setViewState('drawn_private');
          }
        }
        // Stop polling once drawn
        if (pollRef.current) clearInterval(pollRef.current);
      }
    } catch {
      // ignore polling errors
    }
  };

  useEffect(() => {
    checkStatus();
    pollRef.current = setInterval(checkStatus, POLL_INTERVAL_MS);
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomId]);

  const myResult = results.find((r) => r.participant_id === participantToken) ??
    results.find((r) => r.nickname === nickname);
  const isWinner = !!myResult;

  return (
    <div style={styles.container}>
      {viewState === 'waiting' && (
        <div style={styles.card}>
          <div style={styles.icon}>🎉</div>
          <h1 style={styles.title}>参加完了!</h1>
          {nickname && (
            <p style={styles.nicknameText}>ニックネーム: <strong>{nickname}</strong></p>
          )}
          <p style={styles.waitingText}>主催者がくじ引きを開始するまでお待ちください。</p>
          <div style={styles.spinner} />
        </div>
      )}

      {viewState === 'closed' && (
        <div style={styles.card}>
          <div style={styles.icon}>⏳</div>
          <h1 style={styles.title}>受付終了</h1>
          {nickname && (
            <p style={styles.nicknameText}>ニックネーム: <strong>{nickname}</strong></p>
          )}
          <p style={styles.waitingText}>もうすぐ抽選が始まります。しばらくお待ちください。</p>
          <div style={styles.spinner} />
        </div>
      )}

      {viewState === 'drawn_private' && (
        <div style={styles.card}>
          <div style={styles.icon}>🎯</div>
          <h1 style={styles.title}>抽選完了</h1>
          {nickname && (
            <p style={styles.nicknameText}>ニックネーム: <strong>{nickname}</strong></p>
          )}
          <p style={styles.waitingText}>結果は主催者にお聞きください。</p>
        </div>
      )}

      {viewState === 'drawn_public' && (
        <div>
          <div style={styles.card}>
            <div style={styles.icon}>{isWinner ? '🏆' : '🎊'}</div>
            <h1 style={styles.title}>{isWinner ? '当選おめでとうございます!' : '抽選結果が出ました'}</h1>
            {nickname && (
              <p style={styles.nicknameText}>ニックネーム: <strong>{nickname}</strong></p>
            )}
            {isWinner && myResult && (
              <div style={styles.myResultBox}>
                {ranked && myResult.rank !== null && (
                  <span style={styles.myRank}>{myResult.rank}位</span>
                )}
                {myResult.role && (
                  <span style={styles.myRole}>役割: {myResult.role}</span>
                )}
              </div>
            )}
            {!isWinner && (
              <p style={{ ...styles.waitingText, color: '#6b7280' }}>今回は当選しませんでした。</p>
            )}
            {drawnAt && (
              <p style={styles.drawnAt}>{new Date(drawnAt).toLocaleString('ja-JP')}</p>
            )}
          </div>

          <h2 style={styles.allResultsTitle}>全結果</h2>
          <ul style={styles.resultList}>
            {results.map((item, idx) => {
              const isMe = item.participant_id === participantToken || item.nickname === nickname;
              return (
                <li key={item.participant_id} style={{ ...styles.resultItem, ...(isMe ? styles.resultItemMe : {}) }}>
                  <span style={styles.resultRank}>
                    {ranked && item.rank !== null ? `${item.rank}位` : `${idx + 1}`}
                  </span>
                  <span style={styles.resultNickname}>
                    {item.nickname}{isMe && ' (あなた)'}
                  </span>
                  {item.role && <span style={styles.resultRole}>{item.role}</span>}
                </li>
              );
            })}
          </ul>
        </div>
      )}

      <p style={styles.roomIdText}>ルームID: {roomId}</p>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: { maxWidth: 480, margin: '0 auto', padding: '40px 16px', fontFamily: 'system-ui, sans-serif' },
  card: { textAlign: 'center', padding: '32px 24px', border: '1px solid #e0e0e0', borderRadius: 12, background: '#fafafa', marginBottom: 24 },
  icon: { fontSize: 48, marginBottom: 16 },
  title: { fontSize: 22, fontWeight: 700, marginBottom: 12, color: '#1a1a1a' },
  nicknameText: { fontSize: 16, color: '#333', marginBottom: 16 },
  waitingText: { fontSize: 15, color: '#555', marginBottom: 24 },
  spinner: { width: 32, height: 32, border: '3px solid #e0e0e0', borderTop: '3px solid #3b82f6', borderRadius: '50%', animation: 'spin 1s linear infinite', margin: '0 auto 16px' },
  myResultBox: { display: 'flex', gap: 8, justifyContent: 'center', alignItems: 'center', marginBottom: 12, flexWrap: 'wrap' },
  myRank: { background: '#fef08a', color: '#92400e', borderRadius: 20, padding: '4px 12px', fontWeight: 700, fontSize: 16 },
  myRole: { background: '#e0f2fe', color: '#0369a1', borderRadius: 20, padding: '4px 12px', fontSize: 14 },
  drawnAt: { fontSize: 12, color: '#aaa', marginTop: 8 },
  allResultsTitle: { fontSize: 16, fontWeight: 600, marginBottom: 12 },
  resultList: { listStyle: 'none', padding: 0, margin: '0 0 16px' },
  resultItem: { display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', borderBottom: '1px solid #eee', borderRadius: 4 },
  resultItemMe: { background: '#eff6ff', fontWeight: 700 },
  resultRank: { width: 32, textAlign: 'center', fontSize: 13, color: '#6b7280', flexShrink: 0 },
  resultNickname: { flex: 1, fontSize: 15 },
  resultRole: { fontSize: 12, color: '#6b7280', background: '#f3f4f6', borderRadius: 4, padding: '1px 6px' },
  roomIdText: { fontSize: 12, color: '#aaa', fontFamily: 'monospace', textAlign: 'center', marginTop: 8 },
};
