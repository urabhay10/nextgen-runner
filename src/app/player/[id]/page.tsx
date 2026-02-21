'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Zap, Activity, TrendingUp, Target, Award } from 'lucide-react';
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

const StatCard = ({
  label, value, accent, sub,
}: {
  label: string;
  value: string | number | null | undefined;
  accent?: string;
  sub?: string;
}) => (
  <div
    className="flex flex-col gap-2 rounded-2xl p-5 relative overflow-hidden"
    style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}
  >
    {/* glow blob */}
    {accent && (
      <div className="absolute -top-4 -right-4 w-16 h-16 rounded-full opacity-20 blur-xl" style={{ background: accent }} />
    )}
    <span className="text-[9px] uppercase font-black tracking-widest relative z-10" style={{ color: 'var(--palm-leaf)' }}>{label}</span>
    <span className="text-3xl font-black font-mono tabular-nums relative z-10" style={{ color: accent ?? 'var(--foreground)' }}>
      {value ?? '—'}
    </span>
    {sub && <span className="text-[10px] relative z-10" style={{ color: 'var(--muted)' }}>{sub}</span>}
  </div>
);

const SectionHeader = ({ icon: Icon, label, color, colorRgb }: { icon: React.ElementType; label: string; color: string; colorRgb: string }) => (
  <div className="flex items-center gap-2 mb-5">
    <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: `rgba(${colorRgb}, 0.12)`, border: `1px solid rgba(${colorRgb}, 0.25)` }}>
      <Icon className="w-3.5 h-3.5" style={{ color }} />
    </div>
    <span className="text-xs font-black uppercase tracking-widest" style={{ color }}>{label}</span>
  </div>
);

// Inline mini-bar for visual ratio
const MiniBar = ({ value, max, color }: { value: number; max: number; color: string }) => (
  <div className="h-1 rounded-full mt-1 overflow-hidden" style={{ background: 'var(--border)' }}>
    <div className="h-full rounded-full" style={{ width: `${Math.min(100, (value / max) * 100)}%`, background: color }} />
  </div>
);

