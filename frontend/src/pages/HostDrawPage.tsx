import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api, ApiClientError, storage } from '../lib/api/client';
import type { LotteryResultItem } from '../types/lottery';

type PageState = 'idle' | 'drawing' | 'done' | 'error' | 'no_auth';

export default function HostDrawPage() {
  const { roomId } = useParams<{ roomId: string }>();
  const session = storage.loadHostSession();
  const hostToken = session?.hostToken ?? '';

  const [pageState, setPageState] = useState<PageState>(() => {
    if (!session || session.roomId !== roomId) return 'no_auth';
    return 'idle';
  });

  const [results, setResults] = useState<LotteryResultItem[]>([]);
  const [drawnAt, setDrawnAt] = useState('');
  const [ranked, setRanked] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  // On mount: check if already drawn
  useEffect(() => {
    if (pageState === 'no_auth' || !roomId) return;

    api.getRoomResult(roomId, hostToken)
      .then((data) => {
        setResults(data.results);
        setDrawnAt(data.drawnAt);
        setRanked(data.results.some((r) => r.rank !== null));
        setPageState('done');
      })
      .catch((err: unknown) => {
        // 404 = not drawn yet, stay idle
        if (err instanceof ApiClientError && err.status === 404) return;
        // other errors silently ignored — user can still trigger draw
      });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleDraw = async () => {
    if (!roomId) return;
    setPageState('drawing');
    setErrorMsg('');

    // Brief fake loading for UX
    await new Promise((r) => setTimeout(r, 1500));

    try {
      const data = await api.drawLottery(roomId, hostToken);
      setResults(data.results);
      setDrawnAt(data.drawnAt);
      setRanked(data.results.some((r) => r.rank !== null));
      setPageState('done');
    } catch (err) {
      if (err instanceof ApiClientError) {
        if (err.code === 'ALREADY_DRAWN') {
          // fetch existing result
          try {
            const existing = await api.getRoomResult(roomId, hostToken);
            setResults(existing.results);
            setDrawnAt(existing.drawnAt);
            setRanked(existing.results.some((r) => r.rank !== null));
            setPageState('done');
            return;
          } catch {
            // fall through to error
          }
        }
        if (err.code === 'DRAW_NOT_ALLOWED') {
          setErrorMsg('抽選は参加締め切り後にのみ実行できます。');
        } else {
          setErrorMsg(err.message);
        }
      } else {
        setErrorMsg('抽選に失敗しました。もう一度お試しください。');
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
          <div style={styles.spinner} />
          <p style={styles.drawingText}>抽選中...</p>
        </div>
      )}

      {pageState === 'error' && (
        <div style={styles.centerBox}>
          <p style={styles.errorText}>{errorMsg}</p>
          <button style={styles.drawButton} onClick={handleDraw}>もう一度試す</button>
        </div>
      )}

      {pageState === 'done' && (
        <div>
          <div style={styles.doneHeader}>
            <span style={styles.doneIcon}>🎊</span>
            <h2 style={styles.doneTitle}>抽選結果</h2>
            {drawnAt && (
              <p style={styles.drawnAt}>
                {new Date(drawnAt).toLocaleString('ja-JP')}
              </p>
            )}
          </div>

          <ul style={styles.resultList}>
            {results.map((item, idx) => (
              <li key={item.participant_id} style={styles.resultItem}>
                <div style={styles.resultRankBox}>
                  {ranked && item.rank !== null ? (
                    <span style={{ ...styles.rankBadge, ...(item.rank === 1 ? styles.rank1 : item.rank === 2 ? styles.rank2 : item.rank === 3 ? styles.rank3 : {}) }}>
                      {item.rank}位
                    </span>
                  ) : (
                    <span style={styles.rankBadge}>{idx + 1}</span>
                  )}
                </div>
                <div style={styles.resultInfo}>
                  <span style={styles.resultNickname}>{item.nickname}</span>
                  {item.role && <span style={styles.resultRole}>{item.role}</span>}
                </div>
              </li>
            ))}
          </ul>
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
  centerBox: { textAlign: 'center', padding: '40px 0' },
  drawButton: { background: '#7c3aed', color: '#fff', border: 'none', borderRadius: 8, padding: '14px 32px', fontSize: 18, cursor: 'pointer', fontWeight: 700 },
  spinner: { width: 48, height: 48, border: '4px solid #e0e0e0', borderTop: '4px solid #7c3aed', borderRadius: '50%', animation: 'spin 1s linear infinite', margin: '0 auto 16px' },
  drawingText: { fontSize: 18, color: '#555', fontWeight: 600 },
  errorText: { color: '#ef4444', fontSize: 15, marginBottom: 16 },
  doneHeader: { textAlign: 'center', marginBottom: 24 },
  doneIcon: { fontSize: 48, display: 'block' },
  doneTitle: { fontSize: 22, fontWeight: 700, marginTop: 8, marginBottom: 4 },
  drawnAt: { fontSize: 12, color: '#888', margin: 0 },
  resultList: { listStyle: 'none', padding: 0, margin: 0 },
  resultItem: { display: 'flex', alignItems: 'center', gap: 16, padding: '12px 0', borderBottom: '1px solid #eee' },
  resultRankBox: { width: 48, flexShrink: 0, textAlign: 'center' },
  rankBadge: { display: 'inline-block', background: '#e0e7ff', color: '#3730a3', borderRadius: 20, padding: '4px 10px', fontSize: 13, fontWeight: 700 },
  rank1: { background: '#fef08a', color: '#92400e' },
  rank2: { background: '#d1d5db', color: '#374151' },
  rank3: { background: '#fed7aa', color: '#92400e' },
  resultInfo: { display: 'flex', flexDirection: 'column', gap: 2 },
  resultNickname: { fontSize: 16, fontWeight: 600 },
  resultRole: { fontSize: 13, color: '#6b7280', background: '#f3f4f6', borderRadius: 4, padding: '1px 6px', display: 'inline-block' },
  linkButton: { background: '#3b82f6', color: '#fff', borderRadius: 6, padding: '10px 20px', fontSize: 14, textDecoration: 'none', display: 'inline-block' },
};
