'use client';

import { useState, useEffect, useRef } from 'react';
import { Eye, Swords, Loader2, ShieldCheck } from 'lucide-react';
import Link from 'next/link';
import { teamFlag } from '@/lib/flags';
import { getApiUrl } from '@/lib/api';

interface PoolPlayer { name: string; team: string; can_bowl: boolean; }
interface SpectatorViewProps { match: any; }

interface PlayerMiniStats {
  runs: number;
  sr: number;
  wkts: number | null;
  eco: number | null;
}

// Divisors of 30 ordered by preference (most cols first so rows are fewer)
const DIVISORS_30 = [10, 6, 5, 3, 2, 1] as const;

/**
 * Pick the column count (a divisor of 30) that best fills
 * containerW × containerH without overflowing.
 * Target card aspect ratio: width/height between 0.55 – 1.9.
 */
function bestCols(containerW: number, containerH: number): number {
  for (const cols of DIVISORS_30) {
    const rows  = 30 / cols;
    const cardW = containerW / cols;
    const cardH = containerH / rows;
    const ratio = cardW / cardH;
    if (ratio >= 0.55 && ratio <= 1.9) return cols;
  }
  return 6;
}

/** Fetch mini-stats for a pool of players; returns a Map keyed by player name. */
async function fetchPoolStats(pool: PoolPlayer[]): Promise<Map<string, PlayerMiniStats>> {
  const results = await Promise.all(
    pool.map(async (p) => {
      try {
        const res = await fetch(getApiUrl(`/stats/${encodeURIComponent(p.name)}`), { cache: 'force-cache' });
        if (!res.ok) return [p.name, null] as const;
        const data = await res.json();
        return [p.name, {
          runs: data.batting?.runs ?? 0,
          sr:   data.batting?.strike_rate ?? 0,
          wkts: data.bowling?.wickets ?? null,
          eco:  data.bowling?.economy ?? null,
        } as PlayerMiniStats] as const;
      } catch {
        return [p.name, null] as const;
      }
    })
  );
  const map = new Map<string, PlayerMiniStats>();
  for (const [name, s] of results) { if (s) map.set(name, s); }
  return map;
}

function useCountdown(deadlineIso: string | null) {
  const [secs, setSecs] = useState<number>(() => {
    if (!deadlineIso) return 0;
    return Math.max(0, Math.floor((new Date(deadlineIso).getTime() - Date.now()) / 1000));
  });
  useEffect(() => {
    if (!deadlineIso) { setSecs(0); return; }
    const tick = () => setSecs(Math.max(0, Math.floor((new Date(deadlineIso).getTime() - Date.now()) / 1000)));
    tick();
    const id = setInterval(tick, 500);
    return () => clearInterval(id);
  }, [deadlineIso]);
  return secs;
}

// ── Shared: team slot row ──────────────────────────────────────────────────────
function TeamSlot({ p, accent }: { p?: PoolPlayer; accent: 'green' | 'orange' }) {
  if (!p) {
    return (
      <div className="rounded-lg h-10 flex items-center px-2"
        style={{ border: '1px dashed var(--border)', background: 'transparent' }} />
    );
  }
  const bg     = accent === 'green' ? 'rgba(108,174,117,0.08)' : 'rgba(245,166,91,0.08)';
  const border = accent === 'green' ? 'rgba(108,174,117,0.35)' : 'rgba(245,166,91,0.35)';
  return (
    <div className="rounded-lg h-10 flex items-center gap-2 px-2"
      style={{ background: bg, border: `1px solid ${border}` }}>
      <span className="text-sm flex-shrink-0">{teamFlag([p.team])}</span>
      <span className="text-xs font-bold truncate flex-1">{p.name}</span>
      {p.can_bowl && (
        <span className="text-[7px] px-1 py-0.5 rounded font-black flex-shrink-0"
          style={{ background: 'rgba(245,166,91,0.2)', color: 'var(--sandy-brown)' }}>B</span>
      )}
    </div>
  );
}

