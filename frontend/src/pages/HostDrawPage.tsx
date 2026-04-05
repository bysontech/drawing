import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import DrawStage from '../components/draw/DrawStage';
import { api, ApiClientError, storage } from '../lib/api/client';
import type { ResultViewItem } from '../types/resultView';
import type { LotteryResultItem } from '../types/lottery';
import { buildDrawSequence } from '../utils/buildDrawSequence';
import { presentationMode, toResultViewItems } from '../utils/resultViewModel';
import { useDrawAnimationController } from '../hooks/useDrawAnimationController';

const ERROR_MESSAGES: Record<string, string> = {
  ALREADY_DRAWN: '抽選は既に完了しています。',
  DRAW_NOT_ALLOWED: '参加を締め切ってから抽選してください。',
  FORBIDDEN: '操作権限がありません。',
  VALIDATION_ERROR: '入力内容を確認してください。',
  SERVER_ERROR: 'サーバーエラーが発生しました。',
};

type PageState = 'loading' | 'ready' | 'drawing_api' | 'animating' | 'done_no_anim' | 'error' | 'no_auth';

function useReducedMotion(): boolean {
  return window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
}

// ── Inner component that owns the animation controller ──

interface AnimatedDrawProps {
  items: ResultViewItem[];
  allNames: string[];
  animate: boolean;
  ranked: boolean;
  drawnAt: string;
  onBack: () => void;
}

