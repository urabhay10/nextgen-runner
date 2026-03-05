'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { Loader2, GripVertical, Clock, Check, AlertCircle, ChevronUp, ChevronDown } from 'lucide-react';
import { teamFlag } from '@/lib/flags';
import { getApiUrl, generateBattingOrder } from '@/lib/api';
import { useCommonNames, dn } from '@/lib/commonNames';
import BowlingOrderEditor from './BowlingOrderEditor';
import type { SlottedPlayer } from '@/types';

interface PoolPlayer { name: string; team: string; can_bowl: boolean; }

interface OrderSetupProps {
  match: any;
  myUserId: string;
  apiUrlFn?: (path: string) => string;
}

function useCountdown(deadlineIso: string | null) {
  // Initialise synchronously so secs never starts at 0 unless the deadline has passed.
  const [secs, setSecs] = useState<number | null>(() => {
    if (!deadlineIso) return null;
    return Math.max(0, Math.floor((new Date(deadlineIso).getTime() - Date.now()) / 1000));
  });
  useEffect(() => {
    if (!deadlineIso) return;
    const tick = () => {
      const diff = Math.max(0, Math.floor((new Date(deadlineIso).getTime() - Date.now()) / 1000));
      setSecs(diff);
    };
    tick();
    const id = setInterval(tick, 500);
    return () => clearInterval(id);
  }, [deadlineIso]);
  return secs;
}

/** Build a default 20-over schedule from eligible bowlers (≤4 overs each). */
function buildDefaultBowlingOrder(eligibleNames: string[]): string[] {
  if (eligibleNames.length === 0) return Array(20).fill('');
  const order: string[] = [];
  const quotas: Record<string, number> = {};
  eligibleNames.forEach(n => { quotas[n] = 4; });
  let last = '';
  for (let i = 0; i < 20; i++) {
    // prefer not repeating last bowler, prefer those with most quota remaining
    const opts = eligibleNames
      .filter(n => quotas[n] > 0 && n !== last)
      .sort((a, b) => quotas[b] - quotas[a]);
    const pick = opts[0] ?? eligibleNames.find(n => quotas[n] > 0) ?? eligibleNames[0];
    order.push(pick);
    quotas[pick]--;
    last = pick;
  }
  return order;
}

