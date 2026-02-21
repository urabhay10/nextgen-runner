'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import Link from 'next/link';
import { ArrowLeft, Search, TrendingUp, Zap, Award, Target, BarChart2, ChevronRight } from 'lucide-react';
import { getApiUrl } from '@/lib/api';

// ── Types ──────────────────────────────────────────────────────────────────

interface LeaderboardEntry {
  rank: number;
  name: string;
  id?: number;
  matches?: number;
  [key: string]: any;
}

interface LeaderboardData {
  sort_by: string;
  leaderboard: LeaderboardEntry[];
}

interface SearchResult {
  name: string;
  matches: number;
  runs: number | null;
  wickets: number | null;
  id?: number;
}

// ── Config for the 5 leaderboards ─────────────────────────────────────────

const BATTING_BOARDS = [
  { key: 'runs',         label: 'Most Runs',        icon: TrendingUp, color: 'var(--sage-green)',   colorRgb: 'var(--sage-green-rgb)',   unit: 'runs', isQuantitative: true },
  { key: 'average',      label: 'Best Average',      icon: Award,      color: 'var(--sandy-brown)', colorRgb: 'var(--sandy-brown-rgb)', unit: 'avg',  isQuantitative: false, defaultMinInnings: 25 },
  { key: 'strike_rate',  label: 'Best Strike Rate',  icon: Zap,        color: 'var(--dry-sage)',    colorRgb: 'var(--dry-sage-rgb)',    unit: 'SR',   isQuantitative: false, defaultMinInnings: 50 },
  { key: '50s',          label: 'Most Fifties',      icon: BarChart2,  color: 'var(--palm-leaf)',   colorRgb: 'var(--palm-leaf-rgb)',   unit: '50s',  isQuantitative: true },
  { key: '100s',         label: 'Most Hundreds',     icon: Target,     color: 'var(--muted-olive)', colorRgb: 'var(--muted-olive-rgb)', unit: '100s', isQuantitative: true },
];

const BOWLING_BOARDS = [
  { key: 'wickets',       label: 'Most Wickets',       icon: Zap,        color: 'var(--sandy-brown)', colorRgb: 'var(--sandy-brown-rgb)', unit: 'wkts', isQuantitative: true },
  { key: 'economy',       label: 'Best Economy',        icon: Target,     color: 'var(--sage-green)',  colorRgb: 'var(--sage-green-rgb)',  unit: 'econ', isQuantitative: false, defaultMinInnings: 25 },
  { key: 'strike_rate',   label: 'Best Strike Rate',    icon: Zap,        color: 'var(--dry-sage)',    colorRgb: 'var(--dry-sage-rgb)',    unit: 'SR',   isQuantitative: false, defaultMinInnings: 50 },
  { key: '3w',            label: 'Most 3-Wicket Hauls', icon: Award,      color: 'var(--palm-leaf)',   colorRgb: 'var(--palm-leaf-rgb)',   unit: '3w',   isQuantitative: true },
  { key: '5w',            label: 'Most 5-Wicket Hauls', icon: Target,     color: 'var(--muted-olive)', colorRgb: 'var(--muted-olive-rgb)', unit: '5w',   isQuantitative: true },
];

// ── Helpers ────────────────────────────────────────────────────────────────

const StatPill = ({ label, value, color, colorRgb }: { label: string; value: string | number | null; color: string; colorRgb: string }) => (
  <div className="flex flex-col items-center gap-0.5 px-3 py-2 rounded-lg" style={{ background: `rgba(${colorRgb}, 0.1)`, border: `1px solid rgba(${colorRgb}, 0.2)` }}>
    <span className="text-[9px] uppercase font-black tracking-widest" style={{ color: 'var(--palm-leaf)' }}>{label}</span>
    <span className="text-lg font-black font-mono tabular-nums" style={{ color }}>{value ?? '—'}</span>
  </div>
);

// ── Leaderboard Card ───────────────────────────────────────────────────────

