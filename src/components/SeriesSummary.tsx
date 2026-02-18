'use client';

import React from 'react';

// Define strict types for our summary data structure
interface SeriesSummaryData {
  summary: any;
  // We'll populate these from the detailed match data accumulating
  matches?: any[];
  playerStats?: Record<string, any>;
}

interface SeriesSummaryProps {
  data: SeriesSummaryData;
}

const SeriesSummary = ({ data }: SeriesSummaryProps) => {
  if (!data || !data.summary) return null;

  // 1. Existing Summary Logic
  let summaryText = "";
  let subText = "";

  // Helper to parse potential stringified JSON
  const parseSummary = (sum: unknown) => {
    if (typeof sum === 'object') return sum;
    if (typeof sum === 'string' && sum.trim().startsWith('{')) {
      try {
        const jsonString = sum.replace(/'/g, '"');
        return JSON.parse(jsonString);
      } catch {
        return sum;
      }
    }
    return sum;
  };

  const summaryObj = parseSummary(data.summary) as Record<string, unknown>;

  // Determine Winner
  let winner = "";
  if (typeof summaryObj === 'string') {
    summaryText = summaryObj;
  } else if (typeof summaryObj === 'object' && summaryObj !== null && 'scoreline' in summaryObj && typeof (summaryObj as any).scoreline === 'string') {
        // Handle backend returning {scoreline: "{'TeamA': 1, ...}"}
        const inner = parseSummary((summaryObj as any).scoreline);
        if (typeof inner === 'object') {
             // process dictionary
            const entries = Object.entries(inner).filter(([k]) => k !== 'Tie');
            if (entries.length >= 2) {
                const [t1, s1] = entries[0];
                const [t2, s2] = entries[1];
                const tie = (inner as any)['Tie'] || 0;
                
                if ((s1 as number) > (s2 as number)) { summaryText = `${t1} Wins`; winner = t1; }
                else if ((s2 as number) > (s1 as number)) { summaryText = `${t2} Wins`; winner = t2; }
                else summaryText = "Series Drawn";
                
                subText = `${t1} ${s1} - ${s2} ${t2}` + (tie > 0 ? ` (${tie} ties)` : "");
            }
        } else {
             summaryText = (summaryObj as any).scoreline;
        }
    } else {
    // Parse directly as object {'India': 1, ...}
    const entries = Object.entries(summaryObj).filter(([k]) => k !== 'Tie');
    if (entries.length >= 2) {
      const [team1, score1] = entries[0];
      const [team2, score2] = entries[1];
      const tie = (summaryObj['Tie'] as number) || 0;

      if ((score1 as number) > (score2 as number)) { summaryText = `${team1} Wins Series`; winner = team1; }
      else if ((score2 as number) > (score1 as number)) { summaryText = `${team2} Wins Series`; winner = team2; }
      else summaryText = "Series Drawn";

      subText = `${team1} (${score1}) - ${team2} (${score2})` + (tie > 0 ? ` | Ties: ${tie}` : "");
    } else {
      summaryText = "Series Concluded";
      subText = JSON.stringify(summaryObj);
    }
  }

  // Calculate detailed stats from matches if available
  const matches = data.matches || [];
  const avgScore = matches.length > 0 
    ? Math.round(matches.reduce((acc, m) => {
        // Parse "180/4" -> 180
        const getRuns = (s: string) => parseInt(s?.split('/')[0] || "0");
        const s1 = getRuns(Object.values(m.scorecard)[0] ? (Object.values(m.scorecard)[0] as any).score : "0");
        const s2 = getRuns(Object.values(m.scorecard)[1] ? (Object.values(m.scorecard)[1] as any).score : "0");
        return acc + s1 + s2;
      }, 0) / (matches.length * 2))
    : 0;

  const topRunScorer = matches.length > 0 ? (() => {
      const players: Record<string, number> = {};
      matches.forEach(m => {
          Object.values(m.scorecard).forEach((team: any) => {
              team.batting.forEach((p: any) => {
                  players[p.name] = (players[p.name] || 0) + p.runs;
              });
          });
      });
      const sorted = Object.entries(players).sort(([,a], [,b]) => b - a);
      return sorted.length > 0 ? { name: sorted[0][0], runs: sorted[0][1] } : null;
  })() : null;

  // Calculate Top 5 Batters
  const topBatters = matches.length > 0 ? (() => {
      const players: Record<string, {runs: number, balls: number, innings: number, dismissals: number}> = {};
      matches.forEach(m => {
          Object.values(m.scorecard).forEach((team: any) => {
              team.batting.forEach((p: any) => {
                  if (!players[p.name]) players[p.name] = {runs: 0, balls: 0, innings: 0, dismissals: 0};
                  players[p.name].runs += p.runs;
                  players[p.name].balls += p.balls;
                  players[p.name].innings += 1;
                  if (p.out) players[p.name].dismissals += 1;
              });
          });
      });
      return Object.entries(players)
          .sort(([,a], [,b]) => b.runs - a.runs)
          .slice(0, 5)
          .map(([name, stats]) => {
              const avg = stats.dismissals > 0 ? (stats.runs / stats.dismissals).toFixed(1) : stats.runs.toString();
              const sr = stats.balls > 0 ? ((stats.runs / stats.balls) * 100).toFixed(1) : "0.0";
              return { name, ...stats, avg, sr };
          });
  })() : [];

  // Calculate Top 5 Bowlers
  const topBowlers = matches.length > 0 ? (() => {
      const players: Record<string, {wickets: number, runs: number, balls: number, innings: number}> = {};
      matches.forEach(m => {
          Object.values(m.scorecard).forEach((team: any) => {
              team.bowling.forEach((p: any) => {
                  if (!players[p.name]) players[p.name] = {wickets: 0, runs: 0, balls: 0, innings: 0};
                  players[p.name].wickets += p.wickets;
                  players[p.name].runs += p.runs_given || 0;
                  // If p.balls is available use it, else if overs is available convert to balls
                  const balls = p.balls || (p.overs ? p.overs * 6 : 0);
                  players[p.name].balls += balls; 
                  players[p.name].innings += 1;
              });
          });
      });
      return Object.entries(players)
          .sort(([,a], [,b]) => b.wickets - a.wickets || a.runs - b.runs) // Sort by wickets desc, then runs conceded asc
          .slice(0, 5)
          .map(([name, stats]) => {
              const overs = (stats.balls / 6).toFixed(1);
              const eco = stats.balls > 0 ? ((stats.runs / stats.balls) * 6).toFixed(1) : "0.0";
              const sr = stats.wickets > 0 ? (stats.balls / stats.wickets).toFixed(1) : "-";
              const avg = stats.wickets > 0 ? (stats.runs / stats.wickets).toFixed(1) : "-";
              return { name, ...stats, overs, eco, finalSR: sr, avg };
          });
  })() : [];

  return (
    <div className="bg-gradient-to-br from-slate-900 to-slate-950 border border-slate-800 p-4 rounded-xl shadow-xl flex flex-col gap-3 h-full overflow-y-auto max-h-[500px] scrollbar-thin scrollbar-thumb-slate-700">
      <div className="text-center pb-3 border-b border-slate-800">
        <h3 className="text-[10px] font-black text-emerald-500 uppercase tracking-[0.2em] mb-1">Series Result</h3>
        <div className="text-lg font-black text-white drop-shadow-md leading-none mb-1">
          {summaryText}
        </div>
        {subText && <div className="text-slate-500 font-mono text-[10px]">{subText}</div>}
      </div>

      {matches.length > 0 && (
          <div className="space-y-4">
              <div className="bg-slate-800/50 p-2 rounded text-center">
                  <div className="text-[10px] text-slate-400 uppercase">Avg Score per Innings</div>
                  <div className="text-sm font-bold text-white">{avgScore}</div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                 {/* Top Batters */}
                 <div className="bg-slate-800/30 p-2 rounded">
                    <h4 className="text-[10px] font-bold text-slate-400 uppercase mb-2 border-b border-slate-700 pb-1">Top Batters</h4>
                    <div className="grid grid-cols-5 text-[9px] text-slate-500 uppercase mb-1 text-right">
                        <div className="col-span-1 text-left">Name</div>
                        <div>Inn</div>
                        <div>Runs</div>
                        <div>Avg</div>
                        <div>SR</div>
                    </div>
                    <ul className="space-y-1">
                       {topBatters.map((p, i) => (
                           <li key={i} className="grid grid-cols-5 text-[10px] text-right">
                               <span className="col-span-1 text-slate-300 truncate text-left" title={p.name}>{p.name}</span>
                               <span className="text-slate-400">{p.innings}</span>
                               <span className="font-mono text-emerald-400">{p.runs}</span>
                               <span className="text-slate-400">{p.avg}</span>
                               <span className="text-slate-400">{p.sr}</span>
                           </li>
                       ))}
                    </ul>
                 </div>

                 {/* Top Bowlers */}
                 <div className="bg-slate-800/30 p-2 rounded">
                    <h4 className="text-[10px] font-bold text-slate-400 uppercase mb-2 border-b border-slate-700 pb-1">Top Bowlers</h4>
                    <div className="grid grid-cols-5 text-[9px] text-slate-500 uppercase mb-1 text-right">
                        <div className="col-span-1 text-left">Name</div>
                        <div>Wkts</div>
                        <div>Eco</div>
                        <div>Avg</div>
                        <div>SR</div>
                    </div>
                     <ul className="space-y-1">
                       {topBowlers.map((p, i) => (
                           <li key={i} className="grid grid-cols-5 text-[10px] text-right">
                               <span className="col-span-1 text-slate-300 truncate text-left" title={p.name}>{p.name}</span>
                               <span className="font-mono text-purple-400">{p.wickets}</span>
                               <span className="text-slate-400">{p.eco}</span>
                               <span className="text-slate-400">{p.avg}</span>
                               <span className="text-slate-400">{p.finalSR}</span>
                           </li>
                       ))}
                    </ul>
                 </div>
              </div>

              <div className="space-y-1">
                  <h4 className="text-[10px] font-bold text-slate-500 uppercase">Match Log</h4>
                  {matches.map((m, i) => {
                      const teams = Object.keys(m.scorecard);
                      const t1 = teams[0];
                      const t2 = teams[1];
                      const s1 = m.scorecard[t1].score;
                      const s2 = m.scorecard[t2].score;
                      
                      return (
                      <div key={i} className="flex flex-col gap-0.5 text-[10px] bg-slate-800/30 p-2 rounded hover:bg-slate-800/60 transition">
                          <div className="flex justify-between border-b border-slate-700/50 pb-0.5 mb-0.5">
                             <span className="text-slate-500 font-bold">Match {m.match_no}</span>
                             <span className="text-emerald-400 font-bold">{m.winner === 'Tie' ? 'TIE' : m.winner}</span>
                          </div>
                          <div className="flex justify-between items-center text-slate-300">
                              <span>{t1} <span className="text-slate-400 ml-1">{s1}</span></span>
                              <span className="text-slate-600 text-[8px]">vs</span>
                              <span>{t2} <span className="text-slate-400 ml-1">{s2}</span></span>
                          </div>
                          <div className="text-[9px] text-slate-500 italic mt-0.5 text-right">{m.margin === 'Tie' ? 'Scores Level' : `Won by ${m.margin}`}</div>
                      </div>
                  )})}
              </div>
          </div>
      )}
    </div>
  );
};

export default SeriesSummary;