// ── Shared: pool card (void via visibility:hidden when taken) ──────────────────
function PoolCard({ p, taken, isPickingTurn, stats }: {
  p: PoolPlayer; taken: boolean; isPickingTurn: boolean; stats?: PlayerMiniStats;
}) {
  return (
    <div className="relative rounded-xl flex flex-col items-center justify-center gap-0.5 p-1.5 text-center select-none w-full h-full"
      style={{
        visibility: taken ? 'hidden' : 'visible',
        background: 'var(--surface)',
        border: `1px solid ${isPickingTurn ? 'rgba(108,174,117,0.3)' : 'var(--border)'}`,
        minHeight: 0,
      }}>
      <span className="text-xl leading-none">{teamFlag([p.team])}</span>
      <span className="text-[10px] font-bold leading-tight w-full"
        style={{
          display: '-webkit-box',
          WebkitLineClamp: 2,
          WebkitBoxOrient: 'vertical',
          overflow: 'hidden',
          color: 'var(--foreground)',
        } as React.CSSProperties}>
        {p.name}
      </span>
      {p.can_bowl && (
        <span className="text-[7px] px-1.5 py-0.5 rounded font-black"
          style={{ background: 'rgba(245,166,91,0.2)', color: 'var(--sandy-brown)' }}>BOWL</span>
      )}
      {/* Mini stats — 2×2 grid */}
      {stats && (
        <div className="grid grid-cols-2 gap-x-1 gap-y-0 w-full mt-0.5">
          <div className="flex flex-col items-center leading-tight">
            <span className="text-[6px] uppercase font-black" style={{ color: 'var(--palm-leaf)' }}>R</span>
            <span className="text-[8px] font-black font-mono tabular-nums" style={{ color: 'var(--sage-green)' }}>{stats.runs}</span>
          </div>
          <div className="flex flex-col items-center leading-tight">
            <span className="text-[6px] uppercase font-black" style={{ color: 'var(--palm-leaf)' }}>SR</span>
            <span className="text-[8px] font-black font-mono tabular-nums" style={{ color: 'var(--sage-green)' }}>{stats.sr.toFixed(0)}</span>
          </div>
          {stats.wkts !== null && (
            <div className="flex flex-col items-center leading-tight">
              <span className="text-[6px] uppercase font-black" style={{ color: 'var(--palm-leaf)' }}>W</span>
              <span className="text-[8px] font-black font-mono tabular-nums" style={{ color: 'var(--sandy-brown)' }}>{stats.wkts}</span>
            </div>
          )}
          {stats.eco !== null && (
            <div className="flex flex-col items-center leading-tight">
              <span className="text-[6px] uppercase font-black" style={{ color: 'var(--palm-leaf)' }}>Eco</span>
              <span className="text-[8px] font-black font-mono tabular-nums" style={{ color: 'var(--sandy-brown)' }}>{stats.eco.toFixed(1)}</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Spectator top bar ──────────────────────────────────────────────────────────
function SpectatorTopBar({
  p1Name, p2Name, p1Bowlers, p2Bowlers, p1Count, p2Count,
  centerSlot,
}: {
  p1Name: string; p2Name: string;
  p1Bowlers: number; p2Bowlers: number;
  p1Count: number; p2Count: number;
  centerSlot: React.ReactNode;
}) {
  return (
    <div className="flex-none flex items-center gap-3 px-4 py-2.5 border-b z-10"
      style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}>
      {/* P1 */}
      <div className="w-48 flex-shrink-0">
        <div className="text-[9px] uppercase font-black tracking-widest" style={{ color: 'var(--sage-green)' }}>
          {p1Name}
        </div>
        <div className="text-xs font-bold" style={{ color: 'var(--muted)' }}>
          {p1Count}/11 · {p1Bowlers} bowlers
        </div>
      </div>
      {/* Center */}
      <div className="flex-1 flex items-center justify-center gap-4">
        {centerSlot}
      </div>
      {/* P2 */}
      <div className="w-48 flex-shrink-0 text-right">
        <div className="text-[9px] uppercase font-black tracking-widest" style={{ color: 'var(--sandy-brown)' }}>
          {p2Name}
        </div>
        <div className="text-xs font-bold" style={{ color: 'var(--muted)' }}>
          {p2Count}/11 · {p2Bowlers} bowlers
        </div>
      </div>
    </div>
  );
}

// ── Three-column body ──────────────────────────────────────────────────────────
function ThreeCol({
  p1Team, p2Team, pool, takenAll, isPickingTurn,
  centerPanel,
  gridCols = 6,
  gridRef,
  poolStats,
}: {
  p1Team: PoolPlayer[]; p2Team: PoolPlayer[];
  pool: PoolPlayer[]; takenAll: Set<string>;
  isPickingTurn: boolean;
  centerPanel?: React.ReactNode;
  gridCols?: number;
  gridRef?: React.RefObject<HTMLDivElement | null>;
  poolStats?: Map<string, PlayerMiniStats>;
}) {
  return (
    <div className="flex-1 flex min-h-0 overflow-hidden">
      {/* P1 column */}
      <div className="w-48 flex-shrink-0 flex flex-col gap-1.5 px-3 py-3 overflow-y-auto border-r"
        style={{ borderColor: 'rgba(108,174,117,0.2)', background: 'rgba(108,174,117,0.02)' }}>
        <div className="text-[8px] uppercase font-black tracking-widest mb-0.5" style={{ color: 'var(--sage-green)' }}>
          Picked
        </div>
        {Array.from({ length: 11 }, (_, i) => <TeamSlot key={i} p={p1Team[i]} accent="green" />)}
        <div className="mt-1 text-[8px] font-black uppercase tracking-widest text-center"
          style={{ color: p1Team.filter(p => p.can_bowl).length >= 5 ? 'var(--sage-green)' : 'var(--muted)' }}>
          {p1Team.filter(p => p.can_bowl).length}/5 bowlers
        </div>
      </div>

      {/* Center */}
      <div className="flex-1 overflow-hidden p-3 flex flex-col min-w-0" style={{ minHeight: 0 }}>
        {centerPanel ?? (
          <>
            <div className="flex items-center gap-2 mb-2 flex-none text-[8px] uppercase font-black tracking-widest" style={{ color: 'var(--palm-leaf)' }}>
              <span>Draft Pool — {pool.length} players</span>
              <span style={{ color: 'var(--muted)' }}>({pool.length - takenAll.size} remaining)</span>
            </div>
            {/* Dynamic grid fills all remaining height — no scrollbar ever */}
            <div
              ref={gridRef}
              className="flex-1 min-h-0"
              style={{
                display: 'grid',
                gridTemplateColumns: `repeat(${gridCols}, 1fr)`,
                gridTemplateRows: `repeat(${30 / gridCols}, 1fr)`,
                gap: '4px',
              }}
            >
              {pool.map(p => (
                <PoolCard key={p.name} p={p} taken={takenAll.has(p.name)} isPickingTurn={isPickingTurn}
                  stats={poolStats?.get(p.name)} />
              ))}
            </div>
          </>
        )}
      </div>

      {/* P2 column */}
      <div className="w-48 flex-shrink-0 flex flex-col gap-1.5 px-3 py-3 overflow-y-auto border-l"
        style={{ borderColor: 'rgba(245,166,91,0.2)', background: 'rgba(245,166,91,0.02)' }}>
        <div className="text-[8px] uppercase font-black tracking-widest mb-0.5" style={{ color: 'var(--sandy-brown)' }}>
          Picked
        </div>
        {Array.from({ length: 11 }, (_, i) => <TeamSlot key={i} p={p2Team[i]} accent="orange" />)}
        <div className="mt-1 text-[8px] font-black uppercase tracking-widest text-center"
          style={{ color: p2Team.filter(p => p.can_bowl).length >= 5 ? 'var(--sage-green)' : 'var(--muted)' }}>
          {p2Team.filter(p => p.can_bowl).length}/5 bowlers
        </div>
      </div>
    </div>
  );
}

// ── COUNTDOWN phase ─────────────────────────────────────────────────────────── 
function SpectatorCountdown({ match }: { match: any }) {
  const p1Name: string      = match.player1_display_name;
  const p2Name: string      = match.player2_display_name;
  const pool: PoolPlayer[]  = match.player_pool ?? [];
  const bowlerCount         = pool.filter((p: PoolPlayer) => p.can_bowl).length;

  const [poolStats, setPoolStats] = useState<Map<string, PlayerMiniStats>>(new Map());
  const [gridCols, setGridCols]   = useState(6);
  const gridRef                   = useRef<HTMLDivElement>(null);

  // Fetch mini-stats for all pool players once on mount
  useEffect(() => {
    if (!pool.length) return;
    fetchPoolStats(pool).then(setPoolStats);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Dynamically pick grid cols so all 30 cards always fit without scroll
  useEffect(() => {
    const el = gridRef.current;
    if (!el) return;
    const obs = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect;
      if (width > 0 && height > 0) setGridCols(bestCols(width, height));
    });
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  return (
    <div className="h-screen flex flex-col overflow-hidden"
      style={{ background: 'var(--background)', color: 'var(--foreground)' }}>

      <SpectatorTopBar
        p1Name={p1Name} p2Name={p2Name}
        p1Bowlers={0} p2Bowlers={0}
        p1Count={0} p2Count={0}
        centerSlot={
          <div className="flex flex-col items-center gap-1">
            <div className="flex items-center gap-2 text-xs font-black" style={{ color: 'var(--sage-green)' }}>
              <Eye className="w-3.5 h-3.5" /> Spectating
              <Link href="/duel" className="ml-3 text-[9px] uppercase tracking-widest px-2 py-1 rounded-lg"
                style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', color: 'var(--muted)' }}>
                Leave
              </Link>
            </div>
            <div className="flex items-center gap-2 text-xs font-bold" style={{ color: 'var(--muted)' }}>
              <Loader2 className="w-3 h-3 animate-spin" /> Players reviewing lineup…
            </div>
          </div>
        }
      />

      <ThreeCol
        p1Team={[]} p2Team={[]}
        pool={pool} takenAll={new Set()}
        isPickingTurn={false}
        centerPanel={
          <div className="h-full flex flex-col min-h-0">
            {/* Draft rules */}
            <div className="rounded-xl p-3 mb-3 flex-none flex flex-col gap-1.5"
              style={{ background: 'var(--surface)', border: '1px solid rgba(108,174,117,0.3)' }}>
              <div className="flex items-center gap-1.5 mb-1">
                <ShieldCheck className="w-3.5 h-3.5 flex-shrink-0" style={{ color: 'var(--sage-green)' }} />
                <span className="text-[9px] uppercase font-black tracking-widest" style={{ color: 'var(--sage-green)' }}>Draft Rules</span>
              </div>
              {[
                { ok: pool.length >= 11, text: `Pool has ${pool.length} players (need ≥ 11)` },
                { ok: bowlerCount >= 5,  text: `${bowlerCount} eligible bowlers (need ≥ 5)` },
                { ok: true, text: 'Each team picks 11 players (snake draft)' },
                { ok: true, text: 'Each team must have ≥ 5 eligible bowlers' },
                { ok: true, text: 'Max 4 overs/bowler · no consecutive overs' },
              ].map((r, i) => (
                <div key={i} className="flex items-center gap-2 text-xs font-bold">
                  <span style={{ color: r.ok ? 'var(--sage-green)' : 'var(--sandy-brown)' }}>{r.ok ? '✓' : '✗'}</span>
                  <span style={{ color: r.ok ? 'var(--foreground)' : 'var(--sandy-brown)' }}>{r.text}</span>
                </div>
              ))}
            </div>

            {/* Pool grid header */}
            <div className="flex-none text-[8px] uppercase font-black tracking-widest mb-2" style={{ color: 'var(--palm-leaf)' }}>
              Draft Pool — {pool.length} Players &nbsp;
              <span style={{ color: 'var(--muted)' }}>(orange card = eligible bowler)</span>
            </div>
            {/* Dynamic grid fills all remaining height — no scrollbar ever */}
            <div
              ref={gridRef}
              className="flex-1 min-h-0"
              style={{
                display: 'grid',
                gridTemplateColumns: `repeat(${gridCols}, 1fr)`,
                gridTemplateRows: `repeat(${30 / gridCols}, 1fr)`,
                gap: '4px',
              }}
            >
              {pool.map((p: PoolPlayer) => (
                <PoolCard key={p.name} p={p} taken={false} isPickingTurn={false}
                  stats={poolStats.get(p.name)} />
              ))}
            </div>
            <p className="flex-none mt-2 text-center text-[10px] font-bold uppercase tracking-widest" style={{ color: 'var(--muted)' }}>
              Draft starts when timer ends or both players are ready
            </p>
          </div>
        }
      />
    </div>
  );
}

// ── DRAFTING phase ─────────────────────────────────────────────────────────────
function SpectatorDraft({ match }: { match: any }) {
  const p1Name: string      = match.player1_display_name;
  const p2Name: string      = match.player2_display_name;
  const pool: PoolPlayer[]  = match.player_pool ?? [];
  const p1Team: PoolPlayer[] = match.player1_team ?? [];
  const p2Team: PoolPlayer[] = match.player2_team ?? [];

  const takenAll   = new Set([...p1Team, ...p2Team].map(p => p.name));
  const isP1Turn   = match.current_pick_turn === match.player1_user_id;
  const pickerName = isP1Turn ? p1Name : p2Name;
  const pickNum    = match.current_pick_number ?? 0;
  const totalPicks = 22;

  const secsLeft   = useCountdown(match.pick_deadline);
  const PICK_SECS  = 10;
  const timerPct   = secsLeft / PICK_SECS;
  const timerColor = secsLeft <= 3 ? 'var(--sandy-brown)' : 'var(--sage-green)';
  const progressPct = (pickNum / totalPicks) * 100;

  const [poolStats, setPoolStats] = useState<Map<string, PlayerMiniStats>>(new Map());
  const [gridCols, setGridCols]   = useState(6);
  const gridRef                   = useRef<HTMLDivElement>(null);

  // Fetch mini-stats for all pool players once on mount
  useEffect(() => {
    if (!pool.length) return;
    fetchPoolStats(pool).then(setPoolStats);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Dynamically pick grid cols so all 30 cards always fit without scroll
  useEffect(() => {
    const el = gridRef.current;
    if (!el) return;
    const obs = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect;
      if (width > 0 && height > 0) setGridCols(bestCols(width, height));
    });
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  return (
    <div className="h-screen flex flex-col overflow-hidden"
      style={{ background: 'var(--background)', color: 'var(--foreground)' }}>

      <SpectatorTopBar
        p1Name={p1Name} p2Name={p2Name}
        p1Bowlers={p1Team.filter(p => p.can_bowl).length}
        p2Bowlers={p2Team.filter(p => p.can_bowl).length}
        p1Count={p1Team.length} p2Count={p2Team.length}
        centerSlot={
          <>
            {/* Who's picking */}
            <div className="text-center">
              <div className="text-[9px] uppercase font-black tracking-widest mb-0.5" style={{ color: 'var(--palm-leaf)' }}>Draft</div>
              <div className="text-sm font-black">
                <span style={{ color: isP1Turn ? 'var(--sage-green)' : 'var(--sandy-brown)' }}>
                  {pickerName}
                </span>
                <span style={{ color: 'var(--muted)' }}> is picking…</span>
              </div>
              <div className="flex items-center justify-center gap-1 mt-0.5 text-[8px] font-black uppercase" style={{ color: 'var(--sage-green)' }}>
                <Eye className="w-2 h-2" /> Spectating
              </div>
            </div>

            {/* Progress */}
            <div className="flex flex-col items-center gap-0.5">
              <span className="text-xs font-black font-mono">{pickNum} / {totalPicks}</span>
              <div className="w-28 h-1.5 rounded-full overflow-hidden" style={{ background: 'var(--border)' }}>
                <div className="h-full rounded-full transition-all" style={{ width: `${progressPct}%`, background: 'var(--sage-green)' }} />
              </div>
            </div>

            {/* Timer ring */}
            <div className="relative w-10 h-10 flex-shrink-0">
              <svg className="w-full h-full -rotate-90" viewBox="0 0 36 36">
                <circle cx="18" cy="18" r="15.9" fill="none" stroke="var(--border)" strokeWidth="3.5" />
                <circle cx="18" cy="18" r="15.9" fill="none" stroke={timerColor} strokeWidth="3.5"
                  strokeDasharray={`${timerPct * 100} 100`}
                  style={{ transition: 'stroke-dasharray 0.5s linear, stroke 0.3s' }}
                  strokeLinecap="round" />
              </svg>
              <span className="absolute inset-0 flex items-center justify-center text-[10px] font-black font-mono"
                style={{ color: timerColor }}>{secsLeft}</span>
            </div>

            <Link href="/duel"
              className="text-[9px] uppercase font-black tracking-widest px-2.5 py-1.5 rounded-lg transition hover:opacity-70"
              style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', color: 'var(--muted)' }}>
              Leave
            </Link>
          </>
        }
      />

      <ThreeCol
        p1Team={p1Team} p2Team={p2Team}
        pool={pool} takenAll={takenAll}
        isPickingTurn={true}
        gridCols={gridCols}
        gridRef={gridRef}
        poolStats={poolStats}
      />
    </div>
  );
}

// ── ORDERING phase ─────────────────────────────────────────────────────────────
function SpectatorOrdering({ match }: { match: any }) {
  const p1Name: string      = match.player1_display_name;
  const p2Name: string      = match.player2_display_name;
  const p1Team: PoolPlayer[] = match.player1_team ?? [];
  const p2Team: PoolPlayer[] = match.player2_team ?? [];
  const pool: PoolPlayer[]   = match.player_pool ?? [];
  const takenAll             = new Set([...p1Team, ...p2Team].map(p => p.name));

  return (
    <div className="h-screen flex flex-col overflow-hidden"
      style={{ background: 'var(--background)', color: 'var(--foreground)' }}>

      <SpectatorTopBar
        p1Name={p1Name} p2Name={p2Name}
        p1Bowlers={p1Team.filter(p => p.can_bowl).length}
        p2Bowlers={p2Team.filter(p => p.can_bowl).length}
        p1Count={p1Team.length} p2Count={p2Team.length}
        centerSlot={
          <div className="flex flex-col items-center gap-1">
            <div className="flex items-center gap-2 text-xs font-black" style={{ color: 'var(--sage-green)' }}>
              <Eye className="w-3.5 h-3.5" /> Spectating
              <Link href="/duel" className="ml-2 text-[9px] uppercase tracking-widest px-2 py-1 rounded-lg"
                style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', color: 'var(--muted)' }}>
                Leave
              </Link>
            </div>
            <div className="flex items-center gap-3 mt-1">
              {[
                { name: p1Name, ready: match.player1_orders_ready },
                { name: p2Name, ready: match.player2_orders_ready },
              ].map((pl, i) => (
                <div key={i} className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-bold"
                  style={{
                    background: 'var(--surface-2)',
                    border: `1px solid ${pl.ready ? 'var(--sage-green)' : 'var(--border)'}`,
                    color: pl.ready ? 'var(--sage-green)' : 'var(--muted)',
                  }}>
                  {pl.ready ? '✓' : <Loader2 className="w-3 h-3 animate-spin" />}
                  <span>{pl.name}</span>
                  <span className="text-[8px] uppercase font-black">{pl.ready ? 'Ready' : 'Ordering…'}</span>
                </div>
              ))}
            </div>
          </div>
        }
      />

      <ThreeCol
        p1Team={p1Team} p2Team={p2Team}
        pool={pool} takenAll={takenAll}
        isPickingTurn={false}
        centerPanel={
          <div className="h-full flex flex-col items-center justify-center gap-3 py-16">
            <Swords className="w-8 h-8" style={{ color: 'var(--sandy-brown)' }} />
            <p className="text-lg font-black text-center">Draft Complete</p>
            <p className="text-sm text-center" style={{ color: 'var(--muted)' }}>
              Both players are setting their batting &amp; bowling orders.
            </p>
            <Loader2 className="w-5 h-5 animate-spin mt-2" style={{ color: 'var(--sage-green)' }} />
          </div>
        }
      />
    </div>
  );
}

// ── Root export ────────────────────────────────────────────────────────────────
export default function SpectatorView({ match }: SpectatorViewProps) {
  if (match.status === 'countdown') return <SpectatorCountdown match={match} />;
  if (match.status === 'drafting')  return <SpectatorDraft match={match} />;
  if (match.status === 'ordering')  return <SpectatorOrdering match={match} />;
  return null;
}