function LeaderboardCard({ cfg, type }: { cfg: typeof BATTING_BOARDS[0]; type: 'batting' | 'bowling' }) {
  const [data, setData] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [minInnings, setMinInnings] = useState((cfg as any).defaultMinInnings ?? (type === 'batting' ? 8 : 5));
  const Icon = cfg.icon;

  useEffect(() => {
    setLoading(true);
    const inningsParam = cfg.isQuantitative ? 1 : minInnings;
    fetch(getApiUrl(`/stats/leaderboard/${type}?sort_by=${cfg.key}&limit=10&min_innings=${inningsParam}`), { cache: 'no-store' })
      .then(r => r.json())
      .then((d: LeaderboardData) => { setData(d.leaderboard ?? []); })
      .catch(() => setData([]))
      .finally(() => setLoading(false));
  }, [cfg.key, type, minInnings, cfg.isQuantitative]);

  return (
    <div className="cricket-card rounded-2xl overflow-hidden flex flex-col" style={{ minWidth: 0 }}>
      {/* Header accent bar */}
      <div className="h-1" style={{ background: `linear-gradient(90deg, ${cfg.color}, transparent)` }} />
      <div className="p-5 flex flex-col gap-4 flex-1">
        {/* Title */}
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: `rgba(${cfg.colorRgb}, 0.1)`, border: `1px solid rgba(${cfg.colorRgb}, 0.25)` }}>
              <Icon className="w-4 h-4" style={{ color: cfg.color }} />
            </div>
            <div>
              <div className="text-xs font-black uppercase tracking-widest" style={{ color: 'var(--palm-leaf)' }}>{type}</div>
              <div className="text-sm font-black">{cfg.label}</div>
            </div>
          </div>
          <div className="flex flex-col items-end">
            {!cfg.isQuantitative && (
              <>
                <label className="text-[8px] uppercase font-black tracking-widest" style={{ color: 'var(--muted)' }}>Min Innings</label>
                <input 
                  type="number"
                  min={1}
                  value={minInnings} 
                  onChange={e => setMinInnings(Math.max(1, parseInt(e.target.value) || 1))}
                  className="w-8 bg-transparent text-right text-xs font-bold outline-none border-b border-dashed border-[var(--muted)] focus:border-[var(--foreground)] transition-colors cursor-text"
                  style={{ color: 'var(--foreground)' }}
                />
              </>
            )}
          </div>
        </div>

        {/* Rows */}
        {loading ? (
          <div className="flex-1 flex items-center justify-center py-8">
            <div className="w-6 h-6 rounded-full border-2 border-t-transparent animate-spin" style={{ borderColor: `rgba(${cfg.colorRgb}, 0.25)`, borderTopColor: cfg.color }} />
          </div>
        ) : data.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center py-8 text-center px-2">
            <p className="text-xs font-bold mb-1" style={{ color: 'var(--muted)' }}>Leaderboard Unavailable</p>
            <p className="text-[10px] leading-relaxed" style={{ color: 'var(--border)' }}>
              The backend API is currently returning invalid data for this endpoint.
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-1">
            {data.map((entry, i) => {
              const val = entry[cfg.key];
              const isTop = i === 0;
              const pct = data[0] ? Math.round(((val ?? 0) / (data[0][cfg.key] ?? 1)) * 100) : 0;
              return (
                <div key={i} className="group relative rounded-lg px-3 py-2 flex items-center gap-3 transition-colors" style={{ background: isTop ? `rgba(${cfg.colorRgb}, 0.06)` : undefined }}>
                  {/* Progress fill */}
                  <div
                    className="absolute inset-0 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity"
                    style={{ background: `rgba(${cfg.colorRgb}, 0.03)` }}
                  />
                  {/* Rank */}
                  <span
                    className="flex-none w-5 text-center text-[10px] font-black font-mono"
                    style={{ color: isTop ? cfg.color : 'var(--muted)' }}
                  >
                    {isTop ? '①' : entry.rank}
                  </span>
                  {/* Bar + name */}
                  <Link href={entry.id != null ? `/player/${entry.id}` : '#'} className="flex-1 min-w-0 hover:opacity-80 transition-opacity">
                    <div className="text-xs font-bold truncate">{entry.name}</div>
                    <div className="mt-1 h-0.5 rounded-full overflow-hidden" style={{ background: 'var(--border)' }}>
                      <div
                        className="h-full rounded-full transition-all"
                        style={{ width: `${pct}%`, background: cfg.color }}
                      />
                    </div>
                  </Link>
                  {/* Value */}
                  <span className="flex-none text-sm font-black font-mono tabular-nums" style={{ color: cfg.color }}>
                    {typeof val === 'number' ? (cfg.key === 'average' || cfg.key === 'strike_rate' || cfg.key === 'economy' ? val.toFixed(1) : val) : val ?? '—'}
                    <span className="text-[9px] ml-0.5 font-normal" style={{ color: 'var(--muted)' }}>{cfg.unit}</span>
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Player Search ──────────────────────────────────────────────────────────

function PlayerSearch() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const search = useCallback((q: string) => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!q.trim()) { setResults([]); return; }
    debounceRef.current = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await fetch(getApiUrl(`/players/search?q=${encodeURIComponent(q)}`), { cache: 'no-store' });
        if (!res.ok) throw new Error('Search failed');
        const data = await res.json();
        setResults(data.slice(0, 12).map((p: any) => ({
          id: p.id,
          name: p.name,
          matches: p.matches,
          runs: null,
          wickets: null
        })));
      } catch { setResults([]); }
      finally { setLoading(false); }
    }, 300);
  }, []);

  useEffect(() => { search(query); }, [query, search]);

  return (
    <div className="flex flex-col gap-4">
      {/* Input */}
      <div
        className="flex items-center gap-3 px-4 py-3 rounded-xl"
        style={{ background: 'var(--surface-2)', border: '1px solid var(--border)' }}
      >
        <Search className="w-4 h-4 flex-none" style={{ color: 'var(--palm-leaf)' }} />
        <input
          className="flex-1 bg-transparent text-sm outline-none placeholder-[var(--muted)]"
          placeholder="Search player name…"
          value={query}
          onChange={e => setQuery(e.target.value)}
          autoComplete="off"
          spellCheck={false}
          style={{ color: 'var(--foreground)' }}
        />
        {loading && <div className="w-3.5 h-3.5 border-2 border-t-transparent rounded-full animate-spin" style={{ borderColor: 'rgba(var(--sage-green-rgb), 0.25)', borderTopColor: 'var(--sage-green)' }} />}
      </div>

      {/* Results */}
      {results.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
          {results.map((p, i) => (
            <Link
              key={i}
              href={p.id != null ? `/player/${p.id}` : '#'}
              className="group flex items-center justify-between px-4 py-3 rounded-xl transition-all cricket-card"
            >
              <div>
                <div className="text-sm font-bold group-hover:text-[var(--sage-green)] transition-colors">{p.name}</div>
                <div className="text-[10px] flex gap-2 mt-0.5" style={{ color: 'var(--muted)' }}>
                  <span>{p.matches} matches</span>
                  {p.runs != null && <span>· {p.runs} runs</span>}
                  {p.wickets != null && p.wickets > 0 && <span>· {p.wickets} wkts</span>}
                </div>
              </div>
              <ChevronRight className="w-4 h-4 opacity-0 group-hover:opacity-100 transition-opacity" style={{ color: 'var(--sage-green)' }} />
            </Link>
          ))}
        </div>
      )}
      {query && !loading && results.length === 0 && (
        <p className="text-xs text-center py-6" style={{ color: 'var(--muted)' }}>No players found for "{query}"</p>
      )}
    </div>
  );
}

