'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Swords, ArrowLeft, RotateCcw } from 'lucide-react';
import DetailedScorecard from './DetailedScorecard';
import { fetchCommonNames, dn } from '@/lib/commonNames';

interface DuelResultsProps {
  match: any;
  myUserId: string;
  result: { winner: string; margin: string; score1: string; score2: string; batting_first: string };
  scorecard: Record<string, any>;
}

export default function DuelResults({ match, myUserId, result, scorecard }: DuelResultsProps) {
  const isP1    = match.player1_user_id === myUserId;
  const myName  = isP1 ? match.player1_display_name : match.player2_display_name;
  const oppName = isP1 ? match.player2_display_name : match.player1_display_name;

  const iWon  = result.winner === myName;
  const isTie = result.winner === 'Tie';

  // Ensure batting-first team is always the first tab / left column.
  const teams = Object.keys(scorecard).sort((a) => (a === result.batting_first ? -1 : 1));
  const [tab, setTab] = useState(result.batting_first ?? teams[0]);

  // ── Common names (display-only) ────────────────────────────────────────
  const [cn, setCn] = useState<Map<string, string>>(new Map());
  useEffect(() => {
    // Collect all player names from both teams' scorecards
    const names: string[] = [];
    Object.values(scorecard).forEach((sc: any) => {
      (sc.batting ?? []).forEach((b: any) => { if (b.name) names.push(b.name); if (b.out_by) names.push(b.out_by); });
      (sc.bowling ?? []).forEach((b: any) => { if (b.name) names.push(b.name); });
    });
    if (!names.length) return;
    fetchCommonNames([...new Set(names)]).then(setCn);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /** Apply common-name mapping to a scorecard object for display only. */
  function mapScorecard(sc: any): any {
    if (!sc) return sc;
    return {
      ...sc,
      batting: (sc.batting ?? []).map((b: any) => ({
        ...b,
        name: dn(b.name, cn),
        out_by: b.out_by ? dn(b.out_by, cn) : b.out_by,
      })),
      bowling: (sc.bowling ?? []).map((b: any) => ({
        ...b,
        name: dn(b.name, cn),
      })),
    };
  }

  return (
    <div className="min-h-screen px-3 sm:px-4 py-5 sm:py-6 max-w-3xl mx-auto" style={{ color: 'var(--foreground)' }}>

      {/* ── Result banner ─────────────────────────────────────────────────── */}
      <div className="rounded-2xl sm:rounded-3xl p-5 sm:p-8 mb-5 sm:mb-6 text-center relative overflow-hidden" style={{
        background: isTie
          ? 'var(--surface)'
          : iWon
            ? 'linear-gradient(135deg, rgba(108,174,117,0.15), rgba(108,174,117,0.05))'
            : 'linear-gradient(135deg, rgba(245,166,91,0.15), rgba(245,166,91,0.05))',
        border: `1px solid ${isTie ? 'var(--border)' : iWon ? 'rgba(108,174,117,0.4)' : 'rgba(245,166,91,0.4)'}`,
      }}>
        <div className="text-[9px] uppercase font-black tracking-widest mb-1" style={{ color: 'var(--muted)' }}>Match Result</div>
        {isTie ? (
          <div className="text-xl sm:text-2xl font-black">It&apos;s a Tie!</div>
        ) : (
          <>
            <div className="text-xl sm:text-2xl font-black" style={{ color: iWon ? 'var(--sage-green)' : 'var(--sandy-brown)' }}>
              {iWon ? 'You Won!' : `${result.winner} Wins!`}
            </div>
            <div className="text-sm mt-1" style={{ color: 'var(--muted)' }}>by {result.margin}</div>
          </>
        )}
        {/* Scores */}
        <div className="flex justify-center gap-4 sm:gap-6 mt-4 sm:mt-5">
          <div className="text-center">
            <div className="text-[9px] uppercase font-black tracking-widest mb-0.5" style={{ color: 'var(--muted)' }}>{result.batting_first}</div>
            <div className="text-lg sm:text-xl font-black font-mono" style={{ color: 'var(--sage-green)' }}>{result.score1}</div>
          </div>
          <div className="flex items-center"><Swords className="w-4 h-4 sm:w-5 sm:h-5" style={{ color: 'var(--sandy-brown)' }} /></div>
          <div className="text-center">
            <div className="text-[9px] uppercase font-black tracking-widest mb-0.5" style={{ color: 'var(--muted)' }}>
              {teams.find(t => t !== result.batting_first) ?? ''}
            </div>
            <div className="text-lg sm:text-xl font-black font-mono" style={{ color: 'var(--sandy-brown)' }}>{result.score2}</div>
          </div>
        </div>
      </div>

      {/* ── Scorecard (matches /simulate exactly) ─────────────────────────── */}
      <div className="bg-[rgba(var(--surface-rgb),0.5)] border border-[var(--border)] rounded-xl overflow-hidden mb-6">
        {/* Tab bar */}
        <div className="flex border-b border-[var(--border)]">
          {teams.map(t => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className="flex-1 py-2.5 text-xs font-black uppercase tracking-wider transition-all"
              style={{
                background: tab === t ? 'var(--sage-green)' : 'var(--surface)',
                color: tab === t ? '#000' : 'var(--muted)',
                borderRight: '1px solid var(--border)',
              }}
            >
              {t}
            </button>
          ))}
        </div>

        {/* Detailed scorecard — same component as /simulate match history */}
        <div className="p-4">
          {tab && scorecard[tab] && (
            <DetailedScorecard teamName={tab} data={mapScorecard(scorecard[tab])} />
          )}
        </div>
      </div>

      {/* ── Actions ───────────────────────────────────────────────────────── */}
      <div className="flex flex-col gap-3">
        <Link href="/duel"
          className="w-full py-3.5 rounded-2xl font-black text-sm uppercase tracking-wider flex items-center justify-center gap-2 transition-all hover:opacity-90"
          style={{ background: 'var(--sandy-brown)', color: '#000' }}>
          <RotateCcw className="w-4 h-4" /> Play Again
        </Link>
        <Link href="/"
          className="w-full py-3.5 rounded-2xl font-black text-sm uppercase tracking-wider flex items-center justify-center gap-2 transition-all hover:opacity-80"
          style={{ background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--muted)' }}>
          <ArrowLeft className="w-4 h-4" /> Home
        </Link>
      </div>
    </div>
  );
}


