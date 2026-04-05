import { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { QRCodeSVG } from 'qrcode.react';
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

const STATUS_LABELS: Record<RoomStatus, string> = {
  waiting: '参加受付中',
  closed: '受付終了・抽選待ち',
  drawn: '抽選完了',
};

const STATUS_COLORS: Record<RoomStatus, string> = {
  waiting: '#22c55e',
  closed: '#f97316',
  drawn: '#7c3aed',
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
      // ignore silently
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
      setRolesInput(roles.join(', '));
      setSettingsSaved(true);
      setTimeout(() => setSettingsSaved(false), 2500);
    } catch (err) {
      if (err instanceof ApiClientError) {
        if (err.code === 'VALIDATION_ERROR') {
          setSettingsError(err.message);
        } else {
          setSettingsError('設定の保存に失敗しました。');
        }
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
  const settingsLocked = roomStatus === 'drawn';

  return (
    <div style={styles.container}>
      {/* Header */}
      <div style={styles.header}>
        <h1 style={styles.title}>パーティーくじ引き</h1>
        <span style={{ ...styles.statusBadge, background: STATUS_COLORS[roomStatus] }}>
          {STATUS_LABELS[roomStatus]}
        </span>
      </div>

      {/* Join URL + QR */}
      <section style={styles.section}>
        <h2 style={styles.sectionTitle}>参加用URL</h2>
        <div style={styles.urlRow}>
          <div style={styles.urlBox}>
            <span style={styles.urlText}>{joinUrl}</span>
            <button style={styles.copyButton} onClick={handleCopyUrl}>
              {copied ? '✓ コピー済み' : 'URLをコピー'}
            </button>
          </div>
          <div style={styles.qrBox}>
            <QRCodeSVG value={joinUrl} size={96} />
          </div>
        </div>
        <p style={styles.codeLabel}>
          参加コード: <strong style={styles.joinCode}>{room.joinCode}</strong>
        </p>
      </section>

      {/* Settings */}
      <section style={styles.section}>
        <h2 style={styles.sectionTitle}>抽選設定</h2>
        {settingsLocked && (
          <p style={styles.lockedNote}>抽選済みのため設定は変更できません。</p>
        )}

        <div style={styles.formGrid}>
          <label style={styles.checkLabel}>
            <input
              type="checkbox"
              checked={settings.ranked}
              onChange={(e) => setSettings((s) => ({ ...s, ranked: e.target.checked }))}
              disabled={settingsLocked}
            />
            <span>順位あり</span>
          </label>

          <div style={styles.inlineField}>
            <label style={styles.fieldLabel}>当選人数</label>
            <input
              type="number"
              min={1}
              value={settings.winner_count}
              onChange={(e) =>
                setSettings((s) => ({ ...s, winner_count: Math.max(1, Number(e.target.value)) }))
              }
              style={styles.numberInput}
              disabled={settingsLocked}
            />
          </div>

          <div style={styles.fullField}>
            <label style={styles.fieldLabel}>
              役割（カンマ区切り）
              <span style={styles.fieldHint}> 例: 司会, 幹事, 会計</span>
            </label>
            <input
              type="text"
              value={rolesInput}
              onChange={(e) => setRolesInput(e.target.value)}
              placeholder="役割を入力..."
              style={styles.textInput}
              disabled={settingsLocked}
            />
          </div>

          <label style={styles.checkLabel}>
            <input
              type="checkbox"
              checked={settings.show_result_to_participants}
              onChange={(e) =>
                setSettings((s) => ({ ...s, show_result_to_participants: e.target.checked }))
              }
              disabled={settingsLocked}
            />
            <span>参加者に結果を公開する</span>
          </label>
        </div>

        {settingsError && <p style={styles.errorText}>{settingsError}</p>}

        {!settingsLocked && (
          <button
            style={settingsSaved ? styles.savedButton : styles.secondaryButton}
            onClick={handleSaveSettings}
            disabled={savingSettings}
          >
            {savingSettings ? '保存中...' : settingsSaved ? '✓ 保存しました' : '設定を保存'}
          </button>
        )}
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
            {roomStatus === 'drawn' ? '抽選結果を見る →' : 'くじ引きを開始する →'}
          </Link>
        )}

        <button style={styles.resetButton} onClick={handleReset}>
          新しいルームを作る
        </button>
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: { maxWidth: 620, margin: '0 auto', padding: '24px 16px', fontFamily: 'system-ui, sans-serif' },
  header: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20, flexWrap: 'wrap', gap: 8 },
  title: { fontSize: 22, fontWeight: 700, margin: 0 },
  subtitle: { color: '#555', marginBottom: 24 },
  statusBadge: { color: '#fff', borderRadius: 12, padding: '4px 14px', fontSize: 13, fontWeight: 600 },
  section: { marginBottom: 20, padding: 16, border: '1px solid #e5e7eb', borderRadius: 10, background: '#fafafa' },
  sectionTitle: { fontSize: 15, fontWeight: 600, marginBottom: 12, marginTop: 0 },
  urlRow: { display: 'flex', gap: 12, alignItems: 'flex-start', flexWrap: 'wrap' },
  urlBox: { flex: 1, display: 'flex', flexDirection: 'column', gap: 8, minWidth: 200 },
  urlText: { fontFamily: 'monospace', fontSize: 12, background: '#fff', border: '1px solid #d1d5db', borderRadius: 4, padding: '6px 10px', wordBreak: 'break-all' },
  qrBox: { flexShrink: 0, padding: 8, background: '#fff', border: '1px solid #e5e7eb', borderRadius: 6 },
  codeLabel: { marginTop: 10, fontSize: 14, color: '#333' },
  joinCode: { letterSpacing: 2, fontSize: 16 },
  lockedNote: { fontSize: 13, color: '#9ca3af', marginBottom: 12, background: '#f3f4f6', padding: '6px 10px', borderRadius: 4 },
  formGrid: { display: 'flex', flexDirection: 'column', gap: 12 },
  checkLabel: { fontSize: 14, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8 },
  inlineField: { display: 'flex', alignItems: 'center', gap: 10 },
  fullField: { display: 'flex', flexDirection: 'column', gap: 4 },
  fieldLabel: { fontSize: 13, fontWeight: 500, color: '#374151' },
  fieldHint: { fontSize: 12, color: '#9ca3af', fontWeight: 400 },
  numberInput: { width: 72, padding: '6px 8px', fontSize: 14, border: '1px solid #d1d5db', borderRadius: 4 },
  textInput: { padding: '7px 10px', fontSize: 14, border: '1px solid #d1d5db', borderRadius: 4 },
  participantHeader: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  countBadge: { background: '#3b82f6', color: '#fff', borderRadius: 12, padding: '2px 10px', fontSize: 13, fontWeight: 600 },
  emptyText: { color: '#9ca3af', fontSize: 14, margin: 0 },
  participantList: { listStyle: 'none', padding: 0, margin: 0 },
  participantItem: { display: 'flex', justifyContent: 'space-between', padding: '7px 0', borderBottom: '1px solid #f3f4f6', fontSize: 14 },
  joinedAt: { color: '#9ca3af', fontSize: 12 },
  actionRow: { display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 4 },
  primaryButton: { background: '#3b82f6', color: '#fff', border: 'none', borderRadius: 6, padding: '11px 22px', fontSize: 15, cursor: 'pointer', fontWeight: 600 },
  secondaryButton: { background: '#fff', color: '#374151', border: '1px solid #d1d5db', borderRadius: 6, padding: '8px 18px', fontSize: 14, cursor: 'pointer' },
  savedButton: { background: '#dcfce7', color: '#166534', border: '1px solid #86efac', borderRadius: 6, padding: '8px 18px', fontSize: 14, cursor: 'default' },
  copyButton: { background: '#10b981', color: '#fff', border: 'none', borderRadius: 5, padding: '6px 14px', fontSize: 13, cursor: 'pointer', alignSelf: 'flex-start' },
  dangerButton: { background: '#ef4444', color: '#fff', border: 'none', borderRadius: 6, padding: '10px 20px', fontSize: 14, fontWeight: 600, cursor: 'pointer' },
  drawLink: { background: '#7c3aed', color: '#fff', borderRadius: 6, padding: '10px 20px', fontSize: 14, fontWeight: 600, textDecoration: 'none', display: 'inline-flex', alignItems: 'center' },
  resetButton: { background: '#fff', color: '#6b7280', border: '1px solid #e5e7eb', borderRadius: 6, padding: '10px 18px', fontSize: 13, cursor: 'pointer' },
  errorText: { color: '#ef4444', fontSize: 13, marginBottom: 10 },
};
