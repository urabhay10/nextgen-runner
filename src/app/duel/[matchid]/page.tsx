'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { Loader2, ArrowLeft, AlertTriangle, Swords } from 'lucide-react';
import { getApiUrl } from '@/lib/api';
import { supabase } from '@/lib/supabase';
import DuelCountdown from '@/components/DuelCountdown';
import DraftPicker from '@/components/DraftPicker';
import OrderSetup from '@/components/OrderSetup';
import DuelSimulation from '@/components/DuelSimulation';
import DuelResults from '@/components/DuelResults';
import SpectatorView from '@/components/SpectatorView';

// ── Types ─────────────────────────────────────────────────────────────────────
type MatchStatus =
  | 'countdown'
  | 'drafting'
  | 'ordering'
  | 'in_progress'
  | 'completed'
  | 'abandoned';

interface DuelMatch {
  id: string;
  status: MatchStatus;
  player1_user_id: string;
  player2_user_id: string;
  player1_display_name: string;
  player2_display_name: string;
  player_pool: any[];
  player1_team: any[];
  player2_team: any[];
  current_pick_turn: string | null;
  current_pick_number: number;
  pick_deadline: string | null;
  order_deadline: string | null;
  player1_orders_ready: boolean;
  player2_orders_ready: boolean;
  player1_batting_order: string[];
  player2_batting_order: string[];
  player1_bowling_order: string[];
  player2_bowling_order: string[];
  result?: any;
  scorecard?: any;
  winner_user_id?: string | null;
  abandon_reason?: string | null;
  completed_at?: string | null;
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function getMyUserId(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('duel_user_id');
}

// ── Page ──────────────────────────────────────────────────────────────────────
export default function DuelMatchPage() {
  const { matchid } = useParams<{ matchid: string }>();
  const router      = useRouter();

  const [match, setMatch]     = useState<DuelMatch | null>(null);
  const [myId, setMyId]       = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState<string | null>(null);
  const [simulationResult, setSimulationResult] = useState<any>(null);
  const [simulationScorecard, setSimulationScorecard] = useState<any>(null);
  const channelRef      = useRef<ReturnType<typeof supabase.channel> | null>(null);
  // Once DuelSimulation is ever rendered in this session, keep it mounted so
  // results appear inline even if the realtime subscription updates the status
  // to 'completed' before the match_complete event fires on the frontend.
  const everSimulatedRef = useRef(false);

  // ── Fetch match ─────────────────────────────────────────────────────────────
  const fetchMatch = useCallback(async () => {
    try {
      const res = await fetch(getApiUrl(`/duel/match/${matchid}`));
      if (!res.ok) throw new Error('Match not found');
      const data: DuelMatch = await res.json();
      setMatch(data);
    } catch (e: any) {
      setError(e.message ?? 'Failed to load match');
    }
  }, [matchid]);

  // ── Init ────────────────────────────────────────────────────────────────────
  useEffect(() => {
    const uid = getMyUserId();
    setMyId(uid);
    fetchMatch().finally(() => setLoading(false));
  }, [fetchMatch]);

  // ── Realtime subscription ───────────────────────────────────────────────────
  useEffect(() => {
    if (!matchid) return;
    if (channelRef.current) supabase.removeChannel(channelRef.current);

    const ch = supabase
      .channel(`match-${matchid}`)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'duel_matches', filter: `id=eq.${matchid}` },
        (payload) => {
          const updated = payload.new as DuelMatch;
          setMatch(updated);
        }
      )
      .subscribe();

    channelRef.current = ch;
    return () => { supabase.removeChannel(ch); };
  }, [matchid]);

  // ── Poll as fallback (every 3s during active phases) ───────────────────────
  useEffect(() => {
    if (!match) return;
    const activeStatuses: MatchStatus[] = ['countdown', 'drafting', 'ordering'];
    if (!activeStatuses.includes(match.status)) return;

    const id = setInterval(fetchMatch, 3000);
    return () => clearInterval(id);
  }, [match?.status, fetchMatch]);

  // ── Simulation complete callback ────────────────────────────────────────────
  const handleSimulationComplete = useCallback((result: any, scorecard: any) => {
    setSimulationResult(result);
    setSimulationScorecard(scorecard);
    // Do NOT fetchMatch() here — DuelSimulation now shows results inline.
    // A background fetch happens via the realtime subscription anyway.
  }, []);

  // ── Guard: spectator (not signed in, or not one of the two players) ────────
  // Once loading is done, determine spectator status definitively
  const confirmedSpectator = !loading && match != null && (
    !myId || ![match.player1_user_id, match.player2_user_id].includes(myId)
  );

  // ── Render ──────────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--background)' }}>
        <Loader2 className="w-8 h-8 animate-spin" style={{ color: 'var(--sage-green)' }} />
      </div>
    );
  }

  if (error || !match) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 px-4" style={{ background: 'var(--background)', color: 'var(--foreground)' }}>
        <AlertTriangle className="w-10 h-10" style={{ color: 'var(--sandy-brown)' }} />
        <p className="text-lg font-black">{error ?? 'Match not found'}</p>
        <Link href="/duel" className="px-5 py-2 rounded-xl text-sm font-bold" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
          Back to Duel
        </Link>
      </div>
    );
  }

  const effectiveUserId = myId ?? '';

  // ── Spectator: route to read-only views ─────────────────────────────────────
  if (confirmedSpectator) {
    // Abandoned — same screen for everyone
    if (match.status === 'abandoned') {
      return (
        <div className="min-h-screen flex flex-col items-center justify-center gap-4 px-4 text-center" style={{ background: 'var(--background)', color: 'var(--foreground)' }}>
          <AlertTriangle className="w-10 h-10" style={{ color: 'var(--sandy-brown)' }} />
          <p className="text-xl font-black">Match Abandoned</p>
          {match.abandon_reason && (
            <p className="text-sm max-w-sm" style={{ color: 'var(--muted)' }}>{match.abandon_reason}</p>
          )}
          <Link href="/duel" className="mt-4 px-6 py-3 rounded-2xl font-black text-sm uppercase tracking-widest" style={{ background: 'var(--sage-green)', color: '#000' }}>
            New Duel
          </Link>
        </div>
      );
    }

    // Completed — show neutral results (winner name, not "You Won")
    if (match.status === 'completed') {
      // If spectator watched live (DuelSimulation was mounted), keep it so
      // inline results render correctly.
      if (everSimulatedRef.current) {
        return (
          <DuelSimulation
            match={match}
            myUserId={match.player1_user_id}
            onComplete={handleSimulationComplete}
            spectator
          />
        );
      }
      const result    = simulationResult   ?? match.result;
      const scorecard = simulationScorecard ?? match.scorecard;
      if (!result || !scorecard) {
        return (
          <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--background)' }}>
            <Loader2 className="w-8 h-8 animate-spin" style={{ color: 'var(--sage-green)' }} />
          </div>
        );
      }
      // Pass '' as myUserId — iWon will be false → shows "{winner} Wins!" which is correct for spectator
      return <DuelResults match={match} myUserId="" result={result} scorecard={scorecard} />;
    }

    // In progress — live simulation in spectator mode
    if (match.status === 'in_progress') {
      everSimulatedRef.current = true;
      return (
        <DuelSimulation
          match={match}
          myUserId={match.player1_user_id}
          onComplete={handleSimulationComplete}
          spectator
        />
      );
    }

    // countdown / drafting / ordering — dedicated spectator UI
    return <SpectatorView match={match} />;
  }

  // ── Participant views ────────────────────────────────────────────────────────
  if (match.status === 'abandoned') {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 px-4 text-center" style={{ background: 'var(--background)', color: 'var(--foreground)' }}>
        <AlertTriangle className="w-10 h-10" style={{ color: 'var(--sandy-brown)' }} />
        <p className="text-xl font-black">Match Abandoned</p>
        {match.abandon_reason && (
          <p className="text-sm max-w-sm" style={{ color: 'var(--muted)' }}>{match.abandon_reason}</p>
        )}
        <Link href="/duel" className="mt-4 px-6 py-3 rounded-2xl font-black text-sm uppercase tracking-widest" style={{ background: 'var(--sage-green)', color: '#000' }}>
          New Duel
        </Link>
      </div>
    );
  }

  // ── Results ─────────────────────────────────────────────────────────────────
  if (match.status === 'completed') {
    // If we started watching the simulation in this browser session, keep
    // DuelSimulation mounted — it renders inline results once the
    // match_complete event drains through the queue.
    // This avoids the race condition where the DB status flips to 'completed'
    // before the frontend has processed the match_complete event.
    if (everSimulatedRef.current) {
      return (
        <DuelSimulation
          match={match}
          myUserId={effectiveUserId}
          onComplete={handleSimulationComplete}
        />
      );
    }

    // Fresh page-load (user navigated here after the match ended) — show the
    // static results page directly.
    const result    = simulationResult   ?? match.result;
    const scorecard = simulationScorecard ?? match.scorecard;

    if (!result || !scorecard) {
      return (
        <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--background)' }}>
          <Loader2 className="w-8 h-8 animate-spin" style={{ color: 'var(--sage-green)' }} />
        </div>
      );
    }

    return (
      <DuelResults
        match={match}
        myUserId={effectiveUserId}
        result={result}
        scorecard={scorecard}
      />
    );
  }

  // ── Simulation ──────────────────────────────────────────────────────────────
  if (match.status === 'in_progress') {
    // Mark that this browser session has started watching the simulation.
    // This ref persists across re-renders so the completed branch below can
    // keep DuelSimulation mounted even after status flips to 'completed'.
    everSimulatedRef.current = true;
    return (
      <DuelSimulation
        match={match}
        myUserId={effectiveUserId}
        onComplete={handleSimulationComplete}
      />
    );
  }

  // ── Order setup ─────────────────────────────────────────────────────────────
  if (match.status === 'ordering') {
    return (
      <div style={{ background: 'var(--background)', minHeight: '100vh' }}>
        <div className="px-4 pt-6 max-w-2xl mx-auto">
          <Link href="/" className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-widest mb-6 hover:opacity-70 transition-opacity" style={{ color: 'var(--muted)' }}>
            <ArrowLeft className="w-3.5 h-3.5" /> Home
          </Link>
        </div>
        <OrderSetup match={match} myUserId={effectiveUserId} />
      </div>
    );
  }

  // ── Draft ────────────────────────────────────────────────────────────────────
  if (match.status === 'drafting') {
    return (
      <div style={{ background: 'var(--background)', minHeight: '100vh' }}>
        {/* <div className="px-4 pt-6 max-w-5xl mx-auto">
          <Link href="/" className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-widest mb-4 hover:opacity-70 transition-opacity" style={{ color: 'var(--muted)' }}>
            <ArrowLeft className="w-3.5 h-3.5" /> Home
          </Link>
        </div> */}
        <DraftPicker match={match} myUserId={effectiveUserId} />
      </div>
    );
  }

  // ── Countdown ────────────────────────────────────────────────────────────────
  return <DuelCountdown match={match} myUserId={effectiveUserId} />;
}
