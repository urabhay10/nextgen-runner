'use client';

import { useState } from 'react';
import { Loader2, RefreshCw, AlertCircle } from 'lucide-react';

interface BowlingOrderEditorProps {
  teamName: string;
  players: string[];
  eligibleBowlers?: string[];
  bowlingOrder: string[];
  onOrderChange: (order: string[]) => void;
  onDefault: () => void;
  loading: boolean;
}

const BowlingOrderEditor = ({ teamName, players, eligibleBowlers, bowlingOrder, onOrderChange, onDefault, loading }: BowlingOrderEditorProps) => {
  const [error, setError] = useState<string | null>(null);

  const getStats = () => {
    const stats: Record<string, number> = {};
    let assignedCount = 0;
    bowlingOrder.forEach(p => {
      if (p) {
        stats[p] = (stats[p] || 0) + 1;
        assignedCount++;
      }
    });
    return { stats, assignedCount };
  };

  const { stats, assignedCount } = getStats();
  const isComplete = assignedCount === 20;

  const handleBowlerChange = (overIndex: number, bowlerName: string) => {
    // Basic validation could go here, but we allow any player for now
    const newOrder = [...bowlingOrder];
    newOrder[overIndex] = bowlerName;
    onOrderChange(newOrder);
  };

  const bowlersList = (eligibleBowlers && eligibleBowlers.length > 0) ? eligibleBowlers : players.filter(p => p.trim() !== "");

  return (
    <div className="bg-slate-900/50 p-6 rounded-2xl border border-slate-800">
      <div className="flex justify-between items-center mb-6">
        <div className="flex flex-col">
          <h3 className="text-lg font-bold text-slate-300">Bowling Order: <span className="text-emerald-400">{teamName}</span></h3>
          <span className={`text-xs ${isComplete ? 'text-emerald-500' : 'text-amber-500'}`}>
            {assignedCount}/20 overs assigned
          </span>
        </div>
        <button 
          onClick={onDefault}
          disabled={loading}
          className="text-xs flex items-center gap-2 px-3 py-1.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-400 transition disabled:opacity-50"
        >
          {loading ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />}
          Reset to Default
        </button>
      </div>

      {error && (
        <div className="mb-4 p-3 bg-rose-500/10 border border-rose-500/20 text-rose-400 rounded text-sm flex items-center gap-2">
          <AlertCircle className="w-4 h-4" /> {error}
        </div>
      )}

      {/* Bowler Stats Summary */}
      <div className="mb-6 flex flex-wrap gap-2">
        {Object.entries(stats).map(([player, overs]) => (
          <div key={player} className={`text-xs px-2 py-1 rounded border ${overs > 4 ? 'bg-rose-500/20 border-rose-500 text-rose-300' : 'bg-slate-800 border-slate-700 text-slate-400'}`}>
            {player}: <span className="font-bold text-white">{overs}</span>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-3">
        {Array.from({ length: 20 }).map((_, i) => (
          <div key={i} className="flex flex-col gap-1">
            <div className="flex justify-between text-[10px] font-bold text-slate-600 uppercase">
               <span>Over {i + 1}</span>
               {bowlingOrder[i] && (stats[bowlingOrder[i]] > 4) && <span className="text-rose-500">Exceeds Limit</span>}
            </div>
            <select
              value={bowlingOrder[i] || ""}
              onChange={(e) => handleBowlerChange(i, e.target.value)}
              className={`bg-slate-950 border rounded px-2 py-1.5 text-xs text-slate-300 outline-none w-full ${bowlingOrder[i] && stats[bowlingOrder[i]] > 4 ? 'border-rose-500 focus:border-rose-500' : 'border-slate-800 focus:border-emerald-500'}`}
            >
              <option value="" disabled>Select Bowler</option>
              {bowlersList.map((p, idx) => (
                <option key={idx} value={p}>
                  {p}
                </option>
              ))}
            </select>
          </div>
        ))}
      </div>
      
      <div className="mt-4 text-[10px] text-slate-500 text-center">
        * Standard T20 rules: max 4 overs per bowler. Total 20 overs.
      </div>
    </div>
  );
};

export default BowlingOrderEditor;
