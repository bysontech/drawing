import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { api, ApiClientError } from '../lib/api/client';
import type { Room } from '../types/room';

const PARTICIPANT_TOKEN_KEY = 'party_lottery_participant_token';
const PARTICIPANT_NICKNAME_KEY = 'party_lottery_participant_nickname';

export default function JoinPage() {
  const { joinCode } = useParams<{ joinCode: string }>();
  const navigate = useNavigate();

  const [room, setRoom] = useState<Room | null>(null);
  const [loadingRoom, setLoadingRoom] = useState(true);
  const [roomError, setRoomError] = useState<string | null>(null);

  const [nickname, setNickname] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [fieldError, setFieldError] = useState<string | null>(null);

  useEffect(() => {
    if (!joinCode) return;

    const fetchRoom = async () => {
      setLoadingRoom(true);
      try {
        const data = await api.getRoomByJoinCode(joinCode);
        setRoom(data);
      } catch (err) {
        if (err instanceof ApiClientError && err.status === 404) {
          setRoomError('ルームが見つかりません。URLを確認してください。');
        } else {
          setRoomError('ルームの読み込みに失敗しました。');
        }
      } finally {
        setLoadingRoom(false);
      }
    };

    fetchRoom();
  }, [joinCode]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!room) return;

    const trimmed = nickname.trim();
    if (!trimmed) {
      setFieldError('ニックネームを入力してください。');
      return;
    }
    if (trimmed.length > 20) {
      setFieldError('ニックネームは20文字以内にしてください。');
      return;
    }

    setFieldError(null);
    setSubmitting(true);

    try {
      const result = await api.joinRoom(room.roomId, trimmed);
      localStorage.setItem(PARTICIPANT_TOKEN_KEY, result.participantToken);
      localStorage.setItem(PARTICIPANT_NICKNAME_KEY, trimmed);
      navigate(`/room/${result.roomId}/participant`);
    } catch (err) {
      if (err instanceof ApiClientError) {
        if (err.code === 'NICKNAME_TAKEN') {
          setFieldError('そのニックネームはすでに使われています。');
        } else if (err.code === 'ROOM_CLOSED') {
          setFieldError('このルームの受付は終了しています。');
        } else if (err.code === 'VALIDATION_ERROR') {
          setFieldError('入力内容を確認してください。');
        } else {
          setFieldError('参加に失敗しました。もう一度お試しください。');
        }
      } else {
        setFieldError('参加に失敗しました。もう一度お試しください。');
      }
    } finally {
      setSubmitting(false);
    }
  };

  if (loadingRoom) {
    return <div style={styles.container}><p>読み込み中...</p></div>;
  }

  if (roomError) {
    return (
      <div style={styles.container}>
        <h1 style={styles.title}>参加できません</h1>
        <p style={styles.errorText}>{roomError}</p>
      </div>
    );
  }

  if (!room) return null;

  if (room.status === 'closed' || room.status === 'drawn') {
    return (
      <div style={styles.container}>
        <h1 style={styles.title}>受付終了</h1>
        <p style={styles.subtitle}>このルームの参加受付は終了しています。</p>
      </div>
    );
  }

  return (
    <div style={styles.container}>
      <h1 style={styles.title}>パーティーくじ引きに参加する</h1>
      <p style={styles.subtitle}>ニックネームを入力して参加ボタンを押してください。</p>

      <form onSubmit={handleSubmit} style={styles.form}>
        <label style={styles.label} htmlFor="nickname">
          ニックネーム
        </label>
        <input
          id="nickname"
          type="text"
          value={nickname}
          onChange={(e) => setNickname(e.target.value)}
          maxLength={20}
          placeholder="例: たろう"
          style={styles.input}
          disabled={submitting}
          autoFocus
        />
        {fieldError && <p style={styles.errorText}>{fieldError}</p>}
        <button type="submit" style={styles.primaryButton} disabled={submitting}>
          {submitting ? '参加中...' : '参加する'}
        </button>
      </form>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    maxWidth: 480,
    margin: '0 auto',
    padding: '40px 16px',
    fontFamily: 'system-ui, sans-serif',
  },
  title: {
    fontSize: 22,
    fontWeight: 700,
    marginBottom: 8,
  },
  subtitle: {
    color: '#555',
    marginBottom: 24,
  },
  form: {
    display: 'flex',
    flexDirection: 'column',
    gap: 12,
  },
  label: {
    fontSize: 14,
    fontWeight: 600,
    color: '#333',
  },
  input: {
    padding: '10px 12px',
    fontSize: 16,
    border: '1px solid #ccc',
    borderRadius: 6,
    outline: 'none',
  },
  primaryButton: {
    background: '#3b82f6',
    color: '#fff',
    border: 'none',
    borderRadius: 6,
    padding: '12px 20px',
    fontSize: 15,
    cursor: 'pointer',
    fontWeight: 600,
    marginTop: 4,
  },
  errorText: {
    color: '#ef4444',
    fontSize: 14,
    margin: 0,
  },
};
