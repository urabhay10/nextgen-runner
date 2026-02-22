'use client';

import { Loader2, RefreshCw, AlertCircle } from 'lucide-react';
import { SlottedPlayer } from '@/types';

interface BowlingOrderEditorProps {
  teamName: string;
  /** Slotted players — each slot has a stable uid so duplicate names are distinguishable. */
  players: SlottedPlayer[];
  /** Names returned by the eligible-bowlers endpoint. */
  eligibleBowlers?: string[];
  /** Per-over uid assignments (empty string = unset). */
  bowlingOrder: string[];
  onOrderChange: (order: string[]) => void;
  onDefault: () => void;
  loading: boolean;
}

/**
 * Build a uid → display-label map. When a name appears more than once
 * the label gets a positional suffix: "V Kohli (1)", "V Kohli (2)".
 */
function buildLabels(players: SlottedPlayer[]): Map<string, string> {
  const counts = new Map<string, number>();
  players.forEach(p => counts.set(p.name, (counts.get(p.name) ?? 0) + 1));

  const seen = new Map<string, number>();
  const map = new Map<string, string>();
  players.forEach(p => {
    if (counts.get(p.name)! > 1) {
      const n = (seen.get(p.name) ?? 0) + 1;
      seen.set(p.name, n);
      map.set(p.uid, `${p.name} (${n})`);
    } else {
      map.set(p.uid, p.name);
    }
  });
  return map;
}

/** Returns a set of over indices that have consecutive-bowler (same uid) violations. */
function getConsecutiveIndices(order: string[]): Set<number> {
  const bad = new Set<number>();
  for (let i = 1; i < order.length; i++) {
    if (order[i] && order[i] === order[i - 1]) {
      bad.add(i - 1);
      bad.add(i);
    }
  }
  return bad;
}

