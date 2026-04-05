import { motion } from 'framer-motion';
import { useEffect, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import DrawStage from '../components/draw/DrawStage';
import { api, ApiClientError, storage } from '../lib/api/client';
import type { LotteryResultItem } from '../types/lottery';
import type { ResultViewItem } from '../types/resultView';
import type { RoomStatus } from '../types/room';
import { buildDrawSequence } from '../utils/buildDrawSequence';
import { presentationMode, toResultViewItems } from '../utils/resultViewModel';
import { useDrawAnimationController } from '../hooks/useDrawAnimationController';

const POLL_INTERVAL_MS = 3000;

type ViewState = 'waiting' | 'closed' | 'drawn_public' | 'drawn_private';

function useReducedMotion(): boolean {
  return window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
}

// ── Participant animation sub-component ──

interface ParticipantAnimProps {
  items: ResultViewItem[];
  allNames: string[];
  ranked: boolean;
  meId: string;
  meNick: string;
}

function ParticipantAnim({ items, allNames, ranked, meId, meNick }: ParticipantAnimProps) {
  const reducedMotion = useReducedMotion();
  const sequence = buildDrawSequence(items);
  const { state, start, skip, replay } = useDrawAnimationController(sequence, ranked, {
    reducedMotion,
    animate: true,
  });
  useEffect(() => { start(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <DrawStage
      state={state}
      allNames={allNames.length > 0 ? allNames : items.map((i) => i.nickname)}
      onSkip={skip}
      onReplay={replay}
      compact={true}
      meId={meId}
      meNick={meNick}
    />
  );
}

// ── Page ──────────────────────────────────────────────

export default function ParticipantWaitingPage() {
  const { roomId } = useParams<{ roomId: string }>();
  const { participantToken, nickname } = storage.loadParticipantSession();

  const [viewState, setViewState] = useState<ViewState>('waiting');
  const [items, setItems] = useState<ResultViewItem[]>([]);
  const [allNames, setAllNames] = useState<string[]>([]);
  const [drawnAt, setDrawnAt] = useState('');
  const [ranked, setRanked] = useState(false);
  const [alreadyAnimated, setAlreadyAnimated] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const checkStatus = async () => {
    if (!roomId) return;
    try {
      const data = await api.getParticipants(roomId);
      const status = data.status as RoomStatus;
      // Collect names for shuffle reel
      if (allNames.length === 0 && data.participants.length > 0) {
        setAllNames(data.participants.map((p) => p.nickname));
      }

      if (status === 'waiting') { setViewState('waiting'); return; }
      if (status === 'closed')  { setViewState('closed'); return; }

      if (status === 'drawn') {
        try {
          const result = await api.getRoomResult(roomId);
          const viewItems = toResultViewItems(result.results as LotteryResultItem[], participantToken, nickname);
          setItems(viewItems);
          setDrawnAt(result.drawnAt);
          setRanked(presentationMode(viewItems) === 'ranked');
          setViewState('drawn_public');
        } catch (err) {
          const isPrivate =
            err instanceof ApiClientError &&
            (err.code === 'RESULT_PRIVATE' || err.status === 403);
          setViewState(isPrivate ? 'drawn_private' : 'drawn_private');
        }
        if (pollRef.current) clearInterval(pollRef.current);
      }
    } catch { /* ignore polling errors */ }
  };

  useEffect(() => {
    checkStatus();
    pollRef.current = setInterval(checkStatus, POLL_INTERVAL_MS);
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomId]);

  // Track if we've seen drawn_public once (to play anim only first time)
  useEffect(() => {
    if (viewState === 'drawn_public' && !alreadyAnimated) {
      setAlreadyAnimated(true);
    }
  }, [viewState, alreadyAnimated]);

  const myItem = items.find((i) => i.isMe);

  return (
    <div style={styles.container}>

      {/* ── WAITING ── */}
      {viewState === 'waiting' && (
        <motion.div style={styles.card} initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}>
          <div style={styles.icon}>🎉</div>
          <h1 style={styles.title}>参加完了!</h1>
          {nickname && <p style={styles.nickText}>ニックネーム: <strong>{nickname}</strong></p>}
          <p style={styles.bodyText}>主催者がくじ引きを開始するまでお待ちください。</p>
          <div style={styles.spinner} />
          <span style={styles.statusPill}>参加受付中</span>
        </motion.div>
      )}

      {/* ── CLOSED ── */}
      {viewState === 'closed' && (
        <motion.div style={styles.card} initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}>
          <div style={styles.icon}>⏳</div>
          <h1 style={styles.title}>受付終了</h1>
          {nickname && <p style={styles.nickText}>ニックネーム: <strong>{nickname}</strong></p>}
          <p style={styles.bodyText}>まもなく抽選が始まります。</p>
          <div style={styles.spinner} />
          <span style={{ ...styles.statusPill, background: '#fed7aa', color: '#92400e' }}>受付終了・抽選待ち</span>
        </motion.div>
      )}

      {/* ── DRAWN PRIVATE ── */}
      {viewState === 'drawn_private' && (
        <motion.div style={styles.card} initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}>
          <div style={styles.icon}>🎯</div>
          <h1 style={styles.title}>抽選完了</h1>
          {nickname && <p style={styles.nickText}>ニックネーム: <strong>{nickname}</strong></p>}
          <p style={styles.bodyText}>結果は主催者にお聞きください。</p>
          <span style={{ ...styles.statusPill, background: '#e0e7ff', color: '#3730a3' }}>抽選完了（非公開）</span>
        </motion.div>
      )}

      {/* ── DRAWN PUBLIC ── */}
      {viewState === 'drawn_public' && (
        <div>
          {/* My result highlight */}
          <motion.div
            style={{ ...styles.card, ...(myItem ? styles.winnerCard : styles.neutralCard) }}
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
          >
            <div style={styles.icon}>{myItem ? '🏆' : '🎊'}</div>
            <h1 style={styles.title}>
              {myItem ? '当選おめでとうございます！' : '抽選結果が出ました'}
            </h1>
            {nickname && <p style={styles.nickText}>ニックネーム: <strong>{nickname}</strong></p>}
            {myItem && (
              <div style={styles.myBadgeRow}>
                {ranked && myItem.rank !== null && (
                  <span style={styles.rankBadge}>{myItem.rank}位</span>
                )}
                {myItem.role && (
                  <span style={styles.roleBadge}>役割: {myItem.role}</span>
                )}
              </div>
            )}
            {!myItem && (
              <p style={{ ...styles.bodyText, color: '#6b7280' }}>今回は当選しませんでした。</p>
            )}
            {drawnAt && <p style={styles.drawnAt}>{new Date(drawnAt).toLocaleString('ja-JP')}</p>}
          </motion.div>

          {/* Animated results */}
          <h2 style={styles.allTitle}>全結果</h2>
          <ParticipantAnim
            items={items}
            allNames={allNames}
            ranked={ranked}
            meId={participantToken}
            meNick={nickname}
          />
        </div>
      )}

      <p style={styles.roomIdText}>ルームID: {roomId}</p>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: { maxWidth: 520, margin: '0 auto', padding: '32px 16px', fontFamily: 'system-ui, sans-serif' },
  card: { textAlign: 'center', padding: '28px 20px', border: '1px solid #e5e7eb', borderRadius: 14, background: '#fafafa', marginBottom: 20 },
  winnerCard: { border: '2px solid #fbbf24', background: '#fffbeb' },
  neutralCard: { background: '#f9fafb' },
  icon: { fontSize: 44, marginBottom: 10 },
  title: { fontSize: 20, fontWeight: 700, marginBottom: 8 },
  nickText: { fontSize: 15, color: '#374151', marginBottom: 10 },
  bodyText: { fontSize: 14, color: '#6b7280', marginBottom: 16 },
  statusPill: { display: 'inline-block', background: '#dcfce7', color: '#166534', borderRadius: 20, padding: '3px 14px', fontSize: 12, fontWeight: 600 },
  spinner: { width: 28, height: 28, border: '3px solid #e5e7eb', borderTop: '3px solid #3b82f6', borderRadius: '50%', animation: 'spin 1s linear infinite', margin: '0 auto 14px' },
  myBadgeRow: { display: 'flex', gap: 8, justifyContent: 'center', flexWrap: 'wrap', marginBottom: 10 },
  rankBadge: { background: '#fef08a', color: '#92400e', borderRadius: 20, padding: '4px 14px', fontWeight: 700, fontSize: 15 },
  roleBadge: { background: '#e0f2fe', color: '#0369a1', borderRadius: 20, padding: '4px 14px', fontSize: 13 },
  drawnAt: { fontSize: 12, color: '#9ca3af', marginTop: 6 },
  allTitle: { fontSize: 15, fontWeight: 600, marginBottom: 10, color: '#374151' },
  roomIdText: { fontSize: 12, color: '#d1d5db', fontFamily: 'monospace', textAlign: 'center', marginTop: 20 },
};
