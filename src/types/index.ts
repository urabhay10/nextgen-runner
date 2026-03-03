export interface Player {
  name: string;
  id: string | number;
  // New backend fields
  can_bowl?: boolean;
  matches?: number;
  teams?: string[];
  // Legacy backend field
  role?: string;
}

export interface PlayerInputProps {
  value: string;
  onChange: (value: string) => void;
  onBulkPaste?: (values: string[]) => void;
  placeholder?: string;
  index?: number;
}

export interface PlayerStats {
  name: string;
  runs: number;
  balls: number;
  fours?: number | string;
  sixes?: number | string;
  out: boolean;
  out_by?: string; // New field for bowler who took the wicket
  wickets?: number;
  maidens?: number;
  runs_given?: number; // From API stream
  overs?: number; // From API stream
}

export interface MatchDetail {
  striker: PlayerStats;
  non_striker: PlayerStats;
  bowler: PlayerStats;
  total_runs: number;
  wickets: number;
  bat_team: string;
  target?: number;
  over: number;
  ball: number;
  innings?: number;
  match_no?: number;
}

export interface BallEvent extends MatchDetail {
  runs_scored: number | string;
  is_wicket: boolean;
}

export interface ScorecardData {
  score: string;
  batting: PlayerStats[];
  bowling: PlayerStats[];
}

export interface HistoryItem {
  match_no?: number;
  winner: string;
  margin: string;
  scorecard: Record<string, ScorecardData>;
  type?: 'match_update' | 'match_complete';
}

export interface Model {
  id: string;
  name: string;
  version: string;
  description: string;
}

export interface SeriesSummaryData {
  summary: any; // Scoreline or summary object
  team1_wins?: number;
  team2_wins?: number;
  draws?: number;
  history?: {
    match_no: number;
    winner: string;
    margin: string;
    score: string;
  }[];
}

/** A single entry in a generated batting order. */
export interface BattingOrderItem {
  position: number;
  player: string;
  fit_score: number;
  caps: number;
}

/** A stable slot identifier so duplicate names are always distinguishable. */
export interface SlottedPlayer {
  /** Stable slot identifier, e.g. "t1_0", "t1_1". Never changes even when the name changes. */
  uid: string;
  name: string;
  /**
   * Unique game-scoped integer ID (0–21). Team 1 slots get IDs 0–10, team 2 slots get 11–21.
   * Used instead of player name as the key in playerIdMap so duplicate names are handled correctly.
   */
  gameId: number;
}
