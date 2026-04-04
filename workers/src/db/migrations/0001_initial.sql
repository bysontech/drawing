-- Migration: 0001_initial
-- Party Lottery: initial schema

CREATE TABLE IF NOT EXISTS rooms (
  id TEXT PRIMARY KEY,
  join_code TEXT NOT NULL UNIQUE,
  host_token TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'waiting',
  lottery_settings TEXT NOT NULL DEFAULT '{"ranked":false,"winner_count":1,"roles":[]}',
  show_result_to_participants INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS participants (
  id TEXT PRIMARY KEY,
  room_id TEXT NOT NULL,
  nickname TEXT NOT NULL,
  participant_token TEXT NOT NULL,
  joined_at TEXT NOT NULL,
  FOREIGN KEY (room_id) REFERENCES rooms(id) ON DELETE CASCADE,
  UNIQUE (room_id, nickname)
);

CREATE INDEX IF NOT EXISTS idx_rooms_join_code ON rooms(join_code);
CREATE INDEX IF NOT EXISTS idx_participants_room_id ON participants(room_id);
