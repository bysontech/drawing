import { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { api, ApiClientError, storage } from '../lib/api/client';
import type { LotterySettings } from '../types/lottery';
import type { CreateRoomResponse, Participant, RoomStatus } from '../types/room';

const POLL_INTERVAL_MS = 3000;

function getJoinUrl(joinCode: string): string {
  return `${window.location.origin}/join/${joinCode}`;
}

const DEFAULT_SETTINGS: LotterySettings = {
  ranked: false,
  winner_count: 1,
  roles: [],
  show_result_to_participants: false,
};

export default function HostRoomPage() {
  const [room, setRoom] = useState<CreateRoomResponse | null>(() => storage.loadHostSession());
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [roomStatus, setRoomStatus] = useState<RoomStatus>('waiting');
  const [participantCount, setParticipantCount] = useState(0);
  const [creating, setCreating] = useState(false);
  const [closing, setClosing] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Settings form state
  const [settings, setSettings] = useState<LotterySettings>(DEFAULT_SETTINGS);
  const [rolesInput, setRolesInput] = useState('');
  const [savingSettings, setSavingSettings] = useState(false);
  const [settingsSaved, setSettingsSaved] = useState(false);
  const [settingsError, setSettingsError] = useState<string | null>(null);

  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchParticipants = useCallback(async (roomId: string) => {
    try {
      const data = await api.getParticipants(roomId);
      setParticipants(data.participants);
      setParticipantCount(data.count);
      setRoomStatus(data.status);
    } catch {
      // ignore polling errors silently
    }
  }, []);

  useEffect(() => {
    if (!room) return;
    fetchParticipants(room.roomId);
    pollRef.current = setInterval(() => fetchParticipants(room.roomId), POLL_INTERVAL_MS);
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [room, fetchParticipants]);

  const handleCreateRoom = async () => {
    setCreating(true);
    setError(null);
    try {
      const result = await api.createRoom();
      storage.saveHostSession(result.roomId, result.joinCode, result.hostToken);
      setRoom(result);
      setParticipants([]);
      setParticipantCount(0);
      setRoomStatus('waiting');
      setSettings(DEFAULT_SETTINGS);
      setRolesInput('');
    } catch {
      setError('ルームの作成に失敗しました。もう一度お試しください。');
    } finally {
      setCreating(false);
    }
  };

  const handleCopyUrl = async () => {
    if (!room) return;
    try {
      await navigator.clipboard.writeText(getJoinUrl(room.joinCode));
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // ignore
    }
  };

  const handleSaveSettings = async () => {
    if (!room) return;
    setSavingSettings(true);
    setSettingsError(null);
    setSettingsSaved(false);

    const roles = rolesInput
      .split(',')
      .map((r) => r.trim())
      .filter(Boolean)
      .slice(0, 20);

    const payload: LotterySettings = { ...settings, roles };

    try {
      await api.updateRoomSettings(room.roomId, room.hostToken, payload);
      setSettings(payload);
      setSettingsSaved(true);
      setTimeout(() => setSettingsSaved(false), 2000);
    } catch (err) {
      if (err instanceof ApiClientError) {
        setSettingsError(err.message);
      } else {
        setSettingsError('設定の保存に失敗しました。');
      }
    } finally {
      setSavingSettings(false);
    }
  };

  const handleCloseRoom = async () => {
    if (!room) return;
    setClosing(true);
    setError(null);
    try {
      await api.closeRoom(room.roomId, room.hostToken);
      setRoomStatus('closed');
    } catch (err) {
      if (err instanceof ApiClientError) {
        if (err.code === 'VALIDATION_ERROR') {
          setError('参加者が1名以上必要です。');
        } else {
          setError(`締め切りに失敗しました: ${err.message}`);
        }
      } else {
        setError('締め切りに失敗しました。もう一度お試しください。');
      }
    } finally {
      setClosing(false);
    }
  };

  const handleReset = () => {
    storage.clearHostSession();
    setRoom(null);
    setParticipants([]);
    setParticipantCount(0);
    setRoomStatus('waiting');
    setSettings(DEFAULT_SETTINGS);
    setRolesInput('');
  };

  if (!room) {
    return (
      <div style={styles.container}>
        <h1 style={styles.title}>パーティーくじ引き</h1>
        <p style={styles.subtitle}>主催者として新しいルームを作成してください。</p>
        {error && <p style={styles.errorText}>{error}</p>}
        <button style={styles.primaryButton} onClick={handleCreateRoom} disabled={creating}>
          {creating ? 'ルームを作成中...' : 'ルームを作成する'}
        </button>
      </div>
    );
  }

  const joinUrl = getJoinUrl(room.joinCode);

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <h1 style={styles.title}>パーティーくじ引き — 主催者画面</h1>
        <span style={{ ...styles.statusBadge, ...(roomStatus !== 'waiting' ? styles.statusBadgeClosed : {}) }}>
          {roomStatus === 'waiting' ? '受付中' : roomStatus === 'closed' ? '受付終了' : '抽選済み'}
        </span>
      </div>

      {/* Join URL */}
      <section style={styles.section}>
        <h2 style={styles.sectionTitle}>参加用URL</h2>
        <div style={styles.urlBox}>
          <span style={styles.urlText}>{joinUrl}</span>
          <button style={styles.copyButton} onClick={handleCopyUrl}>
            {copied ? 'コピー済み!' : 'URLをコピー'}
          </button>
        </div>
        <p style={styles.codeLabel}>
          参加コード: <strong>{room.joinCode}</strong>
        </p>
      </section>

      {/* Settings */}
      <section style={styles.section}>
        <h2 style={styles.sectionTitle}>抽選設定</h2>
        <div style={styles.formRow}>
          <label style={styles.checkLabel}>
            <input
              type="checkbox"
              checked={settings.ranked}
              onChange={(e) => setSettings((s) => ({ ...s, ranked: e.target.checked }))}
              disabled={roomStatus === 'drawn'}
            />
            {' '}順位あり
          </label>
        </div>
        <div style={styles.formRow}>
          <label style={styles.fieldLabel}>当選人数</label>
          <input
            type="number"
            min={1}
            value={settings.winner_count}
            onChange={(e) => setSettings((s) => ({ ...s, winner_count: Math.max(1, Number(e.target.value)) }))}
            style={styles.numberInput}
            disabled={roomStatus === 'drawn'}
          />
        </div>
        <div style={styles.formRow}>
          <label style={styles.fieldLabel}>役割（カンマ区切り）</label>
          <input
            type="text"
            value={rolesInput}
            onChange={(e) => setRolesInput(e.target.value)}
            placeholder="例: 司会, 幹事, 会計"
            style={styles.textInput}
            disabled={roomStatus === 'drawn'}
          />
        </div>
        <div style={styles.formRow}>
          <label style={styles.checkLabel}>
            <input
              type="checkbox"
              checked={settings.show_result_to_participants}
              onChange={(e) =>
                setSettings((s) => ({ ...s, show_result_to_participants: e.target.checked }))
              }
              disabled={roomStatus === 'drawn'}
            />
            {' '}参加者に結果を公開する
          </label>
        </div>
        {settingsError && <p style={styles.errorText}>{settingsError}</p>}
        <button
          style={{ ...styles.secondaryButton, opacity: roomStatus === 'drawn' ? 0.5 : 1 }}
          onClick={handleSaveSettings}
          disabled={savingSettings || roomStatus === 'drawn'}
        >
          {savingSettings ? '保存中...' : settingsSaved ? '保存しました!' : '設定を保存'}
        </button>
      </section>

      {/* Participants */}
      <section style={styles.section}>
        <div style={styles.participantHeader}>
          <h2 style={styles.sectionTitle}>参加者一覧</h2>
          <span style={styles.countBadge}>{participantCount} 名</span>
        </div>
        {participants.length === 0 ? (
          <p style={styles.emptyText}>まだ参加者はいません。URLを共有してください。</p>
        ) : (
          <ul style={styles.participantList}>
            {participants.map((p) => (
              <li key={p.id} style={styles.participantItem}>
                <span>{p.nickname}</span>
                <span style={styles.joinedAt}>
                  {new Date(p.joined_at).toLocaleTimeString('ja-JP')}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      {error && <p style={styles.errorText}>{error}</p>}

      {/* Actions */}
      <div style={styles.actionRow}>
        {roomStatus === 'waiting' && (
          <button
            style={{ ...styles.dangerButton, opacity: closing ? 0.5 : 1 }}
            onClick={handleCloseRoom}
            disabled={closing}
          >
            {closing ? '処理中...' : '参加を締め切る'}
          </button>
        )}

        {(roomStatus === 'closed' || roomStatus === 'drawn') && (
          <Link to={`/room/${room.roomId}/draw`} style={styles.drawLink}>
            {roomStatus === 'drawn' ? '抽選結果を見る' : 'くじ引きを開始する →'}
          </Link>
        )}

        <button style={styles.secondaryButton} onClick={handleReset}>
          新しいルームを作る
        </button>
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: { maxWidth: 600, margin: '0 auto', padding: '24px 16px', fontFamily: 'system-ui, sans-serif' },
  header: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16, flexWrap: 'wrap', gap: 8 },
  title: { fontSize: 22, fontWeight: 700, margin: 0 },
  subtitle: { color: '#555', marginBottom: 24 },
  statusBadge: { background: '#22c55e', color: '#fff', borderRadius: 12, padding: '3px 12px', fontSize: 13, fontWeight: 600 },
  statusBadgeClosed: { background: '#f97316' },
  section: { marginBottom: 20, padding: 16, border: '1px solid #e0e0e0', borderRadius: 8, background: '#fafafa' },
  sectionTitle: { fontSize: 15, fontWeight: 600, marginBottom: 12, marginTop: 0 },
  urlBox: { display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  urlText: { fontFamily: 'monospace', fontSize: 13, background: '#fff', border: '1px solid #ccc', borderRadius: 4, padding: '6px 10px', wordBreak: 'break-all', flex: 1 },
  codeLabel: { marginTop: 8, fontSize: 14, color: '#333' },
  formRow: { marginBottom: 10 },
  checkLabel: { fontSize: 14, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 },
  fieldLabel: { display: 'block', fontSize: 13, color: '#555', marginBottom: 4 },
  numberInput: { width: 80, padding: '6px 8px', fontSize: 14, border: '1px solid #ccc', borderRadius: 4 },
  textInput: { width: '100%', padding: '6px 8px', fontSize: 14, border: '1px solid #ccc', borderRadius: 4, boxSizing: 'border-box' },
  participantHeader: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  countBadge: { background: '#3b82f6', color: '#fff', borderRadius: 12, padding: '2px 10px', fontSize: 13, fontWeight: 600 },
  emptyText: { color: '#888', fontSize: 14, margin: 0 },
  participantList: { listStyle: 'none', padding: 0, margin: 0 },
  participantItem: { display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid #eee', fontSize: 14 },
  joinedAt: { color: '#888', fontSize: 12 },
  actionRow: { display: 'flex', gap: 12, flexWrap: 'wrap', marginTop: 8 },
  primaryButton: { background: '#3b82f6', color: '#fff', border: 'none', borderRadius: 6, padding: '10px 20px', fontSize: 15, cursor: 'pointer', fontWeight: 600 },
  secondaryButton: { background: '#fff', color: '#333', border: '1px solid #ccc', borderRadius: 6, padding: '10px 20px', fontSize: 14, cursor: 'pointer' },
  copyButton: { background: '#10b981', color: '#fff', border: 'none', borderRadius: 6, padding: '6px 14px', fontSize: 13, cursor: 'pointer', whiteSpace: 'nowrap' },
  dangerButton: { background: '#ef4444', color: '#fff', border: 'none', borderRadius: 6, padding: '10px 20px', fontSize: 14, fontWeight: 600, cursor: 'pointer' },
  drawLink: { background: '#7c3aed', color: '#fff', border: 'none', borderRadius: 6, padding: '10px 20px', fontSize: 14, fontWeight: 600, cursor: 'pointer', textDecoration: 'none', display: 'inline-block' },
  errorText: { color: '#ef4444', fontSize: 14, marginBottom: 12 },
};