const BowlingOrderEditor = ({
  teamName, players, eligibleBowlers, bowlingOrder, onOrderChange, onDefault, loading,
}: BowlingOrderEditorProps) => {
  const labels = buildLabels(players);

  // Stats keyed by uid so duplicate-name players are counted separately
  const stats: Record<string, number> = {};
  let assignedCount = 0;
  bowlingOrder.forEach(uid => {
    if (uid) { stats[uid] = (stats[uid] || 0) + 1; assignedCount++; }
  });

  const isComplete = assignedCount === 20;
  const consecutiveBad = getConsecutiveIndices(bowlingOrder);

  // Eligible bowlers list (SlottedPlayer[]) filtered to those whose name the backend flagged
  const bowlersList: SlottedPlayer[] =
    eligibleBowlers && eligibleBowlers.length > 0
      ? players.filter(p => eligibleBowlers.includes(p.name) && p.name.trim() !== '')
      : players.filter(p => p.name.trim() !== '');

  const handleBowlerChange = (overIndex: number, uid: string) => {
    const newOrder = [...bowlingOrder];
    newOrder[overIndex] = uid;
    onOrderChange(newOrder);
  };

  // Summary banners
  const exceeds4 = Object.entries(stats)
    .filter(([, c]) => c > 4)
    .map(([uid]) => `${labels.get(uid) ?? uid} (${stats[uid]}/4 overs)`);
  const consecutiveCount = bowlingOrder.reduce(
    (acc, _, i) => (i > 0 && bowlingOrder[i] && bowlingOrder[i] === bowlingOrder[i - 1] ? acc + 1 : acc), 0,
  );

  return (
    <div className="bg-[rgba(var(--surface-rgb),0.5)] p-6 rounded-2xl border border-[var(--border)]">
      <div className="flex justify-between items-center mb-4">
        <div className="flex flex-col">
          <h3 className="text-lg font-bold text-[var(--muted)]">
            Bowling Order: <span className="text-[var(--sage-green)]">{teamName}</span>
          </h3>
          <span className={`text-xs ${isComplete ? 'text-[var(--sage-green)]' : 'text-[var(--sandy-brown)]'}`}>
            {assignedCount}/20 overs assigned
          </span>
        </div>
        <button
          onClick={onDefault}
          disabled={loading}
          className="text-xs flex items-center gap-2 px-3 py-1.5 rounded bg-[var(--border)] hover:bg-[rgba(var(--border-rgb),0.8)] text-[var(--muted)] transition disabled:opacity-50"
        >
          {loading ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />}
          {loading ? 'Generating…' : 'Generate (ILP)'}
        </button>
      </div>

      {exceeds4.length > 0 && (
        <div className="mb-3 px-3 py-2 rounded-lg flex items-center gap-2 text-xs font-bold"
          style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.3)', color: '#ef4444' }}>
          <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
          {exceeds4.join(', ')} — exceeds 4-over limit
        </div>
      )}
      {consecutiveCount > 0 && (
        <div className="mb-3 px-3 py-2 rounded-lg flex items-center gap-2 text-xs font-bold"
          style={{ background: 'rgba(245,166,91,0.1)', border: '1px solid rgba(245,166,91,0.4)', color: 'var(--sandy-brown)' }}>
          <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
          {consecutiveCount} consecutive over{consecutiveCount > 1 ? 's' : ''} by same bowler — can't bowl 2 overs in a row
        </div>
      )}

      {/* Bowler quota pills */}
      <div className="mb-5 flex flex-wrap gap-2">
        {Object.entries(stats).map(([uid, overs]) => {
          const label = labels.get(uid) ?? uid;
          const over4 = overs > 4;
          return (
            <div key={uid} className="text-xs px-2 py-1 rounded border"
              style={{
                background: over4 ? 'rgba(239,68,68,0.12)' : 'var(--border)',
                borderColor: over4 ? '#ef4444' : 'rgba(var(--border-rgb),0.8)',
                color: over4 ? '#ef4444' : 'var(--muted)',
              }}>
              {label}: <span className="font-bold" style={{ color: over4 ? '#ef4444' : 'var(--foreground)' }}>{overs}</span>
              {over4 && ' ⚠'}
            </div>
          );
        })}
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-3">
        {Array.from({ length: 20 }).map((_, i) => {
          const uid = bowlingOrder[i];
          const isOver4 = uid ? (stats[uid] ?? 0) > 4 : false;
          const isConsec = consecutiveBad.has(i);

          let borderColor = 'var(--border)';
          let focusBorderColor = 'var(--sage-green)';
          if (isOver4 && isConsec) { borderColor = '#ef4444'; focusBorderColor = '#ef4444'; }
          else if (isOver4) { borderColor = '#ef4444'; focusBorderColor = '#ef4444'; }
          else if (isConsec) { borderColor = 'var(--sandy-brown)'; focusBorderColor = 'var(--sandy-brown)'; }

          return (
            <div key={i} className="flex flex-col gap-1">
              <div className="flex justify-between items-center text-[10px] font-bold text-[var(--muted)] uppercase leading-tight">
                <span>Over {i + 1}</span>
                {isOver4 && isConsec && <span style={{ color: '#ef4444' }}>⚠ limit + 2 in a row</span>}
                {isOver4 && !isConsec && <span style={{ color: '#ef4444' }}>⚠ exceeds 4</span>}
                {!isOver4 && isConsec && <span style={{ color: 'var(--sandy-brown)' }}>⚠ 2 in a row</span>}
              </div>
              <select
                value={uid || ''}
                onChange={e => handleBowlerChange(i, e.target.value)}
                className="bg-[var(--background)] border rounded px-2 py-1.5 text-xs text-[var(--muted)] outline-none w-full transition-colors"
                style={{ borderColor, outline: 'none' }}
                onFocus={e => { e.currentTarget.style.borderColor = focusBorderColor; }}
                onBlur={e => { e.currentTarget.style.borderColor = borderColor; }}
              >
                <option value="" disabled>Select Bowler</option>
                {bowlersList.map(p => (
                  <option key={p.uid} value={p.uid}>{labels.get(p.uid) ?? p.name}</option>
                ))}
              </select>
            </div>
          );
        })}
      </div>

      <div className="mt-4 text-[10px] text-[var(--muted)] text-center">
        * Standard T20 rules: max 4 overs per bowler, no bowler can bowl 2 overs in a row. Total 20 overs.
      </div>
    </div>
  );
};

export default BowlingOrderEditor;
