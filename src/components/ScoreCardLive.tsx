'use client';

import { Users, Crosshair } from 'lucide-react';
import { MatchDetail } from '@/types';
import PlayerLink from './PlayerLink';

interface ScoreCardLiveProps {
  detail: MatchDetail | null;
  live: boolean;
}

const ScoreCardLive = ({ detail, live }: ScoreCardLiveProps) => {
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
    <div className="bg-gradient-to-br from-slate-800 to-slate-900 rounded-2xl p-6 shadow-2xl border border-slate-700 mb-6 relative overflow-hidden">
      {live && <div className="absolute top-4 right-4 flex items-center gap-2">
        <span className="animate-pulse w-3 h-3 bg-red-500 rounded-full shadow-[0_0_10px_rgba(239,68,68,0.6)]"></span>
        <span className="text-xs font-bold text-red-500 uppercase tracking-widest">Live</span>
      </div>}

      {/* Main Score Display */}
      <div className="flex flex-col items-center justify-center mb-8 relative z-10">
        <div className="text-sm text-emerald-400 uppercase tracking-[0.2em] font-bold mb-2">{bat_team} Batting</div>
        <div className="text-7xl font-black font-mono tracking-tighter text-white drop-shadow-lg leading-none">
          {total_runs}<span className="text-slate-600 mx-2 text-5xl font-light">/</span>{wickets}
        </div>
        <div className="text-slate-400 font-mono mt-3 text-lg bg-slate-950/30 px-4 py-1 rounded-full border border-white/5">
          Overs: <span className="text-white font-bold">{over}.{ball}</span>
        </div>

        <div className="flex gap-12 mt-8 w-full justify-center border-t border-white/5 pt-6">
          <div className="text-center">
            <div className="text-[10px] uppercase text-slate-500 font-bold tracking-widest mb-1">CRR</div>
            <div className="text-2xl font-mono text-emerald-400 font-bold">{crr}</div>
          </div>
          {target && (
            <>
              <div className="text-center px-8 border-x border-white/5">
                <div className="text-[10px] uppercase text-slate-500 font-bold tracking-widest mb-1">Target</div>
                <div className="text-2xl font-mono text-white font-bold">{target}</div>
              </div>
              <div className="text-center">
                <div className="text-[10px] uppercase text-slate-500 font-bold tracking-widest mb-1">RRR</div>
                <div className="text-2xl font-mono text-rose-400 font-bold">{rrr}</div>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Active Players Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 relative z-10">
        {/* Batting Card */}
        <div className="bg-slate-950/40 p-5 rounded-xl border border-white/5 backdrop-blur-sm shadow-inner">
          <div className="text-[10px] text-slate-500 uppercase mb-4 flex items-center gap-2 font-bold tracking-wider border-b border-white/5 pb-2">
            <Users className="w-3 h-3" /> Batting
          </div>
          {striker && (
            <div className="flex justify-between items-center mb-3">
              <div className="flex items-center gap-3">
                <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse"></div>
                <PlayerLink name={striker.name}>
                  <span className="font-bold text-white text-lg tracking-tight cursor-default">{striker.name}</span>
                </PlayerLink>
              </div>
              <div className="font-mono text-emerald-400 text-xl font-bold">{striker.runs}<span className="text-slate-500 text-sm ml-1 font-medium">({striker.balls})</span></div>
            </div>
          )}
          {non_striker && (
            <div className="flex justify-between items-center opacity-60">
              <PlayerLink name={non_striker.name}>
                <span className="text-slate-300 font-medium pl-4.5 cursor-default">{non_striker.name}</span>
              </PlayerLink>
              <span className="font-mono text-slate-400">{non_striker.runs}<span className="text-slate-600 text-sm ml-1">({non_striker.balls})</span></span>
            </div>
          )}
        </div>

        {/* Bowling Card */}
        <div className="bg-slate-950/40 p-5 rounded-xl border border-white/5 backdrop-blur-sm shadow-inner">
          <div className="text-[10px] text-slate-500 uppercase mb-4 flex items-center gap-2 font-bold tracking-wider border-b border-white/5 pb-2">
            <Crosshair className="w-3 h-3" /> Bowling
          </div>
          {bowler && (
            <div>
              <div className="flex justify-between items-center mb-4">
                <PlayerLink name={bowler.name}>
                  <span className="font-bold text-rose-300 text-lg tracking-tight cursor-default">{bowler.name}</span>
                </PlayerLink>
              </div>
              <div className="grid grid-cols-3 gap-2">
                <div className="bg-slate-800/50 rounded p-1 text-center border border-white/5">
                  <div className="text-[9px] text-slate-500 uppercase font-bold">Wickets</div>
                  <div className="font-mono font-bold text-white text-lg">{bowler.wickets}</div>
                </div>
                <div className="bg-slate-800/50 rounded p-1 text-center border border-white/5">
                  <div className="text-[9px] text-slate-500 uppercase font-bold">Runs</div>
                  {/* Server uses 'runs_given' in the live feed for bowler stats */}
                  <div className="font-mono text-slate-300 text-lg">{bowler.runs_given ?? bowler.runs ?? 0}</div>
                </div>
                <div className="bg-slate-800/50 rounded p-1 text-center border border-white/5">
                  <div className="text-[9px] text-slate-500 uppercase font-bold">Overs</div>
                  <div className="font-mono text-slate-300 text-lg">{bowler.overs}.{ball}</div>
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
