export interface LotterySettings {
  ranked: boolean;
  winner_count: number;
  roles: string[];
  show_result_to_participants: boolean;
}

export interface LotteryResultItem {
  rank: number | null;
  participant_id: string;
  nickname: string;
  role: string | null;
}

export interface LotteryResult {
  roomId: string;
  status: string;
  showResultToParticipants: boolean;
  results: LotteryResultItem[];
  drawnAt: string;
}

export interface DrawResponse {
  roomId: string;
  status: string;
  results: LotteryResultItem[];
  drawnAt: string;
}
