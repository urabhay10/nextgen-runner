'use client';

import { Users, Crosshair } from 'lucide-react';
import { MatchDetail } from '@/types';
import PlayerLink from './PlayerLink';

interface ScoreCardLiveProps {
  detail: MatchDetail | null;
  live: boolean;
  playerIdMap?: Record<string, string | number>;
}

const ScoreCardLive = ({ detail, live, playerIdMap }: ScoreCardLiveProps) => {
  if (!detail) return null;
  const { striker, non_striker, bowler, total_runs = 0, wickets = 0, bat_team = "", target, over = 0, ball = 0 } = detail || {};

  const ballsDone = over * 6 + ball;
  const crr = ballsDone > 0 ? ((total_runs / ballsDone) * 6).toFixed(2) : "0.00";
  let rrr = null;
  if (target) {
    const ballsRem = 120 - ballsDone;
    const runsRem = target - total_runs;
    rrr = ballsRem > 0 ? ((runsRem / ballsRem) * 6).toFixed(2) : "-";
  }

  return (
    <div className="bg-gradient-to-br from-[var(--surface)] to-[var(--background)] rounded-2xl p-6 shadow-2xl border border-[var(--border)] mb-6 relative overflow-hidden">
      {live && <div className="absolute top-4 right-4 flex items-center gap-2">
        <span className="animate-pulse w-3 h-3 bg-[var(--sandy-brown)] rounded-full shadow-[0_0_10px_rgba(var(--sandy-brown-rgb),0.6)]"></span>
        <span className="text-xs font-bold text-[var(--sandy-brown)] uppercase tracking-widest">Live</span>
      </div>}

      {/* Main Score Display */}
      <div className="flex flex-col items-center justify-center mb-8 relative z-10">
        <div className="text-sm text-[var(--sage-green)] uppercase tracking-[0.2em] font-bold mb-2">{bat_team} Batting</div>
        <div className="text-7xl font-black font-mono tracking-tighter text-[var(--foreground)] drop-shadow-lg leading-none">
          {total_runs}<span className="text-[var(--muted)] mx-2 text-5xl font-light">/</span>{wickets}
        </div>
        <div className="text-[var(--muted)] font-mono mt-3 text-lg bg-[rgba(var(--background-rgb),0.5)] px-4 py-1 rounded-full border border-[rgba(var(--border-rgb),0.5)]">
          Overs: <span className="text-[var(--foreground)] font-bold">{over}.{ball}</span>
        </div>

        <div className="flex gap-12 mt-8 w-full justify-center border-t border-[rgba(var(--border-rgb),0.5)] pt-6">
          <div className="text-center">
            <div className="text-[10px] uppercase text-[var(--muted)] font-bold tracking-widest mb-1">CRR</div>
            <div className="text-2xl font-mono text-[var(--sage-green)] font-bold">{crr}</div>
          </div>
          {target && (
            <>
              <div className="text-center px-8 border-x border-[rgba(var(--border-rgb),0.5)]">
                <div className="text-[10px] uppercase text-[var(--muted)] font-bold tracking-widest mb-1">Target</div>
                <div className="text-2xl font-mono text-[var(--foreground)] font-bold">{target}</div>
              </div>
              <div className="text-center">
                <div className="text-[10px] uppercase text-[var(--muted)] font-bold tracking-widest mb-1">RRR</div>
                <div className="text-2xl font-mono text-[var(--sandy-brown)] font-bold">{rrr}</div>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Active Players Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 relative z-10">
        {/* Batting Card */}
        <div className="bg-[rgba(var(--background-rgb),0.4)] p-5 rounded-xl border border-[rgba(var(--border-rgb),0.5)] backdrop-blur-sm shadow-inner">
          <div className="text-[10px] text-[var(--muted)] uppercase mb-4 flex items-center gap-2 font-bold tracking-wider border-b border-[rgba(var(--border-rgb),0.5)] pb-2">
            <Users className="w-3 h-3" /> Batting
          </div>
          {striker && (
            <div className="flex justify-between items-center mb-3">
              <div className="flex items-center gap-3">
                <div className="w-1.5 h-1.5 bg-[var(--sage-green)] rounded-full animate-pulse"></div>
                <PlayerLink name={striker.name} id={playerIdMap?.[striker.name]}>
                  <span className="font-bold text-[var(--foreground)] text-lg tracking-tight cursor-default">{striker.name}</span>
                </PlayerLink>
              </div>
              <div className="font-mono text-[var(--sage-green)] text-xl font-bold">{striker.runs}<span className="text-[var(--muted)] text-sm ml-1 font-medium">({striker.balls})</span></div>
            </div>
          )}
          {non_striker && (
            <div className="flex justify-between items-center opacity-60">
              <PlayerLink name={non_striker.name} id={playerIdMap?.[non_striker.name]}>
                <span className="text-[var(--muted)] font-medium pl-4.5 cursor-default">{non_striker.name}</span>
              </PlayerLink>
              <span className="font-mono text-[var(--muted)]">{non_striker.runs}<span className="text-[var(--muted)] opacity-70 text-sm ml-1">({non_striker.balls})</span></span>
            </div>
          )}
        </div>

        {/* Bowling Card */}
        <div className="bg-[rgba(var(--background-rgb),0.4)] p-5 rounded-xl border border-[rgba(var(--border-rgb),0.5)] backdrop-blur-sm shadow-inner">
          <div className="text-[10px] text-[var(--muted)] uppercase mb-4 flex items-center gap-2 font-bold tracking-wider border-b border-[rgba(var(--border-rgb),0.5)] pb-2">
            <Crosshair className="w-3 h-3" /> Bowling
          </div>
          {bowler && (
            <div>
              <div className="flex justify-between items-center mb-4">
                <PlayerLink name={bowler.name} id={playerIdMap?.[bowler.name]}>
                  <span className="font-bold text-[var(--sandy-brown)] text-lg tracking-tight cursor-default">{bowler.name}</span>
                </PlayerLink>
              </div>
              <div className="grid grid-cols-3 gap-2">
                <div className="bg-[rgba(var(--border-rgb),0.3)] rounded p-1 text-center border border-[rgba(var(--border-rgb),0.5)]">
                  <div className="text-[9px] text-[var(--muted)] uppercase font-bold">Wickets</div>
                  <div className="font-mono font-bold text-[var(--foreground)] text-lg">{bowler.wickets}</div>
                </div>
                <div className="bg-[rgba(var(--border-rgb),0.3)] rounded p-1 text-center border border-[rgba(var(--border-rgb),0.5)]">
                  <div className="text-[9px] text-[var(--muted)] uppercase font-bold">Runs</div>
                  {/* Server uses 'runs_given' in the live feed for bowler stats */}
                  <div className="font-mono text-[var(--muted)] text-lg">{bowler.runs_given ?? bowler.runs ?? 0}</div>
                </div>
                <div className="bg-[rgba(var(--border-rgb),0.3)] rounded p-1 text-center border border-[rgba(var(--border-rgb),0.5)]">
                  <div className="text-[9px] text-[var(--muted)] uppercase font-bold">Overs</div>
                  <div className="font-mono text-[var(--muted)] text-lg">{bowler.overs}.{ball}</div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ScoreCardLive;
