'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import Link from 'next/link';
import { teamFlag } from '@/lib/flags';
import { getApiUrl } from '@/lib/api';
import { useCommonNames, dn } from '@/lib/commonNames';
import { Loader2, Shuffle, Clock, Home } from 'lucide-react';

interface PoolPlayer { name: string; team: string; can_bowl: boolean; }

interface PlayerMiniStats {
  runs: number;
  sr: number;
  wkts: number | null;
  eco: number | null;
}

interface DraftPickerProps {
  match: any;
  myUserId: string;
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
    const rows   = 30 / cols;
    const cardW  = containerW / cols;
    const cardH  = containerH / rows;
    const ratio  = cardW / cardH;
    if (ratio >= 0.55 && ratio <= 1.9) return cols;
  }
  return 6;
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

// ── Team slot row ──────────────────────────────────────────────────────────────
function TeamSlot({ p, accent, cn }: { p?: PoolPlayer; accent: 'green' | 'orange'; cn: Map<string, string> }) {
  if (!p) {
    return (
      <div className="rounded h-7 flex items-center px-1.5"
        style={{ border: '1px dashed var(--border)', background: 'transparent' }} />
    );
  }
  const bg     = accent === 'green' ? 'rgba(108,174,117,0.08)' : 'rgba(245,166,91,0.08)';
  const border = accent === 'green' ? 'rgba(108,174,117,0.35)' : 'rgba(245,166,91,0.35)';
  return (
    <div className="rounded h-7 flex items-center gap-1.5 px-1.5"
      style={{ background: bg, border: `1px solid ${border}` }}>
      <span className="text-xs flex-shrink-0 leading-none">{teamFlag([p.team])}</span>
      <span className="text-[10px] font-bold truncate flex-1 leading-tight">{dn(p.name, cn)}</span>
      {p.can_bowl && (
        <span className="text-[6px] px-0.5 py-px rounded font-black flex-shrink-0"
          style={{ background: 'rgba(245,166,91,0.2)', color: 'var(--sandy-brown)' }}>B</span>
      )}
    </div>
  );
}

