import { useEffect, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import DrawReveal from '../components/DrawReveal';
import { api, ApiClientError, storage } from '../lib/api/client';
import type { ResultViewItem } from '../types/resultView';
import type { RoomStatus } from '../types/room';
import { presentationMode, toResultViewItems } from '../utils/resultViewModel';

const POLL_INTERVAL_MS = 3000;

type ViewState = 'waiting' | 'closed' | 'drawn_public' | 'drawn_private';

export default function ParticipantWaitingPage() {
  const { roomId } = useParams<{ roomId: string }>();
  const { participantToken, nickname } = storage.loadParticipantSession();

  const [viewState, setViewState] = useState<ViewState>('waiting');
  const [items, setItems] = useState<ResultViewItem[]>([]);
  const [drawnAt, setDrawnAt] = useState('');
  const [ranked, setRanked] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const checkStatus = async () => {
    if (!roomId) return;

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
        try {
          const result = await api.getRoomResult(roomId);
          const viewItems = toResultViewItems(result.results, participantToken, nickname);
          setItems(viewItems);
          setDrawnAt(result.drawnAt);
          setRanked(presentationMode(viewItems) === 'ranked');
          setViewState('drawn_public');
        } catch (err) {
          if (
            err instanceof ApiClientError &&
            (err.code === 'RESULT_PRIVATE' || err.status === 403)
          ) {
            setViewState('drawn_private');
          } else {
            setViewState('drawn_private');
          }
        }
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

  const myItem = items.find((i) => i.isMe);
  const isWinner = !!myItem;

  return (
    <div style={styles.container}>

      {/* ── WAITING ── */}
      {viewState === 'waiting' && (
        <div style={styles.card}>
          <div style={styles.icon}>🎉</div>
          <h1 style={styles.title}>参加完了!</h1>
          {nickname && <p style={styles.nicknameText}>ニックネーム: <strong>{nickname}</strong></p>}
          <p style={styles.stateText}>主催者がくじ引きを開始するまでお待ちください。</p>
          <div style={styles.spinner} />
          <p style={styles.statusLabel}>参加受付中</p>
        </div>
      )}

      {/* ── CLOSED ── */}
      {viewState === 'closed' && (
        <div style={styles.card}>
          <div style={styles.icon}>⏳</div>
          <h1 style={styles.title}>受付終了</h1>
          {nickname && <p style={styles.nicknameText}>ニックネーム: <strong>{nickname}</strong></p>}
          <p style={styles.stateText}>まもなく抽選が始まります。</p>
          <div style={styles.spinner} />
          <p style={styles.statusLabel}>受付終了・抽選待ち</p>
        </div>
      )}

      {/* ── DRAWN + PRIVATE ── */}
      {viewState === 'drawn_private' && (
        <div style={styles.card}>
          <div style={styles.icon}>🎯</div>
          <h1 style={styles.title}>抽選完了</h1>
          {nickname && <p style={styles.nicknameText}>ニックネーム: <strong>{nickname}</strong></p>}
          <p style={styles.stateText}>結果は主催者にお聞きください。</p>
          <p style={styles.statusLabel}>抽選完了（非公開）</p>
        </div>
      )}

      {/* ── DRAWN + PUBLIC ── */}
      {viewState === 'drawn_public' && (
        <div>
          {/* My result card */}
          <div style={{ ...styles.card, ...(isWinner ? styles.winnerCard : styles.nonWinnerCard) }}>
            <div style={styles.icon}>{isWinner ? '🏆' : '🎊'}</div>
            <h1 style={styles.title}>
              {isWinner ? '当選おめでとうございます！' : '抽選結果が出ました'}
            </h1>
            {nickname && <p style={styles.nicknameText}>ニックネーム: <strong>{nickname}</strong></p>}
            {isWinner && myItem && (
              <div style={styles.myHighlight}>
                {ranked && myItem.rank !== null && (
                  <span style={styles.myRankBadge}>{myItem.rank}位</span>
                )}
                {myItem.role && (
                  <span style={styles.myRoleBadge}>役割: {myItem.role}</span>
                )}
              </div>
            )}
            {!isWinner && (
              <p style={{ ...styles.stateText, color: '#6b7280' }}>
                今回は当選しませんでした。
              </p>
            )}
            {drawnAt && (
              <p style={styles.drawnAt}>{new Date(drawnAt).toLocaleString('ja-JP')}</p>
            )}
          </div>

          {/* All results */}
          <h2 style={styles.allTitle}>全結果</h2>
          <DrawReveal
            items={items}
            ranked={ranked}
            animate={false}
          />
        </div>
      )}

      <p style={styles.roomIdText}>ルームID: {roomId}</p>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: { maxWidth: 480, margin: '0 auto', padding: '32px 16px', fontFamily: 'system-ui, sans-serif' },
  card: { textAlign: 'center', padding: '32px 20px', border: '1px solid #e5e7eb', borderRadius: 12, background: '#fafafa', marginBottom: 24 },
  winnerCard: { border: '2px solid #fbbf24', background: '#fffbeb' },
  nonWinnerCard: { background: '#f9fafb' },
  icon: { fontSize: 48, marginBottom: 12 },
  title: { fontSize: 21, fontWeight: 700, marginBottom: 10 },
  nicknameText: { fontSize: 15, color: '#374151', marginBottom: 12 },
  stateText: { fontSize: 15, color: '#555', marginBottom: 16 },
  statusLabel: { display: 'inline-block', background: '#e0e7ff', color: '#3730a3', borderRadius: 20, padding: '3px 12px', fontSize: 12, fontWeight: 600, marginTop: 4 },
  spinner: { width: 30, height: 30, border: '3px solid #e5e7eb', borderTop: '3px solid #3b82f6', borderRadius: '50%', animation: 'spin 1s linear infinite', margin: '0 auto 16px' },
  myHighlight: { display: 'flex', gap: 8, justifyContent: 'center', alignItems: 'center', marginBottom: 12, flexWrap: 'wrap' },
  myRankBadge: { background: '#fef08a', color: '#92400e', borderRadius: 20, padding: '4px 14px', fontWeight: 700, fontSize: 15 },
  myRoleBadge: { background: '#e0f2fe', color: '#0369a1', borderRadius: 20, padding: '4px 14px', fontSize: 14 },
  drawnAt: { fontSize: 12, color: '#9ca3af', marginTop: 8 },
  allTitle: { fontSize: 15, fontWeight: 600, marginBottom: 12, color: '#374151' },
  roomIdText: { fontSize: 12, color: '#d1d5db', fontFamily: 'monospace', textAlign: 'center', marginTop: 24 },
};
