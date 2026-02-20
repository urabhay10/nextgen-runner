'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Zap, Activity } from 'lucide-react';
import { getApiUrl } from '@/lib/api';

interface PlayerStatsData {
  id: number;
  name: string;
  can_bowl: boolean;
  matches: number;
  batting: {
    innings: number;
    runs: number;
    balls: number;
    average: number;
    strike_rate: number;
    not_outs: number;
    dismissals: number;
    '30s': number;
    '50s': number;
    '100s': number;
  };
  bowling: {
    innings: number;
    overs: number;
    runs_conceded: number;
    wickets: number;
    average: number | null;
    strike_rate: number | null;
    economy: number | null;
    '3w': number;
    '5w': number;
  } | null;
}

const Stat = ({ label, value, accent }: { label: string; value: string | number | null | undefined; accent?: string }) => (
  <div className="flex flex-col gap-1 bg-slate-900/60 border border-slate-800 rounded-xl p-4">
    <span className="text-[9px] uppercase font-black tracking-widest text-slate-500">{label}</span>
    <span className={`text-2xl font-black font-mono tabular-nums ${accent ?? 'text-white'}`}>
      {value ?? '—'}
    </span>
  </div>
);

export default function PlayerPage() {
  const { id } = useParams<{ id: string }>();
  const [data, setData] = useState<PlayerStatsData | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    fetch(getApiUrl(`/players/${id}`))
      .then(r => { if (!r.ok) throw new Error(); return r.json(); })
      .then(setData)
      .catch(() => setError(true));
  }, [id]);

  if (error) return (
    <div className="min-h-screen bg-[#0f172a] flex flex-col items-center justify-center gap-4 text-slate-500">
      <span className="text-4xl font-black">404</span>
      <span className="font-mono">Player <span className="text-white">#{id}</span> not found</span>
      <Link href="/" className="text-sm text-slate-400 hover:text-white underline">← Back to Home</Link>
    </div>
  );

  if (!data) return (
    <div className="min-h-screen bg-[#0f172a] flex items-center justify-center">
      <div className="w-8 h-8 border-2 border-cyan-500/30 border-t-cyan-400 rounded-full animate-spin" />
    </div>
  );

  const hasBowling = data.bowling && data.bowling.innings > 0;

  return (
    <div className="min-h-screen bg-[#0f172a] text-white p-6 max-w-3xl mx-auto">
      {/* Back */}
      <Link href="/" className="inline-flex items-center gap-2 text-slate-500 hover:text-white transition text-sm font-bold mb-8">
        <ArrowLeft className="w-4 h-4" /> Back
      </Link>

      {/* Header */}
      <div className="mb-10">
        <h1 className="text-4xl font-black tracking-tight">{data.name}</h1>
        <div className="flex items-center gap-3 mt-2">
          <span className="text-[10px] uppercase font-black tracking-widest text-slate-500 bg-slate-800 px-3 py-1 rounded-full border border-slate-700">
            {data.matches} Matches
          </span>
          {data.can_bowl && (
            <span className="text-[10px] uppercase font-black tracking-widest text-emerald-400 bg-emerald-500/10 px-3 py-1 rounded-full border border-emerald-500/20">
              Bowling
            </span>
          )}
        </div>
        {/* Accent bar */}
        <div className="mt-6 h-px bg-gradient-to-r from-cyan-500 via-blue-500 to-transparent" />
      </div>

      {/* Batting */}
      <section className="mb-10">
        <div className="flex items-center gap-2 mb-4">
          <Activity className="w-4 h-4 text-emerald-400" />
          <h2 className="text-xs uppercase font-black tracking-widest text-emerald-400">Batting</h2>
        </div>
        <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
          <Stat label="Innings" value={data.batting.innings} />
          <Stat label="Runs" value={data.batting.runs} accent="text-emerald-400" />
          <Stat label="Average" value={data.batting.average?.toFixed(1)} accent="text-cyan-400" />
          <Stat label="Strike Rate" value={data.batting.strike_rate?.toFixed(1)} accent="text-yellow-400" />
          <Stat label="Not Outs" value={data.batting.not_outs} />
          <Stat label="50s" value={data.batting['50s']} accent="text-blue-400" />
          <Stat label="100s" value={data.batting['100s']} accent="text-indigo-400" />
          <Stat label="30s" value={data.batting['30s']} />
        </div>
      </section>

      {/* Bowling */}
      {hasBowling && data.bowling && (
        <section>
          <div className="flex items-center gap-2 mb-4">
            <Zap className="w-4 h-4 text-rose-400" />
            <h2 className="text-xs uppercase font-black tracking-widest text-rose-400">Bowling</h2>
          </div>
          <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
            <Stat label="Innings" value={data.bowling.innings} />
            <Stat label="Wickets" value={data.bowling.wickets} accent="text-rose-400" />
            <Stat label="Average" value={data.bowling.average?.toFixed(1)} />
            <Stat label="Economy" value={data.bowling.economy?.toFixed(2)} accent="text-orange-400" />
            <Stat label="Strike Rate" value={data.bowling.strike_rate?.toFixed(1)} />
            <Stat label="Overs" value={data.bowling.overs} />
            <Stat label="3W" value={data.bowling['3w']} />
            <Stat label="5W" value={data.bowling['5w']} accent="text-yellow-400" />
          </div>
        </section>
      )}
    </div>
  );
}
