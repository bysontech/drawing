import { Hono } from 'hono';
import { cors } from 'hono/cors';
import {
  closeRoom,
  countParticipantsByRoom,
  createRoom,
  getLotteryResultByRoom,
  getRoomById,
  getRoomByJoinCode,
  joinParticipant,
  listParticipantsByRoom,
  markRoomDrawn,
  saveLotteryResult,
  updateRoomSettings,
  verifyHostToken,
} from './db/repository';
import { drawLottery } from './domain/drawLottery';

type Env = {
  DB: D1Database;
  ALLOWED_ORIGIN: string;
};

const app = new Hono<{ Bindings: Env }>();

// ── CORS ──────────────────────────────────────────────

app.use('*', async (c, next) => {
  const origin = c.env.ALLOWED_ORIGIN ?? 'http://localhost:5173';
  return cors({ origin })(c, next);
});

// ── POST /rooms — ルーム作成 ──────────────────────────

app.post('/rooms', async (c) => {
  try {
    const result = await createRoom(c.env.DB);
    return c.json(result, 201);
  } catch (err) {
    console.error('POST /rooms', err);
    return c.json({ code: 'SERVER_ERROR', message: 'Internal server error' }, 500);
  }
});

// ── GET /rooms/join/:joinCode — joinCode でルーム確認 ──

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
      showResultToParticipants: room.show_result_to_participants === 1,
    });
  } catch (err) {
    console.error('GET /rooms/join/:joinCode', err);
    return c.json({ code: 'SERVER_ERROR', message: 'Internal server error' }, 500);
  }
});

// ── POST /rooms/:roomId/join — 参加者登録 ────────────

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
    if (room.status !== 'waiting') {
      return c.json(
        { code: 'ROOM_CLOSED', message: 'This room is no longer accepting participants' },
        409
      );
    }

    const result = await joinParticipant(c.env.DB, roomId, nickname);
    return c.json(result, 201);
  } catch (err: unknown) {
    if (err instanceof Error && err.message.includes('UNIQUE constraint failed')) {
      return c.json({ code: 'NICKNAME_TAKEN', message: 'That nickname is already taken' }, 409);
    }
    console.error('POST /rooms/:roomId/join', err);
    return c.json({ code: 'SERVER_ERROR', message: 'Internal server error' }, 500);
  }
});

// ── GET /rooms/:roomId/participants — 参加者一覧 ──────

app.get('/rooms/:roomId/participants', async (c) => {
  const roomId = c.req.param('roomId');
  try {
    const room = await getRoomById(c.env.DB, roomId);
    if (!room) {
      return c.json({ code: 'ROOM_NOT_FOUND', message: 'Room not found' }, 404);
    }

    const participants = await listParticipantsByRoom(c.env.DB, roomId);
    return c.json({ roomId, status: room.status, count: participants.length, participants });
  } catch (err) {
    console.error('GET /rooms/:roomId/participants', err);
    return c.json({ code: 'SERVER_ERROR', message: 'Internal server error' }, 500);
  }
});

// ── PATCH /rooms/:roomId/settings — 抽選設定更新 ─────

app.patch('/rooms/:roomId/settings', async (c) => {
  const roomId = c.req.param('roomId');
  const hostToken = c.req.header('X-Host-Token');

  let body: unknown;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ code: 'VALIDATION_ERROR', message: 'Invalid JSON body' }, 400);
  }

  try {
    const room = await getRoomById(c.env.DB, roomId);
    if (!room) {
      return c.json({ code: 'ROOM_NOT_FOUND', message: 'Room not found' }, 404);
    }
    if (!verifyHostToken(room, hostToken)) {
      return c.json({ code: 'FORBIDDEN', message: 'Invalid host token' }, 403);
    }

    const raw = body as Record<string, unknown>;

    // Parse current settings as base
    let current = { ranked: false, winner_count: 1, roles: [] as string[] };
    try {
      current = JSON.parse(room.lottery_settings) as typeof current;
    } catch {
      // keep defaults
    }

    const ranked = typeof raw.ranked === 'boolean' ? raw.ranked : current.ranked;
    const winnerCount =
      typeof raw.winner_count === 'number' ? raw.winner_count : current.winner_count;
    const roles = Array.isArray(raw.roles)
      ? (raw.roles as unknown[])
          .filter((r): r is string => typeof r === 'string')
          .map((r) => r.trim())
          .filter(Boolean)
          .slice(0, 20)
      : current.roles;
    const showResult =
      typeof raw.show_result_to_participants === 'boolean'
        ? raw.show_result_to_participants
          ? 1
          : 0
        : room.show_result_to_participants;

    if (winnerCount < 1) {
      return c.json(
        { code: 'VALIDATION_ERROR', message: 'winner_count must be at least 1' },
        400
      );
    }

    // If room is closed, validate against participant count
    if (room.status === 'closed') {
      const count = await countParticipantsByRoom(c.env.DB, roomId);
      if (winnerCount > count) {
        return c.json(
          {
            code: 'VALIDATION_ERROR',
            message: `winner_count (${winnerCount}) exceeds participant count (${count})`,
          },
          422
        );
      }
    }

    await updateRoomSettings(c.env.DB, roomId, { ranked, winner_count: winnerCount, roles }, showResult);
    return c.json({ roomId, ranked, winner_count: winnerCount, roles, show_result_to_participants: showResult });
  } catch (err) {
    console.error('PATCH /rooms/:roomId/settings', err);
    return c.json({ code: 'SERVER_ERROR', message: 'Internal server error' }, 500);
  }
});

