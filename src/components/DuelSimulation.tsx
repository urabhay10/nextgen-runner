'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { Loader2, Swords, ArrowLeft, Zap } from 'lucide-react';
import Link from 'next/link';
import { getApiUrl } from '@/lib/api';
import { fetchCommonNames } from '@/lib/commonNames';
import { supabase } from '@/lib/supabase';
import ScoreCardLive from './ScoreCardLive';
import Commentary from './Commentary';
import DetailedScorecard from './DetailedScorecard';
import { BallEvent, MatchDetail } from '@/types';

// ── Types ─────────────────────────────────────────────────────────────────────
interface DuelSimulationProps {
  match:       any;
  myUserId:    string;
  onComplete:  (result: any, scorecard: any) => void;
  spectator?:  boolean;
}

// Raw event row stored in duel_events
interface RawEventRow {
  seq:     number;
  innings: number;
  event:   any;
}

// Convert a raw duel ball-event (fields flat on `ev`) → BallEvent shape Commentary/ScoreCardLive expect
function toBallEvent(ev: any, innings: number): BallEvent {
  return {
    striker:     ev.striker,
    non_striker: ev.non_striker,
    bowler:      ev.bowler,
    total_runs:  ev.total_runs,
    wickets:     ev.wickets,
    bat_team:    ev.bat_team ?? '',
    target:      ev.target ?? undefined,
    over:        ev.over,
    ball:        ev.ball,
    innings,
    match_no:    innings,           // re-use innings as match_no so Commentary groups correctly
    runs_scored: ev.runs_scored,
    is_wicket:   ev.is_wicket,
  };
}

// ── Speed config ──────────────────────────────────────────────────────────────
type SimSpeed = 'slow' | 'moderate' | 'max';
const SPEED_DELAY: Record<SimSpeed, number> = { slow: 2000, moderate: 500, max: 0 };

function getDelayMs(match: any): number {
  return SPEED_DELAY[(match?.sim_speed as SimSpeed) ?? 'moderate'] ?? 500;
}

