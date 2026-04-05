-- Migration: 0002_lottery_results
-- Party Lottery: add lottery_results table

CREATE TABLE IF NOT EXISTS lottery_results (
  id TEXT PRIMARY KEY,
  room_id TEXT NOT NULL UNIQUE,
  results TEXT NOT NULL,
  drawn_at TEXT NOT NULL,
  FOREIGN KEY (room_id) REFERENCES rooms(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_lottery_results_room_id ON lottery_results(room_id);
