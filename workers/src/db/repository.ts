import { generateJoinCode, generateUUID } from '../utils/id';

export interface Room {
  id: string;
  join_code: string;
  host_token: string;
  status: 'waiting' | 'closed' | 'drawn';
  lottery_settings: string;
  show_result_to_participants: number;
  created_at: string;
}

export interface Participant {
  id: string;
  room_id: string;
  nickname: string;
  participant_token: string;
  joined_at: string;
}

export interface CreateRoomResult {
  roomId: string;
  joinCode: string;
  hostToken: string;
}

export interface JoinResult {
  participantId: string;
  participantToken: string;
  roomId: string;
}

export async function createRoom(db: D1Database): Promise<CreateRoomResult> {
  const id = generateUUID();
  const joinCode = generateJoinCode();
  const hostToken = generateUUID();
  const now = new Date().toISOString();

  await db
    .prepare(
      `INSERT INTO rooms (id, join_code, host_token, status, lottery_settings, show_result_to_participants, created_at)
       VALUES (?, ?, ?, 'waiting', '{"ranked":false,"winner_count":1,"roles":[]}', 0, ?)`
    )
    .bind(id, joinCode, hostToken, now)
    .run();

  return { roomId: id, joinCode, hostToken };
}

export async function getRoomByJoinCode(db: D1Database, joinCode: string): Promise<Room | null> {
  const result = await db
    .prepare('SELECT * FROM rooms WHERE join_code = ?')
    .bind(joinCode)
    .first<Room>();
  return result ?? null;
}

export async function getRoomById(db: D1Database, roomId: string): Promise<Room | null> {
  const result = await db
    .prepare('SELECT * FROM rooms WHERE id = ?')
    .bind(roomId)
    .first<Room>();
  return result ?? null;
}

export async function joinParticipant(
  db: D1Database,
  roomId: string,
  nickname: string
): Promise<JoinResult> {
  const id = generateUUID();
  const participantToken = generateUUID();
  const now = new Date().toISOString();

  await db
    .prepare(
      `INSERT INTO participants (id, room_id, nickname, participant_token, joined_at)
       VALUES (?, ?, ?, ?, ?)`
    )
    .bind(id, roomId, nickname, participantToken, now)
    .run();

  return { participantId: id, participantToken, roomId };
}

export async function listParticipantsByRoom(
  db: D1Database,
  roomId: string
): Promise<Pick<Participant, 'id' | 'nickname' | 'joined_at'>[]> {
  const result = await db
    .prepare('SELECT id, nickname, joined_at FROM participants WHERE room_id = ? ORDER BY joined_at ASC')
    .bind(roomId)
    .all<Pick<Participant, 'id' | 'nickname' | 'joined_at'>>();
  return result.results;
}

export async function closeRoom(db: D1Database, roomId: string): Promise<void> {
  await db
    .prepare("UPDATE rooms SET status = 'closed' WHERE id = ?")
    .bind(roomId)
    .run();
}
