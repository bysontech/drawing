import type { LotteryResultItem } from '../types/lottery';
import type { ResultPresentationMode, ResultViewItem } from '../types/resultView';

/**
 * Convert raw API results into display-ready view models.
 * @param results  raw results from the API
 * @param meId     participantToken stored in localStorage (may be empty)
 * @param meNick   nickname stored in localStorage (fallback identity)
 */
export function toResultViewItems(
  results: LotteryResultItem[],
  meId: string,
  meNick: string
): ResultViewItem[] {
  return results.map((r) => ({
    participantId: r.participant_id,
    nickname: r.nickname,
    rank: r.rank,
    role: r.role,
    isMe: (!!meId && r.participant_id === meId) || (!!meNick && r.nickname === meNick),
  }));
}

export function presentationMode(items: ResultViewItem[]): ResultPresentationMode {
  return items.some((i) => i.rank !== null) ? 'ranked' : 'flat';
}

export function rankLabel(item: ResultViewItem, index: number): string {
  if (item.rank !== null) return `${item.rank}位`;
  return `${index + 1}`;
}