export default function OrderSetup({ match, myUserId, apiUrlFn = getApiUrl }: OrderSetupProps) {
  const isP1 = match.player1_user_id === myUserId;
  const myTeam: PoolPlayer[] = (isP1 ? match.player1_team : match.player2_team) ?? [];
  const myReadyKey = isP1 ? 'player1_orders_ready' : 'player2_orders_ready';
  const alreadySubmitted = !!match[myReadyKey];

  const eligibleBowlers = myTeam.filter(p => p.can_bowl === true);
  const eligibleNames   = eligibleBowlers.map(p => p.name);

  // ── Common names (display-only — never sent back to server) ────────────
  const cn = useCommonNames(myTeam.map(p => p.name));

  const [batting, setBatting] = useState<string[]>(myTeam.map(p => p.name));
  const [bowlingOrder, setBowlingOrder] = useState<string[]>(() => buildDefaultBowlingOrder(eligibleNames));
  const [loadingDefault, setLoadingDefault] = useState(false);
  const [loadingBatting, setLoadingBatting] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(alreadySubmitted);
  const [submitError, setSubmitError] = useState('');
  const [tab, setTab] = useState<'bat' | 'bowl'>('bat');

  const secsLeft = useCountdown(match.order_deadline);
  const p1Ready  = match.player1_orders_ready;
  const p2Ready  = match.player2_orders_ready;
  const oppReady = isP1 ? p2Ready : p1Ready;
  const myDisplayName  = isP1 ? match.player1_display_name : match.player2_display_name;
  const oppDisplayName = isP1 ? match.player2_display_name : match.player1_display_name;

  // ── Validation ──────────────────────────────────────────────────────────
  const bowlingComplete = bowlingOrder.length === 20 && bowlingOrder.every(n => n !== '');
  const bowlerOverCounts: Record<string, number> = {};
  bowlingOrder.forEach(n => { if (n) bowlerOverCounts[n] = (bowlerOverCounts[n] ?? 0) + 1; });
  const exceeds4 = Object.entries(bowlerOverCounts).filter(([, c]) => c > 4);
  const nonEligible = bowlingOrder.filter(n => n && !eligibleNames.includes(n));
  const consecutiveViolations = bowlingOrder.filter(
    (n, i) => i > 0 && n && n === bowlingOrder[i - 1]
  ).length;
  const canSubmit = bowlingComplete && exceeds4.length === 0 && nonEligible.length === 0
    && consecutiveViolations === 0 && eligibleBowlers.length >= 5;

  // ── Call the ILP backend to generate an optimised bowling schedule ────
  const fetchIlpOrder = useCallback(async () => {
    if (eligibleNames.length < 5) return;
    setLoadingDefault(true);
    try {
      const res = await fetch(apiUrlFn('/generate_bowling_order'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ players: eligibleNames }),
      });
      if (!res.ok) throw new Error('ILP request failed');
      const data = await res.json();
      setBowlingOrder(data.bowling_order);
    } catch {
      // graceful fallback to local greedy schedule
      setBowlingOrder(buildDefaultBowlingOrder(eligibleNames));
    } finally {
      setLoadingDefault(false);
    }
  }, [eligibleNames]);

  // ── Call the batting order endpoint to get the optimal default ────────
  const allPlayerNames = myTeam.map(p => p.name);
  const fetchBattingOrder = useCallback(async () => {
    const names = myTeam.map(p => p.name);
    if (names.length === 0) return;
    setLoadingBatting(true);
    try {
      const items = await generateBattingOrder(names);
      if (!Array.isArray(items) || items.length === 0) return;
      // API returns sorted by position — extract player names in order
      const ordered = items.map(item => item.player);
      // Only keep players that are actually in the team
      const validResolved = ordered.filter(n => names.includes(n));
      // Append any players not returned by the API (safety net)
      const missing = names.filter(n => !validResolved.includes(n));
      setBatting([...validResolved, ...missing]);
    } catch (e) {
      console.error('[OrderSetup] fetchBattingOrder failed:', e);
      // Keep draft order as-is
    } finally {
      setLoadingBatting(false);
    }
  // myTeam comes from props and is stable; re-reading inside avoids stale closure
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [myTeam]);

  // Auto-fetch both orders on mount
  useEffect(() => {
    if (!alreadySubmitted) {
      fetchIlpOrder();
      fetchBattingOrder();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleReset = fetchIlpOrder;

  // ── Track last valid order for auto-submit on timeout ──────────────────
  const lastValidOrderRef = useRef<{ batting: string[]; bowling: string[] } | null>(null);
  useEffect(() => {
    if (canSubmit) lastValidOrderRef.current = { batting, bowling: bowlingOrder };
  }, [canSubmit, batting, bowlingOrder]);

  // ── Auto-submit when timer hits 0 ─────────────────────────────────────
  useEffect(() => {
    if (secsLeft !== null && secsLeft === 0 && !submitted && !submitting) {
      const saved = lastValidOrderRef.current;
      if (saved) {
        // silently submit last valid order
        fetch(apiUrlFn(`/duel/match/${match.id}/orders`), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            user_id: myUserId,
            batting_order: saved.batting,
            bowling_order: saved.bowling,
          }),
        }).then(r => { if (r.ok) setSubmitted(true); }).catch(() => {});
      }
    }
  }, [secsLeft, submitted, submitting, match.id, myUserId]);

  const handleSubmit = useCallback(async () => {
    if (submitting || submitted) return;
    setSubmitError('');
    if (!canSubmit) {
      if (eligibleBowlers.length < 5) {
        setSubmitError(`Your team only has ${eligibleBowlers.length} eligible bowler(s). Need at least 5.`);
      } else if (!bowlingComplete) {
        setSubmitError('Please assign a bowler to every over (20 total).');
      } else if (exceeds4.length > 0) {
        setSubmitError(`Bowler(s) exceed 4-over limit: ${exceeds4.map(([n, c]) => `${n}(${c})`).join(', ')}`);
      } else if (consecutiveViolations > 0) {
        setSubmitError(`${consecutiveViolations} consecutive over(s) by the same bowler — can't bowl 2 overs in a row.`);
      }
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch(apiUrlFn(`/duel/match/${match.id}/orders`), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: myUserId,
          batting_order: batting,
          bowling_order: bowlingOrder,
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        setSubmitError(err.detail ?? 'Submission failed. Please check your orders.');
        return;
      }
      setSubmitted(true);
    } catch (e) {
      console.error(e);
      setSubmitError('Network error. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }, [submitting, submitted, canSubmit, bowlingComplete, exceeds4, eligibleBowlers.length, bowlingOrder, batting, match.id, myUserId]);

  // ── Drag-and-drop for batting order ───────────────────────────────────
  const dragIdx = useRef<number | null>(null);
  const [dragOver, setDragOver] = useState<number | null>(null);

  const moveBatter = useCallback((from: number, to: number) => {
    if (submitted) return;
    setBatting(prev => {
      const arr = [...prev];
      const [item] = arr.splice(from, 1);
      arr.splice(to, 0, item);
      return arr;
    });
  }, [submitted]);

  const onDragStart = (i: number) => { dragIdx.current = i; };
  const onDragEnter = (i: number) => { setDragOver(i); };
  const onDragEnd   = () => { dragIdx.current = null; setDragOver(null); };
  const onDrop      = (toIdx: number) => {
    if (submitted) return;
    const fromIdx = dragIdx.current;
    if (fromIdx === null || fromIdx === toIdx) return;
    moveBatter(fromIdx, toIdx);
    dragIdx.current = null;
    setDragOver(null);
  };

  const secsNum    = secsLeft ?? 0;
  const timerColor = secsNum <= 30 ? 'var(--sandy-brown)' : 'var(--sage-green)';
  const timerPct   = Math.min(100, (secsNum / 90) * 100);

  return (
    <div className="min-h-screen px-3 sm:px-4 py-5 sm:py-6 max-w-2xl mx-auto" style={{ color: 'var(--foreground)' }}>
      {/* Header */}
      <div className="rounded-2xl p-4 mb-5 flex items-center justify-between gap-4" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
        <div>
          <div className="text-[9px] uppercase font-black tracking-widest mb-1" style={{ color: 'var(--palm-leaf)' }}>Order Setup</div>
          <div className="text-base font-black">Set your batting &amp; bowling order</div>
          <div className="text-xs mt-0.5" style={{ color: 'var(--muted)' }}>Auto-submitted when timer runs out</div>
          {match.result?.venue_name && match.result.venue_name !== 'Unknown Venue' && (
            <div className="flex items-center gap-1 mt-1.5">
              <span className="text-xs">📍</span>
              <span className="text-xs font-bold" style={{ color: 'var(--sage-green)' }}>{match.result.venue_name}</span>
            </div>
          )}
        </div>
        {/* Timer ring */}
        <div className="flex flex-col items-center flex-shrink-0">
          <div className="relative w-14 h-14">
            <svg className="w-full h-full -rotate-90" viewBox="0 0 36 36">
              <circle cx="18" cy="18" r="15.9" fill="none" stroke="var(--border)" strokeWidth="3" />
              <circle cx="18" cy="18" r="15.9" fill="none" stroke={timerColor} strokeWidth="3"
                strokeDasharray={`${timerPct} 100`}
                style={{ transition: 'stroke-dasharray 1s linear, stroke 0.3s' }}
                strokeLinecap="round" />
            </svg>
            <span className="absolute inset-0 flex items-center justify-center text-xs font-black font-mono" style={{ color: timerColor }}>
              {secsLeft === null ? '…' : `${secsLeft}s`}
            </span>
          </div>
        </div>
      </div>

      {/* Eligible bowler count banner */}
      <div className="rounded-xl px-4 py-2.5 mb-4 flex items-center gap-2"
        style={{
          background: eligibleBowlers.length >= 5 ? 'rgba(108,174,117,0.08)' : 'rgba(245,166,91,0.1)',
          border: `1px solid ${eligibleBowlers.length >= 5 ? 'rgba(108,174,117,0.3)' : 'rgba(245,166,91,0.4)'}`,
        }}>
        {eligibleBowlers.length >= 5
          ? <Check className="w-4 h-4 flex-shrink-0" style={{ color: 'var(--sage-green)' }} />
          : <AlertCircle className="w-4 h-4 flex-shrink-0" style={{ color: 'var(--sandy-brown)' }} />}
        <span className="text-xs font-bold">
          {eligibleBowlers.length >= 5
            ? `${eligibleBowlers.length} eligible bowlers on your team ✓`
            : `⚠ Only ${eligibleBowlers.length} eligible bowler(s) — need at least 5`}
        </span>
      </div>

      {/* Ready status */}
      <div className="flex gap-3 mb-5">
        {[{ label: 'You', name: myDisplayName, ready: submitted }, { label: 'Opponent', name: oppDisplayName, ready: oppReady }].map((p, i) => (
          <div key={i} className="flex-1 rounded-xl px-3 py-2.5 flex items-center gap-2"
            style={{ background: 'var(--surface)', border: `1px solid ${p.ready ? 'var(--sage-green)' : 'var(--border)'}` }}>
            {p.ready
              ? <Check className="w-4 h-4 flex-shrink-0" style={{ color: 'var(--sage-green)' }} />
              : (i === 0
                ? <Clock className="w-4 h-4 flex-shrink-0" style={{ color: 'var(--muted)' }} />
                : <Loader2 className="w-4 h-4 flex-shrink-0 animate-spin" style={{ color: 'var(--muted)' }} />)}
            <div>
              <div className="text-[9px] uppercase font-black tracking-widest" style={{ color: 'var(--muted)' }}>{p.label}</div>
              <div className="text-xs font-bold">{p.name}</div>
            </div>
            <span className="ml-auto text-[10px] font-black px-2 py-0.5 rounded-full"
              style={{
                background: p.ready ? 'rgba(108,174,117,0.15)' : 'var(--surface-2)',
                color: p.ready ? 'var(--sage-green)' : 'var(--muted)',
              }}>
              {p.ready ? 'READY' : 'SETTING…'}
            </span>
          </div>
        ))}
      </div>

      {/* Tab switcher */}
      <div className="flex mb-4 rounded-xl overflow-hidden" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
        {(['bat', 'bowl'] as const).map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className="flex-1 py-2.5 text-xs font-black uppercase tracking-widest transition-all"
            style={{
              background: tab === t ? (t === 'bat' ? 'var(--sage-green)' : 'var(--sandy-brown)') : 'transparent',
              color: tab === t ? '#000' : 'var(--muted)',
            }}
          >
            {t === 'bat' ? '🏏 Batting Order' : '🎳 Bowling Order'}
          </button>
        ))}
      </div>

      {/* ── Batting order (drag-and-drop) ─────────────────────────────────── */}
      {tab === 'bat' && (
        <div className="rounded-2xl p-4 mb-4" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
          <div className="flex items-center justify-between mb-1">
            <div className="text-[9px] uppercase font-black tracking-widest" style={{ color: 'var(--sage-green)' }}>
              Batting Order
            </div>
            {loadingBatting && (
              <div className="flex items-center gap-1.5">
                <Loader2 className="w-3 h-3 animate-spin" style={{ color: 'var(--sage-green)' }} />
                <span className="text-[9px] font-bold" style={{ color: 'var(--sage-green)' }}>Generating optimal order…</span>
              </div>
            )}
          </div>
          <div className="text-xs mb-3" style={{ color: 'var(--muted)' }}>
            {loadingBatting
              ? 'Calculating the best batting order using historical position data…'
              : 'Drag rows to reorder your 11 batters.'}
          </div>
          <div className="flex flex-col gap-1.5">
            {batting.map((name, i) => {
              const p = myTeam.find(pl => pl.name === name);
              const isDragTarget = dragOver === i;
              const canMove = !submitted && !loadingBatting;
              return (
                <div
                  key={name}
                  draggable={canMove}
                  onDragStart={() => onDragStart(i)}
                  onDragEnter={() => onDragEnter(i)}
                  onDragOver={e => e.preventDefault()}
                  onDragEnd={onDragEnd}
                  onDrop={() => onDrop(i)}
                  className="flex items-center gap-2 px-3 py-2.5 rounded-xl transition-all"
                  style={{
                    background: isDragTarget ? 'rgba(108,174,117,0.1)' : 'var(--surface-2)',
                    border: `1px solid ${isDragTarget ? 'var(--sage-green)' : 'var(--border)'}`,
                    cursor: canMove ? 'grab' : 'default',
                    opacity: loadingBatting ? 0.5 : dragIdx.current === i ? 0.5 : 1,
                  }}
                >
                  <span className="text-[10px] font-black font-mono w-5 text-center" style={{ color: 'var(--muted)' }}>{i + 1}</span>
                  <GripVertical className="w-4 h-4 flex-shrink-0 hidden sm:block" style={{ color: canMove ? 'var(--muted)' : 'var(--border)' }} />
                  <span className="text-sm">{p ? teamFlag([p.team]) : ''}</span>
                  <span className="flex-1 text-sm font-bold truncate">{dn(name, cn)}</span>
                  {p?.can_bowl && (
                    <span className="text-[8px] px-1.5 py-0.5 rounded font-black flex-shrink-0"
                      style={{ background: 'rgba(245,166,91,0.15)', color: 'var(--sandy-brown)' }}>BOWL</span>
                  )}
                  {/* Touch-friendly move buttons — visible on mobile, hidden on desktop */}
                  <div className="sm:hidden flex flex-col -my-1 flex-shrink-0">
                    <button
                      disabled={!canMove || i === 0}
                      onClick={() => moveBatter(i, i - 1)}
                      className="p-0.5 rounded transition-opacity disabled:opacity-20"
                      style={{ color: 'var(--muted)' }}
                      aria-label="Move up"
                    >
                      <ChevronUp className="w-4 h-4" />
                    </button>
                    <button
                      disabled={!canMove || i === batting.length - 1}
                      onClick={() => moveBatter(i, i + 1)}
                      className="p-0.5 rounded transition-opacity disabled:opacity-20"
                      style={{ color: 'var(--muted)' }}
                      aria-label="Move down"
                    >
                      <ChevronDown className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Bowling order (BowlingOrderEditor) ────────────────────────────── */}
      {tab === 'bowl' && (
        <div className="mb-4">
          {eligibleBowlers.length < 5 ? (
            <div className="rounded-2xl p-6 text-center" style={{ background: 'var(--surface)', border: '1px solid rgba(245,166,91,0.4)' }}>
              <AlertCircle className="w-8 h-8 mx-auto mb-2" style={{ color: 'var(--sandy-brown)' }} />
              <div className="font-black text-sm mb-1" style={{ color: 'var(--sandy-brown)' }}>
                Not Enough Eligible Bowlers
              </div>
              <div className="text-xs" style={{ color: 'var(--muted)' }}>
                Your team has {eligibleBowlers.length} eligible bowler(s). T20 requires at least 5.<br />
                This can happen if you drafted too many batters. The match may be forfeited.
              </div>
            </div>
          ) : (
            <BowlingOrderEditor
              teamName={myDisplayName}
              players={myTeam.map((p, i): SlottedPlayer => ({ uid: p.name, name: dn(p.name, cn), gameId: i }))}
              eligibleBowlers={eligibleNames.map(n => dn(n, cn))}
              bowlingOrder={bowlingOrder}
              onOrderChange={setBowlingOrder}
              onDefault={handleReset}
              loading={loadingDefault}
            />
          )}
        </div>
      )}

      {/* Error */}
      {submitError && (
        <div className="rounded-xl px-4 py-3 mb-4 flex items-start gap-2"
          style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.25)', color: '#ef4444' }}>
          <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
          <span className="text-xs font-bold">{submitError}</span>
        </div>
      )}

      {/* Submit */}
      {!submitted ? (
        <button
          onClick={handleSubmit}
          disabled={submitting}
          className="w-full py-4 rounded-2xl font-black text-sm uppercase tracking-wider flex items-center justify-center gap-2 transition-all hover:opacity-90 active:scale-95"
          style={{
            background: canSubmit
              ? 'var(--sandy-brown)'
              : 'var(--surface)',
            color: canSubmit ? '#000' : 'var(--muted)',
            border: canSubmit ? 'none' : '1px solid var(--border)',
          }}
        >
          {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
          {submitting ? 'Submitting…' : canSubmit ? 'Lock In Orders' : consecutiveViolations > 0 ? 'Fix Consecutive Bowlers' : 'Complete All Orders First'}
        </button>
      ) : (
        <div className="w-full py-4 rounded-2xl font-black text-sm uppercase tracking-wider flex items-center justify-center gap-2"
          style={{ background: 'rgba(108,174,117,0.15)', color: 'var(--sage-green)', border: '1px solid var(--sage-green)' }}>
          <Check className="w-4 h-4" />
          Orders Locked! Waiting for opponent…
        </div>
      )}
    </div>
  );
}
