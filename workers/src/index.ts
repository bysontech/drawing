import { Hono } from 'hono';
import { cors } from 'hono/cors';
import {
  closeRoom,
  createRoom,
  getRoomById,
  getRoomByJoinCode,
  joinParticipant,
  listParticipantsByRoom,
} from './db/repository';

type Env = {
  DB: D1Database;
  ALLOWED_ORIGIN: string;
};

const app = new Hono<{ Bindings: Env }>();

// CORS
app.use('*', async (c, next) => {
  const origin = c.env.ALLOWED_ORIGIN ?? 'http://localhost:5173';
  return cors({ origin })(c, next);
});

// POST /rooms — ルーム作成
app.post('/rooms', async (c) => {
  try {
    const result = await createRoom(c.env.DB);
    return c.json(result, 201);
  } catch (err) {
    console.error('POST /rooms error', err);
    return c.json({ code: 'SERVER_ERROR', message: 'Internal server error' }, 500);
  }
});

// GET /rooms/join/:joinCode — joinCode でルーム確認
app.get('/rooms/join/:joinCode', async (c) => {
  const joinCode = c.req.param('joinCode');
  try {
    const room = await getRoomByJoinCode(c.env.DB, joinCode.toUpperCase());
    if (!room) {
      return c.json({ code: 'ROOM_NOT_FOUND', message: 'Room not found' }, 404);
    }
    return c.json({
      roomId: room.id,
      joinCode: room.join_code,
      status: room.status,
    });
  } catch (err) {
    console.error('GET /rooms/join/:joinCode error', err);
    return c.json({ code: 'SERVER_ERROR', message: 'Internal server error' }, 500);
  }
});

// POST /rooms/:roomId/join — 参加者登録
app.post('/rooms/:roomId/join', async (c) => {
  const roomId = c.req.param('roomId');
  let body: unknown;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ code: 'VALIDATION_ERROR', message: 'Invalid JSON body' }, 400);
  }

  const raw = body as Record<string, unknown>;
  const nickname = typeof raw.nickname === 'string' ? raw.nickname.trim() : '';

  if (!nickname || nickname.length < 1 || nickname.length > 20) {
    return c.json(
      { code: 'VALIDATION_ERROR', message: 'nickname must be 1–20 characters' },
      400
    );
  }

  try {
    const room = await getRoomById(c.env.DB, roomId);
    if (!room) {
      return c.json({ code: 'ROOM_NOT_FOUND', message: 'Room not found' }, 404);
    }
    if (room.status === 'closed' || room.status === 'drawn') {
      return c.json({ code: 'ROOM_CLOSED', message: 'This room is no longer accepting participants' }, 409);
    }

    const result = await joinParticipant(c.env.DB, roomId, nickname);
    return c.json(result, 201);
  } catch (err: unknown) {
    // D1 unique constraint violation
    if (err instanceof Error && err.message.includes('UNIQUE constraint failed')) {
      return c.json({ code: 'NICKNAME_TAKEN', message: 'That nickname is already taken' }, 409);
    }
    console.error('POST /rooms/:roomId/join error', err);
    return c.json({ code: 'SERVER_ERROR', message: 'Internal server error' }, 500);
  }
});

// GET /rooms/:roomId/participants — 参加者一覧
app.get('/rooms/:roomId/participants', async (c) => {
  const roomId = c.req.param('roomId');
  try {
    const room = await getRoomById(c.env.DB, roomId);
    if (!room) {
      return c.json({ code: 'ROOM_NOT_FOUND', message: 'Room not found' }, 404);
    }

    const participants = await listParticipantsByRoom(c.env.DB, roomId);
    return c.json({
      roomId,
      status: room.status,
      count: participants.length,
      participants,
    });
  } catch (err) {
    console.error('GET /rooms/:roomId/participants error', err);
    return c.json({ code: 'SERVER_ERROR', message: 'Internal server error' }, 500);
  }
});

// POST /rooms/:roomId/close — 参加締め切り
app.post('/rooms/:roomId/close', async (c) => {
  const roomId = c.req.param('roomId');
  const hostToken = c.req.header('X-Host-Token');

  if (!hostToken) {
    return c.json({ code: 'FORBIDDEN', message: 'X-Host-Token header is required' }, 403);
  }

  try {
    const room = await getRoomById(c.env.DB, roomId);
    if (!room) {
      return c.json({ code: 'ROOM_NOT_FOUND', message: 'Room not found' }, 404);
    }
    if (room.host_token !== hostToken) {
      return c.json({ code: 'FORBIDDEN', message: 'Invalid host token' }, 403);
    }
    if (room.status !== 'waiting') {
      return c.json({ code: 'VALIDATION_ERROR', message: 'Room is not in waiting status' }, 400);
    }

    await closeRoom(c.env.DB, roomId);
    return c.json({ roomId, status: 'closed' });
  } catch (err) {
    console.error('POST /rooms/:roomId/close error', err);
    return c.json({ code: 'SERVER_ERROR', message: 'Internal server error' }, 500);
  }
});

export default app;
