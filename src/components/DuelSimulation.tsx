'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { Loader2, Swords, ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { getApiUrl } from '@/lib/api';
import { fetchCommonNames } from '@/lib/commonNames';
import { supabase } from '@/lib/supabase';
import ScoreCardLive from './ScoreCardLive';
import Commentary from './Commentary';
import DuelResults from './DuelResults';
import { BallEvent, MatchDetail } from '@/types';

// ── Types ─────────────────────────────────────────────────────────────────────
interface DuelSimulationProps {
  match:       any;
  myUserId:    string;
  onComplete:  (result: any, scorecard: any) => void;
  spectator?:  boolean;
  apiUrlFn?:   (path: string) => string;
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

// ── Natural speed config ──────────────────────────────────────────────────────
/** Base inter-ball delay (ms) — outcome and over multipliers are applied on top. */
const NATURAL_BASE_MS = 600;

/**
 * Compute natural delay for the ball that was just played.
 * @param over    0-indexed over (0-19)
 * @param outcome Runs scored, or 'W' for wicket
 */
function naturalDelay(over: number, outcome: number | string): number {
  const ballMult =
    outcome === 'W' ? 3.0
    : outcome === 6  ? 2.0
    : outcome === 4  ? 1.5
    : outcome === 2  ? 1.25
    : outcome === 1  ? 1.05
    : 1.0;
  // Overs 16-19: tension ramps from 1.1× up to 1.4×
  const overMult = over <= 15 ? 1.0 : 1 + (over - 15) / 10;
  return Math.round(NATURAL_BASE_MS * ballMult * overMult);
}

/** Derive delay from a raw event row (non-ball events get the base delay). */
function delayForRow(row: RawEventRow): number {
  const ev = row.event;
  if (ev.type !== 'ball') return NATURAL_BASE_MS;
  const outcome = ev.is_wicket ? 'W' : (ev.runs_scored ?? 0);
  const over    = ev.over ?? 0;
  return naturalDelay(over, outcome);
}

// ── Component ─────────────────────────────────────────────────────────────────
export default function DuelSimulation({ match, myUserId, onComplete, spectator = false, apiUrlFn = getApiUrl }: DuelSimulationProps) {
  const isP1    = match.player1_user_id === myUserId;
  // In spectator mode, always show player1 as "left" and player2 as "right" with neutral labels
  const myName  = spectator ? match.player1_display_name : (isP1 ? match.player1_display_name : match.player2_display_name);
  const oppName = spectator ? match.player2_display_name : (isP1 ? match.player2_display_name : match.player1_display_name);

  // ── State ──────────────────────────────────────────────────────────────────
  const [balls1, setBalls1]   = useState<BallEvent[]>([]);
  const [balls2, setBalls2]   = useState<BallEvent[]>([]);
  const [toss, setToss]       = useState<string | null>(null);
  const [resultScorecard, setResultScorecard] = useState<any>(null);
  const [resultData, setResultData]           = useState<any>(null);
  const [done, setDone]       = useState(false);
  const [loading, setLoading] = useState(true);

  const processedSeqs  = useRef<Set<number>>(new Set());
  const channelRef     = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const onCompleteRef  = useRef(onComplete);
  const doneRef        = useRef(false);
  const triggeredRef   = useRef(false);   // have we POSTed /simulate yet?
  // pendingDone: match_complete event was received; waiting for queue to drain
  const pendingDoneRef   = useRef(false);
  const pendingResultRef = useRef<{ result: any; scorecard: any } | null>(null);
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
  // FIXED_DELAY_MS so playback speed is consistent.
  const queueRef      = useRef<RawEventRow[]>([]);
  const drainingRef   = useRef(false);
  // fetchEventsRef — filled in after fetchEvents is defined (avoids circular deps)
  const fetchEventsRef = useRef<() => Promise<void>>(() => Promise.resolve());

  const drainQueue = useCallback(() => {
    if (drainingRef.current) return;
    drainingRef.current = true;

    const step = async () => {
      const row = queueRef.current.shift();
      if (!row) {
        // Queue is empty.
        if (pendingDoneRef.current) {
          // match_complete was received but we must ensure all preceding ball
          // events have been fetched (they might still be in-flight from the
          // server).  Do one final fetch before declaring the match over.
          await fetchEventsRef.current();
          if (queueRef.current.length > 0) {
            // More events arrived — keep draining them first.
            setTimeout(step, NATURAL_BASE_MS);
            return;
          }
          // All events processed — now mark the match as done.
          drainingRef.current  = false;
          pendingDoneRef.current = false;
          doneRef.current      = true;
          setDone(true);
          setLoading(false);
          const r = pendingResultRef.current;
          if (r) onCompleteRef.current(r.result, r.scorecard);
        } else {
          drainingRef.current = false;
        }
        return;
      }
      applyRowRef.current(row);
      // Use natural delay based on what just happened
      setTimeout(step, delayForRow(row));
    };
    step();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
      setLoading(false);
      if (ev.scorecard) setResultScorecard(ev.scorecard);
      if (ev.result)    setResultData(ev.result);
      // Don't fire setDone() here — wait until the drain queue is empty so
      // all 2nd-innings ball events are displayed before results appear.
      pendingDoneRef.current  = true;
      pendingResultRef.current = { result: ev.result, scorecard: ev.scorecard };
      // onCompleteRef is called by the drain loop once the queue empties.
    }
  }, []);

