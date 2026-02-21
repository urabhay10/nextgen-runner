'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, TrendingUp, Zap, Award, Target, BarChart2 } from 'lucide-react';
import { getApiUrl } from '@/lib/api';
import { teamFlag } from '@/lib/flags';
import PlayerLink from '@/components/PlayerLink';

// ── Config (mirrors players/page.tsx) ──────────────────────────────────────

const ALL_BOARDS: Record<string, Record<string, {
  label: string;
  icon: React.ComponentType<{ className?: string; style?: React.CSSProperties }>;
  color: string;
  colorRgb: string;
  unit: string;
  isQuantitative: boolean;
  defaultMinInnings?: number;
  type: 'batting' | 'bowling';
}>> = {
  batting: {
    runs:         { label: 'Most Runs',           icon: TrendingUp, color: 'var(--sage-green)',   colorRgb: 'var(--sage-green-rgb)',   unit: 'runs', isQuantitative: true,  type: 'batting' },
    average:      { label: 'Best Average',         icon: Award,      color: 'var(--sandy-brown)', colorRgb: 'var(--sandy-brown-rgb)', unit: 'avg',  isQuantitative: false, defaultMinInnings: 25, type: 'batting' },
    strike_rate:  { label: 'Best Strike Rate',     icon: Zap,        color: 'var(--dry-sage)',    colorRgb: 'var(--dry-sage-rgb)',    unit: 'SR',   isQuantitative: false, defaultMinInnings: 50, type: 'batting' },
    '50s':        { label: 'Most Fifties',         icon: BarChart2,  color: 'var(--palm-leaf)',   colorRgb: 'var(--palm-leaf-rgb)',   unit: '50s',  isQuantitative: true,  type: 'batting' },
  },
  bowling: {
    wickets:      { label: 'Most Wickets',         icon: Zap,        color: 'var(--sandy-brown)', colorRgb: 'var(--sandy-brown-rgb)', unit: 'wkts', isQuantitative: true,  type: 'bowling' },
    average:      { label: 'Best Average',         icon: Target,     color: 'var(--sage-green)',  colorRgb: 'var(--sage-green-rgb)',  unit: 'avg',  isQuantitative: false, defaultMinInnings: 25, type: 'bowling' },
    strike_rate:  { label: 'Best Strike Rate',     icon: Zap,        color: 'var(--dry-sage)',    colorRgb: 'var(--dry-sage-rgb)',    unit: 'SR',   isQuantitative: false, defaultMinInnings: 50, type: 'bowling' },
    '3w':         { label: 'Most 3-Wicket Hauls',  icon: Award,      color: 'var(--palm-leaf)',   colorRgb: 'var(--palm-leaf-rgb)',   unit: '3w',   isQuantitative: true,  type: 'bowling' },
  },
};

const PAGE_SIZE = 25;

interface LeaderboardEntry {
  rank: number;
  name: string;
  id?: number;
  matches?: number;
  teams?: string[];
  [key: string]: any;
}

// ── Page ───────────────────────────────────────────────────────────────────

