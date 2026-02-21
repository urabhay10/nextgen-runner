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
    <div className="bg-[var(--surface)] rounded-xl border border-[var(--border)] h-96 flex flex-col shadow-xl overflow-hidden">
      <div className="p-3 border-b border-[var(--border)] bg-[var(--surface-2)] text-[var(--muted)] text-xs font-bold uppercase tracking-widest flex justify-between items-center z-10 shrink-0">
        <span className="flex items-center gap-2">
           <span className="w-2 h-2 rounded-full bg-[var(--sandy-brown)] animate-pulse"></span>
           Live Feed
        </span>
      </div>
      
      <div className="flex-1 overflow-y-auto p-4 scrollbar-hide space-y-4 relative bg-[rgba(var(--background-rgb),0.5)]" style={{ overflowAnchor: 'auto' }}>
        {events.length === 0 && <div className="text-center text-[var(--muted)] italic mt-32">Waiting for first ball...</div>}
        
        {reversedOvers.map((over, idx) => (
          <div key={over.key} className={`p-4 rounded-xl border bg-[rgba(var(--surface-rgb),0.5)] border-[var(--border)] flex flex-col gap-3 transition-colors`}>
            
            <div className="flex justify-between items-center border-b border-[rgba(var(--foreground-rgb),0.05)] pb-2">
              <div className="flex flex-col">
                <span className={`font-bold text-sm text-[var(--muted)]`}>OVER {over.overNum} <span className="text-[10px] text-[var(--muted)] font-normal ml-1">Match {over.match_no}</span></span>
                <span className="text-[10px] uppercase font-bold text-[var(--muted)]">{over.team}</span>
                <span className="text-[10px] text-[rgba(var(--sage-green-rgb),0.8)] font-medium">Bowler: {over.bowler}</span>
              </div>
              <div className="text-right">
                 <span className="font-mono font-bold text-[var(--foreground)] text-lg">{over.runs}/{over.wickets}</span>
              </div>
            </div>

            <div className="flex flex-wrap gap-1.5 justify-start">
                {over.balls.map((b, j) => (
                  <span key={j} className={`w-8 h-8 flex items-center justify-center rounded-full text-xs font-bold font-mono border border-[rgba(var(--foreground-rgb),0.05)]
                    ${b === 'W' ? 'bg-[rgba(var(--sandy-brown-rgb),0.2)] text-[var(--sandy-brown)] border-[rgba(var(--sandy-brown-rgb),0.3)]' :
                      b === 6 ? 'bg-[rgba(var(--sage-green-rgb),0.2)] text-[var(--sage-green)] border-[rgba(var(--sage-green-rgb),0.3)]' :
                        b === 4 ? 'bg-[rgba(var(--muted-olive-rgb),0.2)] text-[var(--muted-olive)] border-[rgba(var(--muted-olive-rgb),0.3)]' :
                          'bg-[var(--surface-2)] text-[var(--muted)]'}`}>
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
