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

  closeRoom(roomId: string, hostToken: string): Promise<{ roomId: string; status: string }> {
    return request(`/rooms/${encodeURIComponent(roomId)}/close`, {
      method: 'POST',
      headers: { 'X-Host-Token': hostToken },
    });
  },
};
