import { useCallback, useEffect, useRef, useState } from 'react';
import { api, ApiClientError } from '../lib/api/client';
import type { CreateRoomResponse, Participant, RoomStatus } from '../types/room';

const HOST_TOKEN_KEY = 'party_lottery_host_token';
const ROOM_ID_KEY = 'party_lottery_room_id';
const JOIN_CODE_KEY = 'party_lottery_join_code';
const POLL_INTERVAL_MS = 3000;

function getJoinUrl(joinCode: string): string {
  return `${window.location.origin}/join/${joinCode}`;
}

export default function HostRoomPage() {
  const [room, setRoom] = useState<CreateRoomResponse | null>(() => {
    const roomId = localStorage.getItem(ROOM_ID_KEY);
    const joinCode = localStorage.getItem(JOIN_CODE_KEY);
    const hostToken = localStorage.getItem(HOST_TOKEN_KEY);
    if (roomId && joinCode && hostToken) {
      return { roomId, joinCode, hostToken };
    }
    return null;
  });

  const [participants, setParticipants] = useState<Participant[]>([]);
  const [roomStatus, setRoomStatus] = useState<RoomStatus>('waiting');
  const [participantCount, setParticipantCount] = useState(0);
  const [creating, setCreating] = useState(false);
  const [closing, setClosing] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);
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

    pollRef.current = setInterval(() => {
      fetchParticipants(room.roomId);
    }, POLL_INTERVAL_MS);

    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [room, fetchParticipants]);

  const handleCreateRoom = async () => {
    setCreating(true);
    setError(null);
    try {
      const result = await api.createRoom();
      localStorage.setItem(HOST_TOKEN_KEY, result.hostToken);
      localStorage.setItem(ROOM_ID_KEY, result.roomId);
      localStorage.setItem(JOIN_CODE_KEY, result.joinCode);
      setRoom(result);
      setParticipants([]);
      setParticipantCount(0);
      setRoomStatus('waiting');
    } catch (err) {
      setError('ルームの作成に失敗しました。もう一度お試しください。');
      console.error(err);
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
      // fallback: select text
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
        setError(`締め切りに失敗しました: ${err.message}`);
      } else {
        setError('締め切りに失敗しました。もう一度お試しください。');
      }
    } finally {
      setClosing(false);
    }
  };

  const handleReset = () => {
    localStorage.removeItem(HOST_TOKEN_KEY);
    localStorage.removeItem(ROOM_ID_KEY);
    localStorage.removeItem(JOIN_CODE_KEY);
    setRoom(null);
    setParticipants([]);
    setParticipantCount(0);
    setRoomStatus('waiting');
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
      <h1 style={styles.title}>パーティーくじ引き — 主催者画面</h1>

      {roomStatus === 'closed' && (
        <div style={styles.closedBanner}>受付終了済み</div>
      )}

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

      <div style={styles.actionRow}>
        <button
          style={{
            ...styles.dangerButton,
            opacity: roomStatus !== 'waiting' || closing ? 0.5 : 1,
            cursor: roomStatus !== 'waiting' || closing ? 'not-allowed' : 'pointer',
          }}
          onClick={handleCloseRoom}
          disabled={roomStatus !== 'waiting' || closing}
        >
          {closing ? '処理中...' : '参加を締め切る'}
        </button>

        <button style={styles.secondaryButton} onClick={handleReset}>
          新しいルームを作る
        </button>
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    maxWidth: 600,
    margin: '0 auto',
    padding: '24px 16px',
    fontFamily: 'system-ui, sans-serif',
  },
  title: {
    fontSize: 24,
    fontWeight: 700,
    marginBottom: 8,
  },
  subtitle: {
    color: '#555',
    marginBottom: 24,
  },
  section: {
    marginBottom: 24,
    padding: 16,
    border: '1px solid #e0e0e0',
    borderRadius: 8,
    background: '#fafafa',
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: 600,
    marginBottom: 12,
    marginTop: 0,
  },
  urlBox: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
  },
  urlText: {
    fontFamily: 'monospace',
    fontSize: 13,
    background: '#fff',
    border: '1px solid #ccc',
    borderRadius: 4,
    padding: '6px 10px',
    wordBreak: 'break-all',
    flex: 1,
  },
  codeLabel: {
    marginTop: 8,
    fontSize: 14,
    color: '#333',
  },
  participantHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  countBadge: {
    background: '#3b82f6',
    color: '#fff',
    borderRadius: 12,
    padding: '2px 10px',
    fontSize: 13,
    fontWeight: 600,
  },
  emptyText: {
    color: '#888',
    fontSize: 14,
    margin: 0,
  },
  participantList: {
    listStyle: 'none',
    padding: 0,
    margin: 0,
  },
  participantItem: {
    display: 'flex',
    justifyContent: 'space-between',
    padding: '6px 0',
    borderBottom: '1px solid #eee',
    fontSize: 14,
  },
  joinedAt: {
    color: '#888',
    fontSize: 12,
  },
  closedBanner: {
    background: '#f97316',
    color: '#fff',
    padding: '8px 16px',
    borderRadius: 6,
    marginBottom: 16,
    fontWeight: 600,
    textAlign: 'center',
  },
  actionRow: {
    display: 'flex',
    gap: 12,
    flexWrap: 'wrap',
    marginTop: 8,
  },
  primaryButton: {
    background: '#3b82f6',
    color: '#fff',
    border: 'none',
    borderRadius: 6,
    padding: '10px 20px',
    fontSize: 15,
    cursor: 'pointer',
    fontWeight: 600,
  },
  secondaryButton: {
    background: '#fff',
    color: '#333',
    border: '1px solid #ccc',
    borderRadius: 6,
    padding: '10px 20px',
    fontSize: 14,
    cursor: 'pointer',
  },
  copyButton: {
    background: '#10b981',
    color: '#fff',
    border: 'none',
    borderRadius: 6,
    padding: '6px 14px',
    fontSize: 13,
    cursor: 'pointer',
    whiteSpace: 'nowrap',
  },
  dangerButton: {
    background: '#ef4444',
    color: '#fff',
    border: 'none',
    borderRadius: 6,
    padding: '10px 20px',
    fontSize: 14,
    fontWeight: 600,
  },
  errorText: {
    color: '#ef4444',
    fontSize: 14,
    marginBottom: 12,
  },
};