// ── POST /rooms/:roomId/close — 参加締め切り ─────────

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
    if (!verifyHostToken(room, hostToken)) {
      return c.json({ code: 'FORBIDDEN', message: 'Invalid host token' }, 403);
    }
    if (room.status !== 'waiting') {
      return c.json({ code: 'VALIDATION_ERROR', message: 'Room is not in waiting status' }, 400);
    }

    const count = await countParticipantsByRoom(c.env.DB, roomId);
    if (count < 1) {
      return c.json(
        { code: 'VALIDATION_ERROR', message: 'At least 1 participant is required to close the room' },
        400
      );
    }

    await closeRoom(c.env.DB, roomId);
    return c.json({ roomId, status: 'closed' });
  } catch (err) {
    console.error('POST /rooms/:roomId/close', err);
    return c.json({ code: 'SERVER_ERROR', message: 'Internal server error' }, 500);
  }
});

// ── POST /rooms/:roomId/draw — 抽選実行 ──────────────

app.post('/rooms/:roomId/draw', async (c) => {
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
    if (!verifyHostToken(room, hostToken)) {
      return c.json({ code: 'FORBIDDEN', message: 'Invalid host token' }, 403);
    }
    if (room.status === 'drawn') {
      return c.json({ code: 'ALREADY_DRAWN', message: 'This room has already been drawn' }, 409);
    }
    if (room.status !== 'closed') {
      return c.json(
        { code: 'DRAW_NOT_ALLOWED', message: 'Room must be closed before drawing' },
        422
      );
    }

    // Double-draw guard: check lottery_results
    const existing = await getLotteryResultByRoom(c.env.DB, roomId);
    if (existing) {
      return c.json({ code: 'ALREADY_DRAWN', message: 'This room has already been drawn' }, 409);
    }

    // Parse settings
    let settings = { ranked: false, winner_count: 1, roles: [] as string[] };
    try {
      settings = JSON.parse(room.lottery_settings) as typeof settings;
    } catch {
      // use defaults
    }

    const participants = await listParticipantsByRoom(c.env.DB, roomId);
    if (participants.length === 0) {
      return c.json(
        { code: 'VALIDATION_ERROR', message: 'No participants to draw from' },
        400
      );
    }

    const winnerCount = Math.min(settings.winner_count, participants.length);
    const results = drawLottery(participants, { ...settings, winner_count: winnerCount });

    await saveLotteryResult(c.env.DB, roomId, results);
    await markRoomDrawn(c.env.DB, roomId);

    return c.json({
      roomId,
      status: 'drawn',
      results,
      drawnAt: new Date().toISOString(),
    });
  } catch (err) {
    console.error('POST /rooms/:roomId/draw', err);
    return c.json({ code: 'SERVER_ERROR', message: 'Internal server error' }, 500);
  }
});

// ── GET /rooms/:roomId/result — 結果取得 ─────────────

app.get('/rooms/:roomId/result', async (c) => {
  const roomId = c.req.param('roomId');
  const hostToken = c.req.header('X-Host-Token');

  try {
    const room = await getRoomById(c.env.DB, roomId);
    if (!room) {
      return c.json({ code: 'ROOM_NOT_FOUND', message: 'Room not found' }, 404);
    }

    const isHost = verifyHostToken(room, hostToken);

    if (!isHost && room.show_result_to_participants !== 1) {
      return c.json(
        { code: 'RESULT_PRIVATE', message: 'Results are not public for this room' },
        403
      );
    }

    const resultRow = await getLotteryResultByRoom(c.env.DB, roomId);
    if (!resultRow) {
      return c.json({ code: 'RESULT_NOT_FOUND', message: 'No result yet' }, 404);
    }

    let results: unknown = [];
    try {
      results = JSON.parse(resultRow.results);
    } catch {
      // return empty
    }

    return c.json({
      roomId,
      status: room.status,
      showResultToParticipants: room.show_result_to_participants === 1,
      results,
      drawnAt: resultRow.drawn_at,
    });
  } catch (err) {
    console.error('GET /rooms/:roomId/result', err);
    return c.json({ code: 'SERVER_ERROR', message: 'Internal server error' }, 500);
  }
});

export default app;