// ── Pool card (keeps grid slot when taken — visibility:hidden) ─────────────────
interface PoolCardProps {
  p: PoolPlayer;
  taken: boolean;
  isMyTurn: boolean;
  picking: boolean;
  onClick: () => void;
  stats?: PlayerMiniStats;
  cn: Map<string, string>;
}
function PoolCard({ p, taken, isMyTurn, picking, onClick, stats, cn }: PoolCardProps) {
  const canClick = isMyTurn && !picking && !taken;
  return (
    <div
      className="relative rounded-xl flex flex-col items-center justify-center gap-0.5 p-1.5 text-center select-none transition-all duration-150 w-full h-full"
      style={{
        visibility: taken ? 'hidden' : 'visible',
        background: 'var(--surface)',
        border: `1px solid var(--border)`,
        opacity: 1,
        cursor: canClick ? 'pointer' : 'default',
        minHeight: 0,
      }}
      onClick={() => { if (canClick) onClick(); }}
      onMouseEnter={e => {
        if (canClick) {
          (e.currentTarget as HTMLDivElement).style.borderColor = 'var(--sage-green)';
          (e.currentTarget as HTMLDivElement).style.boxShadow = '0 0 0 1px var(--sage-green), 0 4px 16px rgba(108,174,117,0.2)';
        }
      }}
      onMouseLeave={e => {
        (e.currentTarget as HTMLDivElement).style.borderColor = 'var(--border)';
        (e.currentTarget as HTMLDivElement).style.boxShadow = 'none';
      }}
    >
      <span className="text-[11px] leading-none">{teamFlag([p.team])}</span>
      <span className="text-[12px] font-black leading-tight w-full"
        style={{
          display: '-webkit-box',
          WebkitLineClamp: 2,
          WebkitBoxOrient: 'vertical',
          overflow: 'hidden',
          color: 'var(--foreground)',
        } as React.CSSProperties}>
        {dn(p.name, cn)}
      </span>
      {p.can_bowl && (
        <span className="text-[7px] px-1.5 py-0.5 rounded font-black"
          style={{ background: 'rgba(245,166,91,0.2)', color: 'var(--sandy-brown)' }}>BOWL</span>
      )}
      {/* Mini stats — 2×2 grid */}
      {stats && (
        <div className="grid grid-cols-2 gap-x-1 gap-y-0.5 w-full mt-0.5">
          <div className="flex flex-col items-center leading-tight">
            <span className="text-[6px] uppercase font-black" style={{ color: 'var(--palm-leaf)' }}>R</span>
            <span className="text-[11px] font-black font-mono tabular-nums" style={{ color: 'var(--sage-green)' }}>{stats.runs}</span>
          </div>
          <div className="flex flex-col items-center leading-tight">
            <span className="text-[6px] uppercase font-black" style={{ color: 'var(--palm-leaf)' }}>SR</span>
            <span className="text-[11px] font-black font-mono tabular-nums" style={{ color: 'var(--sage-green)' }}>{stats.sr.toFixed(0)}</span>
          </div>
          {stats.wkts !== null && (
            <div className="flex flex-col items-center leading-tight">
              <span className="text-[6px] uppercase font-black" style={{ color: 'var(--palm-leaf)' }}>W</span>
              <span className="text-[11px] font-black font-mono tabular-nums" style={{ color: 'var(--sandy-brown)' }}>{stats.wkts}</span>
            </div>
          )}
          {stats.eco !== null && (
            <div className="flex flex-col items-center leading-tight">
              <span className="text-[6px] uppercase font-black" style={{ color: 'var(--palm-leaf)' }}>Eco</span>
              <span className="text-[11px] font-black font-mono tabular-nums" style={{ color: 'var(--sandy-brown)' }}>{stats.eco.toFixed(1)}</span>
            </div>
          )}
        </div>
      )}
      {picking && isMyTurn && (
        <div className="absolute inset-0 rounded-xl flex items-center justify-center"
          style={{ background: 'rgba(0,0,0,0.45)' }}>
          <Loader2 className="w-4 h-4 animate-spin" style={{ color: 'var(--sage-green)' }} />
        </div>
      )}
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────────
export default function DraftPicker({ match, myUserId }: DraftPickerProps) {
  const [picking, setPicking]         = useState(false);
  const [pickError, setPickError]     = useState<string | null>(null);
  const [autoPickEnabled, setAutoPick] = useState<boolean>(() =>
    typeof window !== 'undefined' && localStorage.getItem('duel_auto_pick') === 'true'
  );

  const toggleAutoPick = useCallback(() => {
    setAutoPick(prev => {
      const next = !prev;
      localStorage.setItem('duel_auto_pick', String(next));
      return next;
    });
  }, []);
  const [poolStats, setPoolStats] = useState<Map<string, PlayerMiniStats>>(new Map());
  const [gridCols, setGridCols]   = useState(6);
  const gridRef                   = useRef<HTMLDivElement>(null);
  const secsLeft = useCountdown(match.pick_deadline);

  const isP1       = match.player1_user_id === myUserId;
  const pool: PoolPlayer[]   = match.player_pool ?? [];

  // ── Fetch common/display names for all pool players once on mount ──────
  const cn = useCommonNames(pool.map(p => p.name));

  // ── Fetch mini-stats for all pool players once on mount ────────────────
  useEffect(() => {
    if (!pool.length) return;
    Promise.all(
      pool.map(async (p: PoolPlayer) => {
        try {
          const res = await fetch(getApiUrl(`/stats/${encodeURIComponent(p.name)}`), { cache: 'force-cache' });
          if (!res.ok) return [p.name, null] as const;
          const data = await res.json();
          return [p.name, {
            runs: data.batting?.runs ?? 0,
            sr:   data.batting?.strike_rate ?? 0,
            wkts: data.bowling?.wickets   ?? null,
            eco:  data.bowling?.economy   ?? null,
          } as PlayerMiniStats] as const;
        } catch {
          return [p.name, null] as const;
        }
      })
    ).then(results => {
      const map = new Map<string, PlayerMiniStats>();
      for (const [name, s] of results) { if (s) map.set(name, s); }
      setPoolStats(map);
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // pool is stable for the lifetime of a match

  // ── Dynamically pick grid cols so all 30 cards always fit without scroll ─
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
  const p1Team: PoolPlayer[] = match.player1_team ?? [];
  const p2Team: PoolPlayer[] = match.player2_team ?? [];
  const myTeam     = isP1 ? p1Team : p2Team;
  const oppTeam    = isP1 ? p2Team : p1Team;
  const myName     = isP1 ? match.player1_display_name : match.player2_display_name;
  const oppName    = isP1 ? match.player2_display_name : match.player1_display_name;

  const takenByMe  = new Set(myTeam.map(p => p.name));
  const takenByOpp = new Set(oppTeam.map(p => p.name));
  const takenAll   = new Set([...takenByMe, ...takenByOpp]);
  const remaining  = pool.filter(p => !takenAll.has(p.name));

  const isMyTurn   = match.current_pick_turn === myUserId;
  const pickerName = match.current_pick_turn === match.player1_user_id
    ? match.player1_display_name : match.player2_display_name;

  const totalPicks     = 22;
  const pickNum        = match.current_pick_number ?? 0;
  const myBowlerCount  = myTeam.filter(p => p.can_bowl).length;

  const PICK_SECS   = 10;
  const timerPct    = secsLeft / PICK_SECS;
  const timerColor  = secsLeft <= 3 ? 'var(--sandy-brown)' : 'var(--sage-green)';
  const progressPct = (pickNum / totalPicks) * 100;

  const handlePick = useCallback(async (playerName: string) => {
    if (!isMyTurn || picking) return;
    setPickError(null);
    setPicking(true);
    try {
      const res = await fetch(getApiUrl(`/duel/match/${match.id}/pick`), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: myUserId, player_name: playerName }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setPickError(body?.detail ?? 'Pick failed — try another player.');
      }
    } catch {
      setPickError('Network error — please try again.');
    } finally {
      setPicking(false);
    }
  }, [isMyTurn, picking, match.id, myUserId]);

  const autoPickStateRef = useRef({ remaining, picking, myTeam, myBowlerCount });
  autoPickStateRef.current = { remaining, picking, myTeam, myBowlerCount };
  const autoPickedForRef  = useRef(-1);

  const handleAutoPick = useCallback(async () => {
    const { remaining, myTeam: team, myBowlerCount: bowlerCount } = autoPickStateRef.current;
    if (remaining.length === 0) return;
    // If all remaining slots must be bowlers, restrict candidates to eligible bowlers
    const slotsLeft     = 11 - team.length;
    const bowlersNeeded = Math.max(0, 5 - bowlerCount);
    const mustPickBowler = bowlersNeeded > 0 && bowlersNeeded >= slotsLeft;
    const eligibleBowlers = remaining.filter(p => p.can_bowl);
    const candidates = mustPickBowler && eligibleBowlers.length > 0
      ? eligibleBowlers
      : remaining;
    const pick = candidates[Math.floor(Math.random() * candidates.length)];
    await handlePick(pick.name);
  }, [handlePick]);

  useEffect(() => {
    if (!autoPickEnabled || !isMyTurn) return;
    const currentPickNum = match.current_pick_number ?? 0;
    if (autoPickedForRef.current >= currentPickNum) return;
    const t = setTimeout(async () => {
      if (!autoPickStateRef.current.picking && autoPickedForRef.current < currentPickNum) {
        autoPickedForRef.current = currentPickNum;
        await handleAutoPick();
      }
    }, 1000);
    return () => clearTimeout(t);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoPickEnabled, isMyTurn, match.current_pick_number]);

  return (
    <div className="h-screen flex flex-col overflow-hidden"
      style={{ background: 'var(--background)', color: 'var(--foreground)' }}>

      {/* ── Top bar ──────────────────────────────────────────────────── */}
      <div className="flex-none flex items-center gap-3 px-4 py-2.5 border-b z-10"
        style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}>
{/* Home link — far left */}
        <Link href="/"
          className="flex items-center gap-1 px-2 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all flex-shrink-0 mr-1"
          style={{ color: 'var(--muted)', border: '1px solid var(--border)' }}
          title="Back to home">
          <Home className="w-3 h-3" />
          Home
        </Link>
        {/* My team label */}
        <div className="w-44 flex-shrink-0">
          <div className="text-[9px] uppercase font-black tracking-widest" style={{ color: 'var(--sage-green)' }}>
            {myName} <span style={{ color: 'var(--muted)' }}>(You)</span>
          </div>
          <div className="text-xs font-bold" style={{ color: 'var(--muted)' }}>
            {myTeam.length}/11 · {myBowlerCount} bowlers
          </div>
        </div>

        {/* Center info */}
        <div className="flex-1 flex items-center justify-center gap-5">
          <div className="text-center">
            <div className="text-[9px] uppercase font-black tracking-widest mb-0.5" style={{ color: 'var(--palm-leaf)' }}>
              Draft
            </div>
            <div className="text-sm font-black leading-none">
              {isMyTurn
                ? <span style={{ color: 'var(--sage-green)' }}>Your pick! 🏏</span>
                : <span style={{ color: 'var(--muted)' }}>{pickerName} is choosing…</span>}
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

          {/* Auto-pick toggle — always visible, click to enable/disable */}
          <div className="flex flex-col items-center gap-0.5">
            <button
              onClick={toggleAutoPick}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all"
              style={{
                background: autoPickEnabled ? 'rgba(245,166,91,0.15)' : 'rgba(108,174,117,0.1)',
                color: autoPickEnabled ? 'var(--sandy-brown)' : 'var(--muted)',
                border: `1px solid ${autoPickEnabled ? 'var(--sandy-brown)' : 'var(--border)'}`,
              }}
            >
              <Shuffle className="w-2.5 h-2.5" />
              Auto Pick
            </button>
            <span className="text-[7px] uppercase font-black tracking-widest"
              style={{ color: autoPickEnabled ? 'var(--sandy-brown)' : 'var(--muted)' }}>
              {autoPickEnabled ? 'on — click to off' : 'off — click to on'}
            </span>
          </div>
        </div>

        {/* Opp team label */}
        <div className="w-44 flex-shrink-0 text-right">
          <div className="text-[8px] uppercase font-black tracking-widest" style={{ color: 'var(--sandy-brown)' }}>
            {oppName}
          </div>
          <div className="text-xs font-bold" style={{ color: 'var(--muted)' }}>
            {oppTeam.length}/11 · {oppTeam.filter(p => p.can_bowl).length} bowlers
          </div>
        </div>
      </div>

      {/* ── Error banner ──────────────────────────────────────────────── */}
      {pickError && (
        <div className="flex-none flex flex-col gap-0.5 px-4 py-2"
          style={{ background: 'rgba(245,166,91,0.06)', borderBottom: '1px solid rgba(245,166,91,0.25)' }}>
          <div className="flex items-center gap-2 text-xs font-bold" style={{ color: 'var(--sandy-brown)' }}>
            {pickError}
          </div>
        </div>
      )}

      {/* ── Three-column body ─────────────────────────────────────────── */}
      <div className="flex-1 flex min-h-0 overflow-hidden">

        {/* My team */}
        <div className="w-44 flex-shrink-0 flex flex-col gap-1 px-2 py-2 overflow-y-auto border-r"
          style={{ borderColor: 'rgba(108,174,117,0.2)', background: 'rgba(108,174,117,0.02)' }}>
          <div className="text-[8px] uppercase font-black tracking-widest mb-0.5 flex justify-between"
            style={{ color: 'var(--sage-green)' }}>
            <span>Your Team</span>
            <span style={{ color: 'var(--muted)' }}>{myTeam.length}/11</span>
          </div>
          {Array.from({ length: 11 }, (_, i) => <TeamSlot key={i} p={myTeam[i]} accent="green" cn={cn} />)}
          <div className="mt-0.5 text-[7px] font-black uppercase tracking-widest text-center"
            style={{ color: myBowlerCount >= 5 ? 'var(--sage-green)' : 'var(--muted)' }}>
            {myBowlerCount}/5 bowlers
          </div>
        </div>

        {/* Pool grid */}
        <div className="flex-1 overflow-hidden p-3 flex flex-col min-w-0" style={{ minHeight: 0 }}>
          <div className="flex items-center gap-3 mb-2 flex-none text-[8px] uppercase font-black tracking-widest" style={{ color: 'var(--palm-leaf)' }}>
            <span>Draft Pool — {pool.length} players</span>
            <span style={{ color: 'var(--muted)' }}>({remaining.length} remaining)</span>
            <span className="ml-auto flex items-center gap-3" style={{ color: 'var(--muted)' }}>
              <span className="flex items-center gap-1">
                <span className="inline-block w-2 h-2 rounded-sm" style={{ background: 'rgba(245,166,91,0.3)' }} />
                BOWL = eligible bowler
              </span>
              <span className="flex items-center gap-1"><Clock className="w-2.5 h-2.5" /> auto-pick on timeout</span>
            </span>
          </div>
          {/* Grid fills all remaining height — no scrollbar ever */}
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
            {pool.map(p => {
              const taken = takenByMe.has(p.name) || takenByOpp.has(p.name);
              return (
                <PoolCard key={p.name} p={p} taken={taken}
                  isMyTurn={isMyTurn} picking={picking}
                  stats={poolStats.get(p.name)}
                  cn={cn}
                  onClick={() => handlePick(p.name)} />
              );
            })}
          </div>
        </div>

        {/* Opp team */}
        <div className="w-44 flex-shrink-0 flex flex-col gap-1 px-2 py-2 overflow-y-auto border-l"
          style={{ borderColor: 'rgba(245,166,91,0.2)', background: 'rgba(245,166,91,0.02)' }}>
          <div className="text-[8px] uppercase font-black tracking-widest mb-0.5 flex justify-between"
            style={{ color: 'var(--sandy-brown)' }}>
            <span>{oppName}</span>
            <span style={{ color: 'var(--muted)' }}>{oppTeam.length}/11</span>
          </div>
          {Array.from({ length: 11 }, (_, i) => <TeamSlot key={i} p={oppTeam[i]} accent="orange" cn={cn} />)}
          <div className="mt-0.5 text-[7px] font-black uppercase tracking-widest text-center"
            style={{ color: oppTeam.filter(p => p.can_bowl).length >= 5 ? 'var(--sage-green)' : 'var(--muted)' }}>
            {oppTeam.filter(p => p.can_bowl).length}/5 bowlers
          </div>
        </div>

      </div>
    </div>
  );
}