// ── Page ───────────────────────────────────────────────────────────────────

export default function PlayersPage() {
  return (
    <div className="min-h-screen" style={{ background: 'var(--background)', color: 'var(--foreground)' }}>
      <div className="max-w-7xl mx-auto px-6 py-10 flex flex-col gap-14">

        {/* Hero */}
        <div className="relative">
          <Link href="/" className="absolute -top-6 left-0 flex items-center gap-2 text-xs font-bold uppercase tracking-widest transition-colors hover:text-[var(--sage-green)]" style={{ color: 'var(--palm-leaf)' }}>
            <ArrowLeft className="w-4 h-4" /> Home
          </Link>
          <p className="text-[10px] uppercase font-black tracking-[0.4em] mb-3 mt-6" style={{ color: 'var(--palm-leaf)' }}>Statistics & Rankings</p>
          <h1 className="text-4xl md:text-5xl font-black tracking-tighter text-[var(--foreground)] mb-2">Player Hub</h1>
          <p className="text-sm max-w-md" style={{ color: 'var(--muted)' }}>
            Search over 4,000 players, explore career stats, and browse leaderboards ranked by every major batting and bowling metric.
          </p>
        </div>

        {/* Search section */}
        <section>
          <div className="flex items-center gap-2 mb-5">
            <Search className="w-4 h-4" style={{ color: 'var(--sage-green)' }} />
            <h2 className="text-xs font-black uppercase tracking-widest" style={{ color: 'var(--sage-green)' }}>Search Players</h2>
          </div>
          <PlayerSearch />
        </section>

        {/* Batting Leaderboards */}
        <section>
          <div className="flex items-center gap-2 mb-6">
            <TrendingUp className="w-4 h-4" style={{ color: 'var(--sage-green)' }} />
            <h2 className="text-xs font-black uppercase tracking-widest" style={{ color: 'var(--sage-green)' }}>Batting Leaderboards</h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-5">
            {BATTING_BOARDS.map(cfg => (
              <LeaderboardCard key={cfg.key} cfg={cfg} type="batting" />
            ))}
          </div>
        </section>

        {/* Bowling Leaderboards */}
        <section>
          <div className="flex items-center gap-2 mb-6">
            <Zap className="w-4 h-4" style={{ color: 'var(--sandy-brown)' }} />
            <h2 className="text-xs font-black uppercase tracking-widest" style={{ color: 'var(--sandy-brown)' }}>Bowling Leaderboards</h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-5">
            {BOWLING_BOARDS.map(cfg => (
              <LeaderboardCard key={cfg.key} cfg={cfg} type="bowling" />
            ))}
          </div>
        </section>

      </div>

      {/* Footer */}
      <footer className="text-center py-6 text-[10px] font-mono uppercase tracking-widest" style={{ color: 'var(--border)', borderTop: '1px solid var(--border)' }}>
        4,100+ players · Powered by Transformer Neural Networks
      </footer>
    </div>
  );
}
