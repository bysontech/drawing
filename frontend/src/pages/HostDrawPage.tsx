import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import DrawReveal from '../components/DrawReveal';
import { api, ApiClientError, storage } from '../lib/api/client';
import type { ResultViewItem } from '../types/resultView';
import { presentationMode, toResultViewItems } from '../utils/resultViewModel';

type PageState = 'loading' | 'idle' | 'drawing' | 'revealing' | 'done' | 'error' | 'no_auth';

const ERROR_MESSAGES: Record<string, string> = {
  ALREADY_DRAWN: '抽選は既に完了しています。',
  DRAW_NOT_ALLOWED: '参加を締め切ってから抽選してください。',
  FORBIDDEN: '操作権限がありません。',
  VALIDATION_ERROR: '入力内容を確認してください。',
  SERVER_ERROR: 'サーバーエラーが発生しました。',
};

export default function HostDrawPage() {
  const { roomId } = useParams<{ roomId: string }>();
  const session = storage.loadHostSession();
  const hostToken = session?.hostToken ?? '';

  const [pageState, setPageState] = useState<PageState>(() =>
    !session || session.roomId !== roomId ? 'no_auth' : 'loading'
  );

  const [items, setItems] = useState<ResultViewItem[]>([]);
  const [drawnAt, setDrawnAt] = useState('');
  const [ranked, setRanked] = useState(false);
  const [animate, setAnimate] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  // On mount: check for existing result
  useEffect(() => {
    if (pageState === 'no_auth' || !roomId) return;

    api
      .getRoomResult(roomId, hostToken)
      .then((data) => {
        const viewItems = toResultViewItems(data.results, '', '');
        setItems(viewItems);
        setDrawnAt(data.drawnAt);
        setRanked(presentationMode(viewItems) === 'ranked');
        setAnimate(false); // reload → skip animation
        setPageState('done');
      })
      .catch((err: unknown) => {
        if (err instanceof ApiClientError && err.status === 404) {
          setPageState('idle');
        } else {
          setPageState('idle');
        }
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleDraw = async () => {
    if (!roomId) return;
    setPageState('drawing');
    setErrorMsg('');

    try {
      const data = await api.drawLottery(roomId, hostToken);
      const viewItems = toResultViewItems(data.results, '', '');
      setItems(viewItems);
      setDrawnAt(data.drawnAt);
      setRanked(presentationMode(viewItems) === 'ranked');
      setAnimate(true); // fresh draw → animate
      setPageState('revealing');
    } catch (err) {
      if (err instanceof ApiClientError) {
        if (err.code === 'ALREADY_DRAWN') {
          // Fetch and show existing
          try {
            const existing = await api.getRoomResult(roomId, hostToken);
            const viewItems = toResultViewItems(existing.results, '', '');
            setItems(viewItems);
            setDrawnAt(existing.drawnAt);
            setRanked(presentationMode(viewItems) === 'ranked');
            setAnimate(false);
            setPageState('done');
            return;
          } catch {
            // fall through
          }
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
      <div style={styles.container}>
        <h1 style={styles.title}>アクセスできません</h1>
        <p style={styles.subtitle}>主催者情報が見つかりません。ルームを作成してから操作してください。</p>
        <Link to="/" style={styles.linkButton}>トップに戻る</Link>
      </div>
    );
  }

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <Link to="/" style={styles.backLink}>← 主催者画面に戻る</Link>
        <h1 style={styles.title}>くじ引き</h1>
      </div>

      {pageState === 'loading' && (
        <div style={styles.centerBox}>
          <div style={styles.spinner} />
          <p style={styles.subtleText}>読み込み中...</p>
        </div>
      )}

      {pageState === 'idle' && (
        <div style={styles.centerBox}>
          <p style={styles.subtitle}>準備ができたら抽選開始ボタンを押してください。</p>
          <button style={styles.drawButton} onClick={handleDraw}>
            🎉 抽選開始！
          </button>
        </div>
      )}

      {pageState === 'drawing' && (
        <div style={styles.centerBox}>
          <div style={styles.bigSpinner} />
          <p style={styles.drawingText}>抽選中...</p>
        </div>
      )}

      {pageState === 'error' && (
        <div style={styles.centerBox}>
          <p style={styles.errorText}>{errorMsg}</p>
          <button style={styles.drawButton} onClick={handleDraw}>もう一度試す</button>
        </div>
      )}

      {(pageState === 'revealing' || pageState === 'done') && (
        <div>
          <div style={styles.doneHeader}>
            <span style={styles.doneIcon}>🎊</span>
            <h2 style={styles.doneTitle}>抽選結果</h2>
            {drawnAt && (
              <p style={styles.drawnAt}>{new Date(drawnAt).toLocaleString('ja-JP')}</p>
            )}
          </div>

          <DrawReveal
            items={items}
            ranked={ranked}
            animate={animate}
            onComplete={() => setPageState('done')}
          />

          {pageState === 'done' && (
            <p style={styles.drawnNotice}>
              抽選は完了しています。再実行はできません。
            </p>
          )}
        </div>
      )}
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: { maxWidth: 560, margin: '0 auto', padding: '24px 16px', fontFamily: 'system-ui, sans-serif' },
  header: { marginBottom: 24 },
  backLink: { fontSize: 13, color: '#3b82f6', textDecoration: 'none' },
  title: { fontSize: 24, fontWeight: 700, marginTop: 8, marginBottom: 0 },
  subtitle: { color: '#555', marginBottom: 24 },
  subtleText: { color: '#888', fontSize: 14 },
  centerBox: { textAlign: 'center', padding: '48px 0' },
  drawButton: {
    background: '#7c3aed', color: '#fff', border: 'none',
    borderRadius: 8, padding: '14px 36px', fontSize: 18,
    cursor: 'pointer', fontWeight: 700,
  },
  spinner: {
    width: 32, height: 32, border: '3px solid #e0e0e0',
    borderTop: '3px solid #7c3aed', borderRadius: '50%',
    animation: 'spin 1s linear infinite', margin: '0 auto 16px',
  },
  bigSpinner: {
    width: 56, height: 56, border: '5px solid #e0e0e0',
    borderTop: '5px solid #7c3aed', borderRadius: '50%',
    animation: 'spin 0.8s linear infinite', margin: '0 auto 20px',
  },
  drawingText: { fontSize: 20, color: '#555', fontWeight: 600 },
  errorText: { color: '#ef4444', fontSize: 15, marginBottom: 16 },
  doneHeader: { textAlign: 'center', marginBottom: 24 },
  doneIcon: { fontSize: 48, display: 'block' },
  doneTitle: { fontSize: 22, fontWeight: 700, marginTop: 8, marginBottom: 4 },
  drawnAt: { fontSize: 12, color: '#888', margin: 0 },
  drawnNotice: {
    marginTop: 20, textAlign: 'center', fontSize: 13,
    color: '#9ca3af', background: '#f9fafb',
    border: '1px solid #e5e7eb', borderRadius: 6, padding: '10px 16px',
  },
  linkButton: {
    background: '#3b82f6', color: '#fff', borderRadius: 6,
    padding: '10px 20px', fontSize: 14, textDecoration: 'none', display: 'inline-block',
  },
};
