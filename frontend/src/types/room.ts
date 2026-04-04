export type RoomStatus = 'waiting' | 'closed' | 'drawn';

export interface LotterySettings {
  ranked: boolean;
  winner_count: number;
  roles: string[];
}

export interface Room {
  roomId: string;
  joinCode: string;
  status: RoomStatus;
}

export interface CreateRoomResponse {
  roomId: string;
  joinCode: string;
  hostToken: string;
}

export interface Participant {
  id: string;
  nickname: string;
  joined_at: string;
}

export interface ParticipantsResponse {
  roomId: string;
  status: RoomStatus;
  count: number;
  participants: Participant[];
}

export interface JoinRoomResponse {
  participantId: string;
  participantToken: string;
  roomId: string;
}

export interface ApiError {
  code: string;
  message: string;
}
