'use client';

import { SeriesSummaryData } from '@/types';

interface SeriesSummaryProps {
  data: SeriesSummaryData;
}

const SeriesSummary = ({ data }: SeriesSummaryProps) => {
  if (!data || !data.summary) return null;

  let summaryText = "";
  let subText = "";

  const parseSummary = (sum: unknown) => {
    if (typeof sum === 'object') return sum;
    // Attempt to parse python-style string dictionary (e.g., "{'Team': 1}")
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

  if (typeof summaryObj === 'string') {
    summaryText = summaryObj;
  } else if (typeof summaryObj === 'object' && summaryObj !== null && 'scoreline' in summaryObj && typeof (summaryObj as { scoreline: unknown }).scoreline === 'string') {
        summaryText = (summaryObj as { scoreline: string }).scoreline;
    } else {
    // Parse object like {'India': 1, 'Australia': 0, 'Tie': 0}
    const entries = Object.entries(summaryObj).filter(([k]) => k !== 'Tie');
    if (entries.length >= 2) {
      const [team1, score1] = entries[0];
      const [team2, score2] = entries[1];
      const tie = (summaryObj['Tie'] as number) || 0;

      if ((score1 as number) > (score2 as number)) summaryText = `${team1} Wins Series`;
      else if ((score2 as number) > (score1 as number)) summaryText = `${team2} Wins Series`;
      else summaryText = "Series Drawn";

      subText = `${team1} (${score1}) - ${team2} (${score2})` + (tie > 0 ? ` | Ties: ${tie}` : "");
    } else {
      summaryText = "Series Concluded";
      subText = JSON.stringify(summaryObj);
    }
  }

  return (
    <div className="bg-gradient-to-r from-emerald-900/40 to-slate-900 border border-emerald-500/30 p-8 rounded-2xl text-center shadow-2xl relative overflow-hidden">
      <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-emerald-500 to-transparent opacity-50"></div>
      <h3 className="text-sm font-black text-emerald-500 uppercase tracking-[0.3em] mb-4">Series Summary</h3>
      <div className="text-3xl md:text-5xl font-black text-white drop-shadow-lg mb-2">
        {summaryText}
      </div>
      {subText && <div className="text-slate-400 font-mono text-lg">{subText}</div>}
    </div>
  );
};

export default SeriesSummary;
