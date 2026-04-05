import type { ResultViewItem } from '../types/resultView';
import type { DrawSequenceStep } from '../types/drawAnimation';

/**
 * Build the ordered sequence of animation steps from result view items.
 * For ranked results: order by rank (1 first).
 * For flat results: use original order.
 */
export function buildDrawSequence(items: ResultViewItem[]): DrawSequenceStep[] {
  const ordered = [...items].sort((a, b) => {
    if (a.rank !== null && b.rank !== null) return a.rank - b.rank;
    return 0;
  });

  return ordered.map((item, i) => ({
    winnerIndex: i,
    item,
    hasRole: !!item.role,
  }));
}