  // Wire applyRow into the ref so drainQueue can call it
  applyRowRef.current = applyRow;

  // ── Fetch all events since last known seq ──────────────────────────────────
  const fetchEvents = useCallback(async () => {
    try {
      const res = await fetch(apiUrlFn(`/duel/match/${match.id}/events`));
      if (!res.ok) return;
      const rows: RawEventRow[] = await res.json();
      rows.sort((a, b) => a.seq - b.seq);
      rows.forEach(processRow);
    } catch {
      // ignore network errors; will retry
    }
  }, [match.id, processRow]);

  // Keep fetchEventsRef up-to-date so drainQueue can call it without a
  // stale closure or a circular dependency.
  fetchEventsRef.current = fetchEvents;

  // ── Auto-trigger stuck simulation (call /simulate if no events after delay) ─
  const triggerSimulation = useCallback(async () => {
    if (triggeredRef.current) return;
    triggeredRef.current = true;
    try {
      await fetch(apiUrlFn(`/duel/match/${match.id}/simulate`), { method: 'POST' });
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

  // ── Derived ───────────────────────────────────────────────────────────────
  // Always show the most recent ball across both innings for the live scorecard
  const latestBall = balls2.length > 0
    ? balls2[balls2.length - 1]
    : balls1.length > 0 ? balls1[balls1.length - 1] : null;
  const liveDetail = latestBall as unknown as MatchDetail | null;
  const allBalls   = [...balls1, ...balls2];
  const finalScorecard = resultScorecard ?? null;

  // ── Ref for the results section (auto-scroll target) ──────────────────────
  const resultsRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to results when simulation finishes
  useEffect(() => {
    if (!done) return;
    const timer = setTimeout(() => {
      resultsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 600); // small delay so the element renders first
    return () => clearTimeout(timer);
  }, [done]);

  // Build the result object from the match_complete event for DuelResults
  const inlineResult = resultData ?? match.result ?? null;

  return (
    <div className="min-h-screen text-[var(--foreground)] flex" style={{ background: 'var(--background)' }}>

      {/* ── Control strip — sidebar on desktop, bottom bar on mobile ───────── */}
      <div className="
        fixed z-50 bg-[var(--surface)] border-[var(--border)]
        bottom-0 left-0 right-0 h-12 border-t flex-row
        md:bottom-auto md:left-0 md:top-0 md:right-auto md:w-14 md:h-full md:border-t-0 md:border-r md:flex-col md:py-4 md:gap-3
        flex items-center justify-around md:justify-start px-4 md:px-0
      ">
        <Link href="/duel" className="p-2.5 rounded-xl hover:bg-[var(--surface-2)] text-[var(--muted)] transition" title="Back to Duel">
          <ArrowLeft className="w-4 h-4" />
        </Link>
        <div className="hidden md:block w-8 border-t border-[var(--border)]" />
        <Swords className="w-4 h-4 md:mt-1" style={{ color: done ? 'var(--sage-green)' : 'var(--sandy-brown)' }} />
        {!done && (
          <div className="md:mt-auto md:mb-2">
            <span className="w-2 h-2 rounded-full block bg-[var(--sandy-brown)] animate-pulse" />
          </div>
        )}
      </div>

      {/* ── Main content ──────────────────────────────────────────────────── */}
      <div className="flex-1 md:ml-14 pb-14 md:pb-0 p-3 md:p-6 max-w-[1600px] mx-auto w-full overflow-y-auto">

        {/* Header */}
        <header className="mb-4 md:mb-6 flex justify-between items-center bg-[rgba(var(--surface-rgb),0.5)] p-3 md:p-4 rounded-xl border border-[rgba(var(--border-rgb),0.5)] backdrop-blur">
          <div>
            <div className="flex items-center gap-2 md:gap-3">
              {!done && <div className="w-2 h-2 rounded-full bg-[var(--sandy-brown)] animate-pulse" />}
              <h1 className="text-base md:text-xl font-black italic tracking-tighter text-[var(--foreground)]">
                {done ? 'MATCH COMPLETE' : spectator ? 'LIVE DUEL — SPECTATING' : 'LIVE DUEL'}
              </h1>
            </div>
            <div className="flex flex-wrap gap-2 md:gap-3 text-xs font-mono text-[var(--muted)] mt-1 pl-5">
              <span>{myName} <span style={{ color: 'var(--sandy-brown)' }}>vs</span> {oppName}</span>
              {toss && <><span>•</span><span>🪙 {toss} bats first</span></>}
              {match.result?.venue_name && match.result.venue_name !== 'Unknown Venue' && (
                <><span>•</span><span>📍 {match.result.venue_name}</span></>
              )}
            </div>
          </div>
          {done && (
            <div className="text-[var(--sage-green)] font-bold text-xs md:text-sm bg-[rgba(var(--sage-green-rgb),0.1)] px-2 md:px-3 py-1 rounded-full border border-[rgba(var(--sage-green-rgb),0.2)]">
              COMPLETE
            </div>
          )}
        </header>

        {/* ── Live grid: scorecard (left/top) + commentary (right/bottom) ──── */}
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 lg:h-[calc(100vh-140px)]">

          {/* Scorecard column — lg:col-span-3 */}
          <div className="lg:col-span-3 flex flex-col gap-6 lg:h-full lg:overflow-y-auto scrollbar-thin scrollbar-thumb-[var(--border)] lg:pr-2">

            {loading && !done && (
              <div className="flex flex-col items-center justify-center gap-3 py-24">
                <Loader2 className="w-6 h-6 animate-spin" style={{ color: 'var(--sage-green)' }} />
                <span className="text-sm font-bold" style={{ color: 'var(--muted)' }}>Starting simulation…</span>
              </div>
            )}

            {/* Live ScoreCard — stays visible even after done */}
            {liveDetail && (
              <div className="flex-none">
                <ScoreCardLive detail={liveDetail} live={!done} />
              </div>
            )}

            {/* Waiting for scorecard after done */}
            {done && !finalScorecard && (
              <div className="flex items-center justify-center gap-2 py-8">
                <Loader2 className="w-4 h-4 animate-spin" style={{ color: 'var(--sage-green)' }} />
                <span className="text-sm" style={{ color: 'var(--muted)' }}>Loading final results…</span>
              </div>
            )}
          </div>

          {/* Commentary column — fixed height on mobile, full height on desktop */}
          <div className="flex flex-col gap-3 h-72 lg:h-full lg:min-h-0">
            <div className="bg-[rgba(var(--surface-rgb),0.5)] border border-[var(--border)] rounded-xl overflow-hidden flex flex-col h-full">
              <div className="flex-1 overflow-y-auto min-h-0">
                <Commentary events={allBalls} />
              </div>
            </div>
          </div>
        </div>

        {/* ── Inline Results — rendered below the live grid when done ──────── */}
        {done && finalScorecard && inlineResult && (
          <div ref={resultsRef} className="mt-10 mb-10">
            <DuelResults
              match={match}
              myUserId={spectator ? '' : myUserId}
              result={inlineResult}
              scorecard={finalScorecard}
            />
          </div>
        )}
      </div>
    </div>
  );
}
