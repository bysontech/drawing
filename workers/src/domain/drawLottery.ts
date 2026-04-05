import type { LotteryResultItem, LotterySettingsData } from '../db/repository';

interface ParticipantInput {
  id: string;
  nickname: string;
}

/** Fisher-Yates shuffle (in-place) */
function shuffle<T>(arr: T[]): T[] {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

export function drawLottery(
  participants: ParticipantInput[],
  settings: LotterySettingsData
): LotteryResultItem[] {
  const shuffled = shuffle([...participants]);
  const winnerCount = Math.min(settings.winner_count, shuffled.length);
  const winners = shuffled.slice(0, winnerCount);

  return winners.map((p, idx) => ({
    rank: settings.ranked ? idx + 1 : null,
    participant_id: p.id,
    nickname: p.nickname,
    role: settings.roles[idx] ?? null,
  }));
}
