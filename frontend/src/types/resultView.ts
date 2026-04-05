export type ResultPresentationMode = 'ranked' | 'flat';

export interface ResultViewItem {
  participantId: string;
  nickname: string;
  rank: number | null;
  role: string | null;
  isMe: boolean;
}
