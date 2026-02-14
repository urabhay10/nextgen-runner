'use client';

import { useState, useRef, useEffect } from 'react';
import { BallEvent } from '@/types';

interface CommentaryProps {
  events: BallEvent[];
}

interface GroupedOver {
  key: string;
  match_no?: number; // Made optional since not all events may have match_no
  team: string;
  bowler: string; // Added bowler name
  balls: (string | number)[];
  runs: number;
  wickets: number;
  overNum: number;
}

const Commentary = ({ events }: CommentaryProps) => {
  // Removed scrollRef and auto-scroll logic as newest items appear at top naturally
  
  const groupedOvers: GroupedOver[] = [];
  events.forEach(e => {
    if (!e || typeof e.over === 'undefined') return;

    // CRITICAL FIX: Include match_no in the key to prevent overs from different matches merging
    const matchPrefix = e.match_no ? `M${e.match_no}-` : '';
    const key = `${matchPrefix}${e.innings}-${e.over}`;

    let over = groupedOvers.find(o => o.key === key);
    if (!over) {
      over = { 
        key: key, 
        match_no: e.match_no, 
        team: e.bat_team, 
        bowler: e.bowler.name, // Capture bowler name from first ball of over/new over creation
        balls: [], 
        runs: e.total_runs, 
        wickets: e.wickets, 
        overNum: e.over + 1 
      };
      groupedOvers.push(over);
    }
    over.balls.push(e.is_wicket ? 'W' : e.runs_scored);
    over.runs = e.total_runs;
    over.wickets = e.wickets;
  });

  // Newest over first by reversing the grouped array
  const reversedOvers = [...groupedOvers].reverse();

  return (
    <div className="bg-slate-900 rounded-xl border border-slate-800 h-96 flex flex-col shadow-xl overflow-hidden">
      <div className="p-3 border-b border-slate-800 bg-slate-800 text-slate-400 text-xs font-bold uppercase tracking-widest flex justify-between items-center z-10 shrink-0">
        <span className="flex items-center gap-2">
           <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse"></span>
           Live Feed
        </span>
      </div>
      
      <div className="flex-1 overflow-y-auto p-4 scrollbar-hide space-y-4 relative bg-slate-950/50" style={{ overflowAnchor: 'auto' }}>
        {events.length === 0 && <div className="text-center text-slate-600 italic mt-32">Waiting for first ball...</div>}
        
        {reversedOvers.map((over, idx) => (
          <div key={over.key} className={`p-4 rounded-xl border bg-slate-900/50 border-slate-800 flex flex-col gap-3 transition-colors`}>
            
            <div className="flex justify-between items-center border-b border-white/5 pb-2">
              <div className="flex flex-col">
                <span className={`font-bold text-sm text-slate-400`}>OVER {over.overNum} <span className="text-[10px] text-slate-600 font-normal ml-1">Match {over.match_no}</span></span>
                <span className="text-[10px] uppercase font-bold text-slate-500">{over.team}</span>
                <span className="text-[10px] text-emerald-500/80 font-medium">Bowler: {over.bowler}</span>
              </div>
              <div className="text-right">
                 <span className="font-mono font-bold text-white text-lg">{over.runs}/{over.wickets}</span>
              </div>
            </div>

            <div className="flex flex-wrap gap-1.5 justify-start">
                {over.balls.map((b, j) => (
                  <span key={j} className={`w-8 h-8 flex items-center justify-center rounded-full text-xs font-bold font-mono border border-white/5
                    ${b === 'W' ? 'bg-rose-900/50 text-rose-200 border-rose-500/30' :
                      b === 6 ? 'bg-purple-900/50 text-purple-200 border-purple-500/30' :
                        b === 4 ? 'bg-emerald-900/50 text-emerald-200 border-emerald-500/30' :
                          'bg-slate-800 text-slate-400'}`}>
                    {b}
                  </span>
                ))}
            </div>
          </div>
        ))}
        {/* Anchor element to help browser heuristics if needed, but overflow-anchor usually works on container */}
      </div>
    </div>
  );
};

export default Commentary;