// ── Component ─────────────────────────────────────────────────────────────────
export default function DuelSimulation({ match, myUserId, onComplete, spectator = false }: DuelSimulationProps) {
  const isP1    = match.player1_user_id === myUserId;
  // In spectator mode, always show player1 as "left" and player2 as "right" with neutral labels
  const myName  = spectator ? match.player1_display_name : (isP1 ? match.player1_display_name : match.player2_display_name);
  const oppName = spectator ? match.player2_display_name : (isP1 ? match.player2_display_name : match.player1_display_name);

  // ── State ──────────────────────────────────────────────────────────────────
  const [balls1, setBalls1]   = useState<BallEvent[]>([]);
  const [balls2, setBalls2]   = useState<BallEvent[]>([]);
  const [toss, setToss]       = useState<string | null>(null);
  const [resultScorecard, setResultScorecard] = useState<any>(null);
  const [done, setDone]       = useState(false);
  const [loading, setLoading] = useState(true);

  const processedSeqs  = useRef<Set<number>>(new Set());
  const channelRef     = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const onCompleteRef  = useRef(onComplete);
  const doneRef        = useRef(false);
  const triggeredRef   = useRef(false);   // have we POSTed /simulate yet?
  onCompleteRef.current = onComplete;

  // ── Common names map (display-only) ──────────────────────────────────
  const commonNamesRef = useRef<Map<string, string>>(new Map());

  useEffect(() => {
    // Collect all player names from both teams
    const allNames: string[] = [
      ...(match.player1_team ?? []).map((p: any) => p.name),
      ...(match.player2_team ?? []).map((p: any) => p.name),
    ];
    if (!allNames.length) return;
    fetchCommonNames(allNames).then(m => { commonNamesRef.current = m; });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [match.id]);

  // ── Event queue + timed drain ─────────────────────────────────────────────
  // All incoming rows are pushed onto this queue; the drain loop pops one per
  // delayMs so the display speed is governed by match.sim_speed.
  const queueRef      = useRef<RawEventRow[]>([]);
  const drainingRef   = useRef(false);
  const delayMs       = getDelayMs(match);

  const drainQueue = useCallback(() => {
    if (drainingRef.current) return;
    drainingRef.current = true;

    const step = () => {
      const row = queueRef.current.shift();
      if (!row) { drainingRef.current = false; return; }
      // applyRow defined below via ref
      applyRowRef.current(row);
      if (delayMs === 0) {
        // drain synchronously — microtask to avoid stack overflow on large batches
        Promise.resolve().then(step);
      } else {
        setTimeout(step, delayMs);
      }
    };
    step();
  }, [delayMs]);

  // ref so applyRow can be defined after drainQueue without circular deps
  const applyRowRef = useRef<(row: RawEventRow) => void>(() => {});

  // ── Process one event row ──────────────────────────────────────────────────
  const processRow = useCallback((row: RawEventRow) => {
    if (processedSeqs.current.has(row.seq)) return;
    processedSeqs.current.add(row.seq);
    // Push onto queue and start draining
    queueRef.current.push(row);
    drainQueue();
  }, [drainQueue]);

  // applyRow: actually mutates state for one event — called by the drain loop
  const applyRow = useCallback((row: RawEventRow) => {
    const ev = row.event;

    if (ev.type === 'toss') {
      setToss(ev.batting_first);
      setLoading(false);
      return;
    }
    if (ev.type === 'innings_break') {
      return;
    }
    if (ev.type === 'ball') {
      const cn = commonNamesRef.current;
      const resolve = (n: string) => cn.get(n) ?? n;
      const be = toBallEvent(ev, row.innings);
      // Remap display-only names in the ball event (engine names → common names)
      if (be.striker)     be.striker     = { ...be.striker,     name: resolve(be.striker.name) };
      if (be.non_striker) be.non_striker = { ...be.non_striker, name: resolve(be.non_striker.name) };
      if (be.bowler)      be.bowler      = { ...be.bowler,      name: resolve(be.bowler.name) };
      if (row.innings === 1) setBalls1(prev => [...prev, be]);
      else                   setBalls2(prev => [...prev, be]);
      setLoading(false);
      return;
    }
    if (ev.type === 'match_complete') {
      doneRef.current = true;
      setDone(true);
      setLoading(false);
      if (ev.scorecard) setResultScorecard(ev.scorecard);
      onCompleteRef.current(ev.result, ev.scorecard);
    }
  }, []);

  // Wire applyRow into the ref so drainQueue can call it
  applyRowRef.current = applyRow;

  // ── Fetch all events since last known seq ──────────────────────────────────
  const fetchEvents = useCallback(async () => {
    try {
      const res = await fetch(getApiUrl(`/duel/match/${match.id}/events`));
      if (!res.ok) return;
      const rows: RawEventRow[] = await res.json();
      rows.sort((a, b) => a.seq - b.seq);
      rows.forEach(processRow);
    } catch {
      // ignore network errors; will retry
    }
  }, [match.id, processRow]);

  // ── Auto-trigger stuck simulation (call /simulate if no events after delay) ─
  const triggerSimulation = useCallback(async () => {
    if (triggeredRef.current) return;
    triggeredRef.current = true;
    try {
      await fetch(getApiUrl(`/duel/match/${match.id}/simulate`), { method: 'POST' });
    } catch {
      triggeredRef.current = false; // allow retry on network error
    }
  }, [match.id]);

  // ── Main effect: initial fetch + Realtime subscription + polling ──────────
  useEffect(() => {
    let unmounted = false;
    let pollTimer: ReturnType<typeof setInterval> | null = null;
    let triggerTimer: ReturnType<typeof setTimeout> | null = null;

    // 1. Immediate catch-up fetch
    fetchEvents();

    // 2. Supabase Realtime subscription (best-effort live stream)
    const ch = supabase
      .channel(`duel-events-${match.id}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'duel_events', filter: `match_id=eq.${match.id}` },
        (payload) => {
          if (unmounted) return;
          processRow(payload.new as RawEventRow);
        }
      )
      .subscribe((status) => {
        console.log('[Duel Realtime] subscription status:', status);
      });

    channelRef.current = ch;

    // 3. Polling fallback — refetch every 2s while loading, 5s once started
    //    This handles: Realtime subscription failures, missed events, etc.
    pollTimer = setInterval(() => {
      if (unmounted || doneRef.current) {
        if (pollTimer) clearInterval(pollTimer);
        return;
      }
      fetchEvents();
    }, 2000);

    // 4. After 4s with no events, POST /simulate to restart a stuck simulation
    triggerTimer = setTimeout(() => {
      if (unmounted || doneRef.current) return;
      if (processedSeqs.current.size === 0) {
        triggerSimulation();
      }
    }, 4000);

    return () => {
      unmounted = true;
      if (pollTimer) clearInterval(pollTimer);
      if (triggerTimer) clearTimeout(triggerTimer);
      supabase.removeChannel(ch);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [match.id]);

  // Stop polling once done
  useEffect(() => {
    doneRef.current = done;
  }, [done]);

function remapScorecard(scorecard: any, cn: Map<string, string>) {
  if (!scorecard) return scorecard;
  const mapped = JSON.parse(JSON.stringify(scorecard));
  const resolve = (n: string) => cn.get(n) ?? n;
  for (const team in mapped) {
    if (mapped[team].batting) {
      mapped[team].batting.forEach((b: any) => {
        b.name = resolve(b.name);
        if (b.out_by) b.out_by = resolve(b.out_by);
      });
    }
    if (mapped[team].bowling) {
      mapped[team].bowling.forEach((b: any) => b.name = resolve(b.name));
    }
  }
  return mapped;
}

  // ── Derived ───────────────────────────────────────────────────────────────
  // Always show the most recent ball across both innings for the live scorecard
  const latestBall = balls2.length > 0
    ? balls2[balls2.length - 1]
    : balls1.length > 0 ? balls1[balls1.length - 1] : null;
  const liveDetail = latestBall as unknown as MatchDetail | null;
  const allBalls   = [...balls1, ...balls2];
  // Use scorecard from match_complete event, or fall back to the stored match scorecard.
  // Always sort so the batting-first team appears first.
  const baseScorecard = resultScorecard ?? match.scorecard ?? null;
  const finalScorecard = baseScorecard ? remapScorecard(baseScorecard, commonNamesRef.current) : null;
  const orderedScorecard = finalScorecard && toss
    ? Object.fromEntries(
        Object.entries(finalScorecard).sort(([a]) => (a === toss ? -1 : 1))
      )
    : finalScorecard;


  return (
    <div className="min-h-screen text-[var(--foreground)] flex" style={{ background: 'var(--background)' }}>

      {/* ── Left control sidebar — matches /simulate exactly ──────────────── */}
      <div className="w-14 bg-[var(--surface)] border-r border-[var(--border)] flex flex-col items-center py-4 gap-3 z-50 fixed left-0 h-full">
        <Link href="/duel" className="p-2.5 rounded-xl hover:bg-[var(--surface-2)] text-[var(--muted)] transition" title="Back to Duel">
          <ArrowLeft className="w-4 h-4" />
        </Link>
        <div className="w-8 border-t border-[var(--border)]" />
        <Swords className="w-4 h-4 mt-1" style={{ color: done ? 'var(--sage-green)' : 'var(--sandy-brown)' }} />
        {/* Speed indicator */}
        <div className="flex flex-col items-center gap-0.5 mt-1" title={`Speed: ${match.sim_speed ?? 'moderate'}`}>
          <Zap className="w-3.5 h-3.5" style={{ color: 'var(--palm-leaf)' }} />
          <span className="text-[8px] font-black uppercase" style={{ color: 'var(--muted)' }}>
            {match.sim_speed === 'slow' ? '0.5×' : match.sim_speed === 'max' ? 'MAX' : '2×'}
          </span>
        </div>
        {!done && (
          <div className="mt-auto mb-2">
            <span className="w-2 h-2 rounded-full block bg-[var(--sandy-brown)] animate-pulse" />
          </div>
        )}
      </div>

      {/* ── Main content — ml-14 + full-width grid, same as /simulate ─────── */}
      <div className="flex-1 ml-14 p-4 md:p-8 max-w-[1600px] mx-auto w-full">

        {/* Header */}
        <header className="mb-6 flex justify-between items-center bg-[rgba(var(--surface-rgb),0.5)] p-4 rounded-xl border border-[rgba(var(--border-rgb),0.5)] backdrop-blur">
          <div>
            <div className="flex items-center gap-3">
              {!done && <div className="w-2 h-2 rounded-full bg-[var(--sandy-brown)] animate-pulse" />}
              <h1 className="text-xl font-black italic tracking-tighter text-[var(--foreground)]">
                {done ? 'MATCH COMPLETE' : spectator ? 'LIVE DUEL — SPECTATING' : 'LIVE DUEL'}
              </h1>
            </div>
            <div className="flex gap-3 text-xs font-mono text-[var(--muted)] mt-1 pl-5">
              <span>{myName} <span style={{ color: 'var(--sandy-brown)' }}>vs</span> {oppName}</span>
              {toss && <><span>•</span><span>🪙 {toss} bats first</span></>}
            </div>
          </div>
          {done && (
            <div className="text-[var(--sage-green)] font-bold text-sm bg-[rgba(var(--sage-green-rgb),0.1)] px-3 py-1 rounded-full border border-[rgba(var(--sage-green-rgb),0.2)]">
              SERIES COMPLETE
            </div>
          )}
        </header>

        {/* ── 4-col grid, identical to /simulate ────────────────────────────── */}
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 h-[calc(100vh-140px)]">

          {/* Scorecard column — lg:col-span-3 */}
          <div className="lg:col-span-3 flex flex-col gap-6 h-full overflow-y-auto scrollbar-thin scrollbar-thumb-[var(--border)] pr-2">

            {loading && !done && (
              <div className="flex flex-col items-center justify-center gap-3 py-24">
                <Loader2 className="w-6 h-6 animate-spin" style={{ color: 'var(--sage-green)' }} />
                <span className="text-sm font-bold" style={{ color: 'var(--muted)' }}>Starting simulation…</span>
              </div>
            )}

            {/* Live ScoreCard */}
            {liveDetail && (
              <div className="flex-none">
                <ScoreCardLive detail={liveDetail} live={!done} />
              </div>
            )}

            {/* Final scorecard — same layout as /simulate match history */}
            {done && finalScorecard && (
              <div className="bg-[rgba(var(--surface-rgb),0.5)] border border-[var(--border)] rounded-xl overflow-hidden">
                <div className="bg-[var(--surface)] px-4 py-3 border-b border-[var(--border)] flex justify-between items-center">
                  <span className="text-sm font-bold text-[var(--muted)]">MATCH SCORECARD</span>
                  {match.result && (
                    <span className="text-sm font-bold text-[var(--sage-green)] bg-[rgba(var(--sage-green-rgb),0.1)] px-3 py-1 rounded-full border border-[rgba(var(--sage-green-rgb),0.2)]">
                      {match.result.winner} won by {match.result.margin}
                    </span>
                  )}
                </div>
                <div className="p-4 grid lg:grid-cols-2 gap-6 bg-[rgba(var(--surface-rgb),0.5)]">
                  {Object.entries(orderedScorecard ?? finalScorecard).map(([teamName, sc]: [string, any]) => (
                    <DetailedScorecard key={teamName} teamName={teamName} data={sc} />
                  ))}
                </div>
              </div>
            )}

            {done && !finalScorecard && (
              <div className="flex items-center justify-center gap-2 py-8">
                <Loader2 className="w-4 h-4 animate-spin" style={{ color: 'var(--sage-green)' }} />
                <span className="text-sm" style={{ color: 'var(--muted)' }}>Loading final scorecard…</span>
              </div>
            )}
          </div>

          {/* Commentary column — right sidebar, same as /simulate */}
          <div className="flex flex-col gap-3 h-full min-h-0">
            <div className="bg-[rgba(var(--surface-rgb),0.5)] border border-[var(--border)] rounded-xl overflow-hidden flex flex-col h-full">
              <div className="p-3 border-b border-[var(--border)] bg-[rgba(var(--surface-rgb),0.8)] backdrop-blur flex-none">
                <h3 className="text-xs font-bold text-[var(--muted)] uppercase tracking-widest">Commentary</h3>
              </div>
              <div className="flex-1 overflow-y-auto min-h-0">
                <Commentary events={allBalls} />
              </div>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