export default function PlayerPage() {
  const { id } = useParams<{ id: string }>();
  const [data, setData] = useState<PlayerStatsData | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!id) return;
    
    const fetchStats = async () => {
      try {
        const res = await fetch(getApiUrl(`/stats/player/${id}`), { cache: 'no-store' });
        if (!res.ok) throw new Error('Failed to fetch player stats');
        const data = await res.json();
        setData(data);
      } catch (error) {
        setError(true);
      }
    };

    fetchStats();
  }, [id]);

  if (error) return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-4" style={{ background: 'var(--background)', color: 'var(--muted)' }}>
      <span className="text-5xl font-black">404</span>
      <span className="font-mono text-sm">Player <span style={{ color: 'var(--foreground)' }}>#{id}</span> not found</span>
      <Link href="/players" className="text-xs hover:underline" style={{ color: 'var(--sage-green)' }}>← Back to Players</Link>
    </div>
  );

  if (!data) return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--background)' }}>
      <div className="w-8 h-8 rounded-full border-2 border-t-transparent animate-spin" style={{ borderColor: 'rgba(var(--sage-green-rgb), 0.25)', borderTopColor: 'var(--sage-green)' }} />
    </div>
  );

  const hasBowling = data.bowling && data.bowling.innings > 0;

  return (
    <div className="min-h-screen" style={{ background: 'var(--background)', color: 'var(--foreground)' }}>
      <div className="max-w-4xl mx-auto px-6 py-10 flex flex-col gap-12">

        {/* Hero header */}
        <div className="relative overflow-hidden rounded-2xl p-8" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
          <Link href="/players" className="absolute top-4 left-4 z-20 flex items-center gap-2 text-xs font-bold uppercase tracking-widest transition-colors hover:text-[var(--sage-green)]" style={{ color: 'var(--palm-leaf)' }}>
            <ArrowLeft className="w-4 h-4" /> Players
          </Link>
          {/* decorative gradient */}
          <div className="absolute inset-0 opacity-10 pointer-events-none"
            style={{ background: 'radial-gradient(ellipse at top right, var(--sage-green), transparent 60%)' }} />
          <div className="relative z-10 flex flex-col sm:flex-row sm:items-end justify-between gap-6 mt-6">
            <div>
              <p className="text-[10px] uppercase font-black tracking-[0.35em] mb-2" style={{ color: 'var(--palm-leaf)' }}>Player · #{data.id}</p>
              <h1 className="text-4xl md:text-5xl font-black tracking-tight text-[var(--foreground)] mb-4">{data.name}</h1>
              <div className="flex flex-wrap gap-2">
                <span className="text-[10px] font-black uppercase tracking-widest px-3 py-1 rounded-full" style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', color: 'var(--muted)' }}>
                  {data.matches} Matches
                </span>
                {data.can_bowl && (
                  <span className="text-[10px] font-black uppercase tracking-widest px-3 py-1 rounded-full" style={{ background: 'rgba(var(--sage-green-rgb), 0.06)', border: '1px solid rgba(var(--sage-green-rgb), 0.25)', color: 'var(--sage-green)' }}>
                    All-Rounder
                  </span>
                )}
                {!data.can_bowl && (
                  <span className="text-[10px] font-black uppercase tracking-widest px-3 py-1 rounded-full" style={{ background: 'rgba(var(--sandy-brown-rgb), 0.06)', border: '1px solid rgba(var(--sandy-brown-rgb), 0.25)', color: 'var(--sandy-brown)' }}>
                    Batter
                  </span>
                )}
              </div>
            </div>
            {/* Summary snapshot */}
            <div className="flex gap-4 sm:gap-6">
              <div className="text-center">
                <div className="text-3xl font-black font-mono tabular-nums" style={{ color: 'var(--sage-green)' }}>{data.batting.runs}</div>
                <div className="text-[9px] uppercase tracking-widest mt-1" style={{ color: 'var(--palm-leaf)' }}>Runs</div>
              </div>
              {hasBowling && data.bowling && (
                <div className="text-center">
                  <div className="text-3xl font-black font-mono tabular-nums" style={{ color: 'var(--sandy-brown)' }}>{data.bowling.wickets}</div>
                  <div className="text-[9px] uppercase tracking-widest mt-1" style={{ color: 'var(--palm-leaf)' }}>Wickets</div>
                </div>
              )}
              <div className="text-center">
                <div className="text-3xl font-black font-mono tabular-nums" style={{ color: 'var(--dry-sage)' }}>{data.batting.average?.toFixed(1)}</div>
                <div className="text-[9px] uppercase tracking-widest mt-1" style={{ color: 'var(--palm-leaf)' }}>Avg</div>
              </div>
            </div>
          </div>
          <div className="relative z-10 mt-6 h-px" style={{ background: 'linear-gradient(90deg, var(--sage-green), transparent)' }} />
        </div>

        {/* Batting */}
        <section>
          <SectionHeader icon={Activity} label="Batting" color="var(--sage-green)" colorRgb="var(--sage-green-rgb)" />
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
            <StatCard label="Runs"        value={data.batting.runs}                         accent="var(--sage-green)" sub={`${data.batting.innings} innings`} />
            <StatCard label="Average"     value={data.batting.average?.toFixed(2)}           accent="var(--dry-sage)" sub="per dismissal" />
            <StatCard label="Strike Rate" value={data.batting.strike_rate?.toFixed(1)}       accent="var(--sandy-brown)" sub="runs per 100 balls" />
            <StatCard label="Not Outs"    value={data.batting.not_outs}                      accent="var(--palm-leaf)" />
          </div>
          {/* Milestones */}
          <div
            className="grid grid-cols-3 divide-x rounded-2xl overflow-hidden"
            style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}
          >
            {[
              { label: '30s', value: data.batting['30s'], color: 'var(--palm-leaf)', icon: Target },
              { label: '50s', value: data.batting['50s'], color: 'var(--dry-sage)', icon: Award },
              { label: '100s', value: data.batting['100s'], color: 'var(--sage-green)', icon: TrendingUp },
            ].map((m, i) => {
              const Icon = m.icon;
              return (
                <div key={i} className="flex flex-col items-center justify-center gap-2 p-6" style={{ borderRight: i < 2 ? `1px solid var(--border)` : undefined }}>
                  <Icon className="w-5 h-5" style={{ color: m.color }} />
                  <span className="text-3xl font-black font-mono" style={{ color: m.color }}>{m.value}</span>
                  <span className="text-[9px] uppercase tracking-widest" style={{ color: 'var(--muted)' }}>{m.label}</span>
                  <MiniBar value={m.value} max={Math.max(data.batting['100s'], data.batting['50s'], data.batting['30s'], 1)} color={m.color} />
                </div>
              );
            })}
          </div>
        </section>

        {/* Bowling */}
        {hasBowling && data.bowling && (
          <section>
            <SectionHeader icon={Zap} label="Bowling" color="var(--sandy-brown)" colorRgb="var(--sandy-brown-rgb)" />
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
              <StatCard label="Wickets"    value={data.bowling.wickets}                          accent="var(--sandy-brown)" sub={`${data.bowling.innings} innings`} />
              <StatCard label="Economy"    value={data.bowling.economy?.toFixed(2)}               accent="var(--sage-green)" sub="runs per over" />
              <StatCard label="Average"    value={data.bowling.average?.toFixed(2) ?? '—'}        accent="var(--dry-sage)" sub="balls per wkt" />
              <StatCard label="Strike Rt"  value={data.bowling.strike_rate?.toFixed(1) ?? '—'}    accent="var(--muted-olive)" />
            </div>
            {/* Hauls */}
            <div
              className="grid grid-cols-2 divide-x rounded-2xl overflow-hidden"
              style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}
            >
              {[
                { label: '3-Wicket Hauls', value: data.bowling['3w'], color: 'var(--dry-sage)' },
                { label: '5-Wicket Hauls', value: data.bowling['5w'], color: 'var(--sandy-brown)' },
              ].map((m, i) => (
                <div key={i} className="flex flex-col items-center justify-center gap-1 p-6" style={{ borderRight: i === 0 ? `1px solid var(--border)` : undefined }}>
                  <span className="text-4xl font-black font-mono" style={{ color: m.color }}>{m.value}</span>
                  <span className="text-[9px] uppercase tracking-widest text-center" style={{ color: 'var(--muted)' }}>{m.label}</span>
                </div>
              ))}
            </div>
          </section>
        )}

      </div>
    </div>
  );
}