function AnimatedDraw({ items, allNames, animate, ranked, drawnAt, onBack }: AnimatedDrawProps) {
  const reducedMotion = useReducedMotion();
  const sequence = buildDrawSequence(items);
  const { state, start, skip, replay } = useDrawAnimationController(sequence, ranked, {
    reducedMotion,
    animate,
  });

  // Auto-start
  useEffect(() => { start(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div style={styles.animWrapper}>
      <DrawStage
        state={state}
        allNames={allNames}
        onSkip={skip}
        onReplay={replay}
        onBack={onBack}
      />

      {/* Metadata below stage */}
      {state.phase === 'completed' && drawnAt && (
        <p style={styles.drawnAt}>
          抽選日時: {new Date(drawnAt).toLocaleString('ja-JP')}
        </p>
      )}
    </div>
  );
}

// ── Page ──────────────────────────────────────────────

export default function HostDrawPage() {
  const { roomId } = useParams<{ roomId: string }>();
  const navigate = useNavigate();
  const session = storage.loadHostSession();
  const hostToken = session?.hostToken ?? '';

  const [pageState, setPageState] = useState<PageState>(() =>
    !session || session.roomId !== roomId ? 'no_auth' : 'loading'
  );

  const [items, setItems] = useState<ResultViewItem[]>([]);
  const [allNames, setAllNames] = useState<string[]>([]);
  const [drawnAt, setDrawnAt] = useState('');
  const [ranked, setRanked] = useState(false);
  const [shouldAnimate, setShouldAnimate] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  // Load participants for shuffle reel names
  useEffect(() => {
    if (!roomId) return;
    api.getParticipants(roomId)
      .then((d) => setAllNames(d.participants.map((p) => p.nickname)))
      .catch(() => {});
  }, [roomId]);

  // On mount: check for existing result
  useEffect(() => {
    if (pageState === 'no_auth' || !roomId) return;

    api.getRoomResult(roomId, hostToken)
      .then((data) => {
        const viewItems = toResultViewItems(data.results as LotteryResultItem[], '', '');
        setItems(viewItems);
        setDrawnAt(data.drawnAt);
        setRanked(presentationMode(viewItems) === 'ranked');
        setShouldAnimate(false); // reload → skip animation
        setPageState('animating');
      })
      .catch((err: unknown) => {
        if (err instanceof ApiClientError && err.status === 404) {
          setPageState('ready');
        } else {
          setPageState('ready');
        }
      });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleDraw = async () => {
    if (!roomId) return;
    setPageState('drawing_api');
    setErrorMsg('');

    try {
      const data = await api.drawLottery(roomId, hostToken);
      const viewItems = toResultViewItems(data.results as LotteryResultItem[], '', '');
      setItems(viewItems);
      setDrawnAt(data.drawnAt);
      setRanked(presentationMode(viewItems) === 'ranked');
      setShouldAnimate(true); // fresh draw → full animation
      setPageState('animating');
    } catch (err) {
      if (err instanceof ApiClientError) {
        if (err.code === 'ALREADY_DRAWN') {
          try {
            const existing = await api.getRoomResult(roomId, hostToken);
            const viewItems = toResultViewItems(existing.results as LotteryResultItem[], '', '');
            setItems(viewItems);
            setDrawnAt(existing.drawnAt);
            setRanked(presentationMode(viewItems) === 'ranked');
            setShouldAnimate(false);
            setPageState('animating');
            return;
          } catch { /* fall through */ }
        }
        setErrorMsg(ERROR_MESSAGES[err.code] ?? err.message);
      } else {
        setErrorMsg(ERROR_MESSAGES['SERVER_ERROR']);
      }
      setPageState('error');
    }
  };

  if (pageState === 'no_auth') {
    return (
      <div style={styles.page}>
        <h1 style={styles.title}>アクセスできません</h1>
        <p style={styles.subtitle}>主催者情報が見つかりません。ルームを作成してください。</p>
        <Link to="/" style={styles.linkBtn}>トップに戻る</Link>
      </div>
    );
  }

  const goBack = () => navigate('/');

  return (
    <div style={styles.page}>
      {/* Header — only show when not animating */}
      {pageState !== 'animating' && (
        <div style={styles.header}>
          <Link to="/" style={styles.backLink}>← 主催者画面</Link>
          <h1 style={styles.title}>くじ引き</h1>
        </div>
      )}

      {pageState === 'loading' && (
        <div style={styles.center}>
          <div style={styles.spinner} />
          <p style={styles.subtleText}>読み込み中...</p>
        </div>
      )}

      {pageState === 'ready' && (
        <div style={styles.center}>
          <p style={styles.subtitle}>準備ができたら抽選開始ボタンを押してください。</p>
          <button style={styles.drawBtn} onClick={handleDraw}>🎉 抽選開始！</button>
        </div>
      )}

      {pageState === 'drawing_api' && (
        <div style={styles.center}>
          <div style={styles.bigSpinner} />
          <p style={styles.drawingText}>抽選処理中...</p>
        </div>
      )}

      {pageState === 'error' && (
        <div style={styles.center}>
          <p style={styles.errorText}>{errorMsg}</p>
          <button style={styles.drawBtn} onClick={handleDraw}>もう一度試す</button>
        </div>
      )}

      {pageState === 'animating' && (
        <AnimatedDraw
          items={items}
          allNames={allNames.length > 0 ? allNames : items.map((i) => i.nickname)}
          animate={shouldAnimate}
          ranked={ranked}
          drawnAt={drawnAt}
          onBack={goBack}
        />
      )}
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  page: { maxWidth: 680, margin: '0 auto', padding: '20px 16px', fontFamily: 'system-ui, sans-serif' },
  header: { marginBottom: 20 },
  backLink: { fontSize: 13, color: '#3b82f6', textDecoration: 'none' },
  title: { fontSize: 24, fontWeight: 700, marginTop: 8, color: '#111827' },
  subtitle: { color: '#6b7280', marginBottom: 24 },
  subtleText: { color: '#9ca3af', fontSize: 14 },
  center: { textAlign: 'center', padding: '60px 0' },
  drawBtn: {
    background: 'linear-gradient(135deg, #7c3aed, #a855f7)',
    color: '#fff', border: 'none', borderRadius: 10,
    padding: '16px 40px', fontSize: 20, cursor: 'pointer', fontWeight: 800,
    boxShadow: '0 4px 20px rgba(124,58,237,0.4)',
  },
  spinner: { width: 32, height: 32, border: '3px solid #e5e7eb', borderTop: '3px solid #7c3aed', borderRadius: '50%', animation: 'spin 1s linear infinite', margin: '0 auto 16px' },
  bigSpinner: { width: 56, height: 56, border: '5px solid #e5e7eb', borderTop: '5px solid #7c3aed', borderRadius: '50%', animation: 'spin 0.8s linear infinite', margin: '0 auto 20px' },
  drawingText: { fontSize: 18, color: '#555', fontWeight: 600 },
  errorText: { color: '#ef4444', fontSize: 15, marginBottom: 16 },
  animWrapper: { display: 'flex', flexDirection: 'column', gap: 12 },
  drawnAt: { textAlign: 'center', fontSize: 12, color: '#9ca3af' },
  linkBtn: { background: '#3b82f6', color: '#fff', borderRadius: 6, padding: '10px 20px', fontSize: 14, textDecoration: 'none', display: 'inline-block' },
};
