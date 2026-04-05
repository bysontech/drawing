import type { DrawResponse, LotteryResult, LotterySettings } from '../../types/lottery';
import type {
  CreateRoomResponse,
  JoinRoomResponse,
  ParticipantsResponse,
  Room,
} from '../../types/room';

const BASE_URL = import.meta.env.VITE_API_BASE_URL ?? '/api';

export class ApiClientError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string
  ) {
    super(message);
    this.name = 'ApiClientError';
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(init?.headers ?? {}),
    },
  });

  if (!res.ok) {
    let code = 'SERVER_ERROR';
    let message = `HTTP ${res.status}`;
    try {
      const body = (await res.json()) as { code?: string; message?: string };
      code = body.code ?? code;
      message = body.message ?? message;
    } catch {
      // ignore parse errors
    }
    throw new ApiClientError(res.status, code, message);
  }

  return res.json() as Promise<T>;
}

export const api = {
  createRoom(): Promise<CreateRoomResponse> {
    return request<CreateRoomResponse>('/rooms', { method: 'POST' });
  },

  getRoomByJoinCode(joinCode: string): Promise<Room> {
    return request<Room>(`/rooms/join/${encodeURIComponent(joinCode)}`);
  },

  joinRoom(roomId: string, nickname: string): Promise<JoinRoomResponse> {
    return request<JoinRoomResponse>(`/rooms/${encodeURIComponent(roomId)}/join`, {
      method: 'POST',
      body: JSON.stringify({ nickname }),
    });
  },

  getParticipants(roomId: string): Promise<ParticipantsResponse> {
    return request<ParticipantsResponse>(`/rooms/${encodeURIComponent(roomId)}/participants`);
  },

  updateRoomSettings(
    roomId: string,
    hostToken: string,
    settings: LotterySettings
  ): Promise<unknown> {
    return request(`/rooms/${encodeURIComponent(roomId)}/settings`, {
      method: 'PATCH',
      headers: { 'X-Host-Token': hostToken },
      body: JSON.stringify(settings),
    });
  },

  closeRoom(roomId: string, hostToken: string): Promise<{ roomId: string; status: string }> {
    return request(`/rooms/${encodeURIComponent(roomId)}/close`, {
      method: 'POST',
      headers: { 'X-Host-Token': hostToken },
    });
  },

  drawLottery(roomId: string, hostToken: string): Promise<DrawResponse> {
    return request<DrawResponse>(`/rooms/${encodeURIComponent(roomId)}/draw`, {
      method: 'POST',
      headers: { 'X-Host-Token': hostToken },
    });
  },

  getRoomResult(roomId: string, hostToken?: string): Promise<LotteryResult> {
    const headers: Record<string, string> = {};
    if (hostToken) headers['X-Host-Token'] = hostToken;
    return request<LotteryResult>(`/rooms/${encodeURIComponent(roomId)}/result`, { headers });
  },
};

// ── localStorage helpers ──────────────────────────────

const KEYS = {
  hostToken: 'party_lottery_host_token',
  roomId: 'party_lottery_room_id',
  joinCode: 'party_lottery_join_code',
  participantToken: 'party_lottery_participant_token',
  participantNickname: 'party_lottery_participant_nickname',
} as const;

export const storage = {
  saveHostSession(roomId: string, joinCode: string, hostToken: string) {
    localStorage.setItem(KEYS.roomId, roomId);
    localStorage.setItem(KEYS.joinCode, joinCode);
    localStorage.setItem(KEYS.hostToken, hostToken);
  },
  loadHostSession() {
    const roomId = localStorage.getItem(KEYS.roomId);
    const joinCode = localStorage.getItem(KEYS.joinCode);
    const hostToken = localStorage.getItem(KEYS.hostToken);
    if (roomId && joinCode && hostToken) return { roomId, joinCode, hostToken };
    return null;
  },
  clearHostSession() {
    localStorage.removeItem(KEYS.roomId);
    localStorage.removeItem(KEYS.joinCode);
    localStorage.removeItem(KEYS.hostToken);
  },
  saveParticipantSession(participantToken: string, nickname: string) {
    localStorage.setItem(KEYS.participantToken, participantToken);
    localStorage.setItem(KEYS.participantNickname, nickname);
  },
  loadParticipantSession() {
    return {
      participantToken: localStorage.getItem(KEYS.participantToken) ?? '',
      nickname: localStorage.getItem(KEYS.participantNickname) ?? '',
    };
  },
};
