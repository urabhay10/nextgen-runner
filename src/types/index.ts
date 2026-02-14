export interface Player {
  name: string;
  role: string;
}

export interface PlayerInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
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
  winner: string;
  margin: string;
  scorecard: Record<string, ScorecardData>;
  type?: 'match_update' | 'match_complete';
}

export interface SeriesSummaryData {
  summary: string | { scoreline?: string;[key: string]: unknown };
  type?: 'series_complete';
}