export default function LeaderboardPage() {
  const params = useParams<{ type: string; key: string }>();
  const searchParams = useSearchParams();

  const type = params.type as 'batting' | 'bowling';
  const key = params.key;
  const cfg = ALL_BOARDS[type]?.[key];

  const initMinInnings =
    parseInt(searchParams.get('min_innings') ?? '') ||
    cfg?.defaultMinInnings ||
    (type === 'batting' ? 8 : 5);

  const [minInnings, setMinInnings] = useState(initMinInnings);
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [total, setTotal] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const sentinelRef = useRef<HTMLDivElement | null>(null);

  // Refs always tracking latest values — observer closure reads these directly
  const offsetRef = useRef(0);
  const isFetchingRef = useRef(false);
  const initialLoadingRef = useRef(true);
  const hasMoreRef = useRef(true);
  const fetchKeyRef = useRef('');
  const minInningsRef = useRef(minInnings);

  // Keep refs in sync with state
  useEffect(() => { minInningsRef.current = minInnings; }, [minInnings]);

  const hasMore = total === null || entries.length < total;
  hasMoreRef.current = hasMore;

  // ── Fetch helper ─────────────────────────────────────────────────────────
  const fetchPage = useCallback(async (currentOffset: number, currentMinInnings: number, reset = false) => {
    if (isFetchingRef.current) return;
    if (!cfg) return;
    isFetchingRef.current = true;
    setLoading(true);

    const thisKey = `${key}|${type}|${currentMinInnings}`;
    fetchKeyRef.current = thisKey;

    const inningsParam = cfg.isQuantitative ? 1 : currentMinInnings;
    const url = getApiUrl(
      `/stats/leaderboard/${type}?sort_by=${key}&limit=${PAGE_SIZE}&offset=${currentOffset}&min_innings=${inningsParam}`
    );
    try {
      const res = await fetch(url, { cache: 'no-store' });
      const data = await res.json();
      if (fetchKeyRef.current !== thisKey) return;
      const newEntries: LeaderboardEntry[] = data.leaderboard ?? [];
      const newOffset = currentOffset + newEntries.length;
      setTotal(data.total ?? null);
      setEntries(prev => reset ? newEntries : [...prev, ...newEntries]);
      offsetRef.current = newOffset;
    } catch {
      // ignore
    } finally {
      isFetchingRef.current = false;
      setLoading(false);
      if (reset) { initialLoadingRef.current = false; setInitialLoading(false); }
    }
  }, [cfg, key, type]);

  // ── Reset + initial fetch when filter/key changes ─────────────────────────
  useEffect(() => {
    // Reset all state and refs synchronously
    setEntries([]);
    setTotal(null);
    setLoading(false);
    setInitialLoading(true);
    offsetRef.current = 0;
    isFetchingRef.current = false;
    initialLoadingRef.current = true;
    fetchPage(0, minInnings, true);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, type, minInnings]);

  // ── Single stable IntersectionObserver — reads refs, never re-registers ──
  useEffect(() => {
    const observer = new IntersectionObserver(
      (ioEntries) => {
        if (
          ioEntries[0].isIntersecting &&
          hasMoreRef.current &&
          !isFetchingRef.current &&
          !initialLoadingRef.current
        ) {
          fetchPage(offsetRef.current, minInningsRef.current);
        }
      },
      { threshold: 0.1 }
    );
    if (sentinelRef.current) observer.observe(sentinelRef.current);
    return () => observer.disconnect();
  // Only re-register if sentinel DOM node or fetchPage changes (stable)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fetchPage]);

  if (!cfg) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--background)', color: 'var(--foreground)' }}>
        <div className="text-center">
          <p className="text-lg font-black mb-2">Unknown leaderboard</p>
          <Link href="/players" className="text-sm underline" style={{ color: 'var(--sage-green)' }}>← Back to Players</Link>
        </div>
      </div>
    );
  }

  const Icon = cfg.icon;
  const topEntry = entries[0];

  return (
    <div className="min-h-screen" style={{ background: 'var(--background)', color: 'var(--foreground)' }}>
      <div className="max-w-3xl mx-auto px-6 py-10 flex flex-col gap-8">

        {/* Back nav */}
        <Link
          href="/players"
          className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest transition-colors hover:text-[var(--sage-green)] w-fit"
          style={{ color: 'var(--palm-leaf)' }}
        >
          <ArrowLeft className="w-4 h-4" /> Players Hub
        </Link>

        {/* Header */}
        <div>
          <div className="flex items-center gap-3 mb-2">
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center"
              style={{ background: `rgba(${cfg.colorRgb}, 0.12)`, border: `1px solid rgba(${cfg.colorRgb}, 0.25)` }}
            >
              <Icon className="w-5 h-5" style={{ color: cfg.color }} />
            </div>
            <div>
              <p className="text-[10px] uppercase font-black tracking-[0.3em]" style={{ color: 'var(--palm-leaf)' }}>{type}</p>
              <h1 className="text-3xl font-black tracking-tighter">{cfg.label}</h1>
            </div>
          </div>
          {total !== null && (
            <p className="text-xs mt-1" style={{ color: 'var(--muted)' }}>
              {total.toLocaleString()} players ranked
            </p>
          )}
        </div>

        {/* Min innings filter */}
        {!cfg.isQuantitative && (
          <div className="flex items-center gap-3 px-4 py-3 rounded-xl w-fit" style={{ background: 'var(--surface-2)', border: '1px solid var(--border)' }}>
            <label className="text-[10px] uppercase font-black tracking-widest" style={{ color: 'var(--muted)' }}>Min Innings</label>
            <input
              type="number"
              min={1}
              value={minInnings}
              onChange={e => setMinInnings(Math.max(1, parseInt(e.target.value) || 1))}
              className="w-14 bg-transparent text-sm font-bold text-center outline-none border-b border-dashed transition-colors focus:border-[var(--foreground)]"
              style={{ color: 'var(--foreground)', borderColor: 'var(--muted)' }}
            />
          </div>
        )}

        {/* Leaderboard list */}
        <div className="flex flex-col gap-1">
          {initialLoading
            ? Array.from({ length: 10 }).map((_, i) => (
                <div key={i} className="h-12 rounded-xl animate-pulse" style={{ background: 'var(--surface-2)' }} />
              ))
            : entries.map((entry) => {
                const val = entry[key];
                const isTop = entry.rank === 1;
                const pct = topEntry ? Math.round(((val ?? 0) / (topEntry[key] ?? 1)) * 100) : 0;
                return (
                  <div
                    key={`${entry.rank}-${entry.name}`}
                    className="rounded-xl px-4 py-3 flex items-center gap-4"
                    style={{
                      background: isTop ? `rgba(${cfg.colorRgb}, 0.07)` : 'var(--surface)',
                      border: `1px solid ${isTop ? `rgba(${cfg.colorRgb}, 0.2)` : 'var(--border)'}`,
                    }}
                  >
                    {/* Rank */}
                    <span
                      className="flex-none w-7 text-center text-sm font-black font-mono"
                      style={{ color: isTop ? cfg.color : entry.rank <= 3 ? 'var(--sandy-brown)' : 'var(--muted)' }}
                    >
                      {isTop ? '①' : entry.rank <= 3 ? ['②', '③'][entry.rank - 2] : entry.rank}
                    </span>

                    {/* Flag */}
                    <span
                      className="flex-none text-xl leading-none"
                      title={(entry.teams?.find((t: string) => t !== 'ICC World XI') ?? entry.teams?.[0]) ?? ''}
                    >
                      {teamFlag(entry.teams)}
                    </span>

                    {/* Name + bar */}
                    <div className="flex-1 min-w-0">
                      <PlayerLink name={entry.name} id={entry.id}>
                        <span className="text-sm font-bold hover:text-[var(--sage-green)] transition-colors truncate block cursor-pointer">
                          {entry.name}
                        </span>
                      </PlayerLink>
                      <div className="mt-1.5 h-0.5 rounded-full overflow-hidden" style={{ background: 'var(--border)' }}>
                        <div
                          className="h-full rounded-full transition-all duration-500"
                          style={{ width: `${pct}%`, background: cfg.color }}
                        />
                      </div>
                    </div>

                    {/* Stat value */}
                    <div className="flex-none text-right">
                      <span className="text-lg font-black font-mono tabular-nums" style={{ color: cfg.color }}>
                        {typeof val === 'number'
                          ? key === 'average' || key === 'strike_rate' || key === 'economy'
                            ? val.toFixed(1)
                            : val
                          : val ?? '—'}
                      </span>
                      <span className="text-[9px] ml-0.5 font-normal block" style={{ color: 'var(--muted)' }}>{cfg.unit}</span>
                    </div>
                  </div>
                );
              })}
        </div>

        {/* Sentinel + spinner */}
        <div ref={sentinelRef} className="flex justify-center py-6">
          {loading && !initialLoading && (
            <div
              className="w-6 h-6 rounded-full border-2 border-t-transparent animate-spin"
              style={{ borderColor: `rgba(${cfg.colorRgb}, 0.25)`, borderTopColor: cfg.color }}
            />
          )}
          {!hasMore && !initialLoading && entries.length > 0 && (
            <p className="text-[10px] uppercase font-black tracking-widest" style={{ color: 'var(--border)' }}>
              All {total?.toLocaleString()} players shown
            </p>
          )}
        </div>

      </div>
    </div>
  );
}
