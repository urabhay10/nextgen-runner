'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { Loader2, ArrowLeft, AlertTriangle } from 'lucide-react';
import { getApiUrl } from '@/lib/api';
import { supabase } from '@/lib/supabase';
import DuelCountdown from '@/components/DuelCountdown';
import DraftPicker from '@/components/DraftPicker';
import OrderSetup from '@/components/OrderSetup';
import DuelSimulation from '@/components/DuelSimulation';
import DuelResults from '@/components/DuelResults';
import SpectatorView from '@/components/SpectatorView';

type MatchStatus = 'countdown' | 'drafting' | 'ordering' | 'in_progress' | 'completed' | 'abandoned';

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
  countdown_deadline: string | null;
  player1_orders_ready: boolean;
  player2_orders_ready: boolean;
  player1_batting_order: string[];
  player2_batting_order: string[];
  player1_bowling_order: string[];
  player2_bowling_order: string[];
  result?: { winner?: string; margin?: string; score1?: string; score2?: string; batting_first?: string } | null;
  scorecard?: any;
  winner_user_id?: string | null;
  abandon_reason?: string | null;
  completed_at?: string | null;
}

function getMyUserId(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('duel_user_id');
}

export default function DuelV1MatchPage() {
  const { matchid } = useParams<{ matchid: string }>();
  const router = useRouter();

  const [match, setMatch] = useState<DuelMatch | null>(null);
  const [myId, setMyId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [simulationResult, setSimulationResult] = useState<any>(null);
  const [simulationScorecard, setSimulationScorecard] = useState<any>(null);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const everSimulatedRef = useRef(false);

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

  useEffect(() => {
    const uid = getMyUserId();
    setMyId(uid);
    fetchMatch().finally(() => setLoading(false));
  }, [fetchMatch]);

  useEffect(() => {
    if (!matchid) return;
    if (channelRef.current) supabase.removeChannel(channelRef.current);
    const ch = supabase
      .channel(`match-v1-${matchid}`)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'duel_matches', filter: `id=eq.${matchid}` },
        (payload) => setMatch(payload.new as DuelMatch))
      .subscribe();
    channelRef.current = ch;
    return () => { supabase.removeChannel(ch); };
  }, [matchid]);

  useEffect(() => {
    if (!match) return;
    const activeStatuses: MatchStatus[] = ['countdown', 'drafting', 'ordering'];
    if (!activeStatuses.includes(match.status)) return;
    const id = setInterval(fetchMatch, 3000);
    return () => clearInterval(id);
  }, [match?.status, fetchMatch]);

  const handleSimulationComplete = useCallback((result: any, scorecard: any) => {
    setSimulationResult(result);
    setSimulationScorecard(scorecard);
  }, []);

  const confirmedSpectator = !loading && match != null && (
    !myId || ![match.player1_user_id, match.player2_user_id].includes(myId)
  );

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--background)' }}>
      <Loader2 className="w-8 h-8 animate-spin" style={{ color: 'var(--sage-green)' }} />
    </div>
  );

  if (error || !match) return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-4 px-4" style={{ background: 'var(--background)', color: 'var(--foreground)' }}>
      <AlertTriangle className="w-10 h-10" style={{ color: 'var(--sandy-brown)' }} />
      <p className="text-lg font-black">{error ?? 'Match not found'}</p>
      <Link href="/v1/duel" className="px-5 py-2 rounded-xl text-sm font-bold" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
        Back to Duel
      </Link>
    </div>
  );

  const effectiveUserId = myId ?? '';

  if (match.status === 'abandoned') return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-4 px-4 text-center" style={{ background: 'var(--background)', color: 'var(--foreground)' }}>
      <AlertTriangle className="w-10 h-10" style={{ color: 'var(--sandy-brown)' }} />
      <p className="text-xl font-black">Match Abandoned</p>
      {match.abandon_reason && <p className="text-sm max-w-sm" style={{ color: 'var(--muted)' }}>{match.abandon_reason}</p>}
      <Link href="/v1/duel" className="mt-4 px-6 py-3 rounded-2xl font-black text-sm uppercase tracking-widest" style={{ background: 'var(--sage-green)', color: '#000' }}>
        New Duel
      </Link>
    </div>
  );

  if (confirmedSpectator) {
    if (match.status === 'completed') {
      const result = simulationResult ?? match.result;
      const scorecard = simulationScorecard ?? match.scorecard;
      if (!result || !scorecard) return <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--background)' }}><Loader2 className="w-8 h-8 animate-spin" style={{ color: 'var(--sage-green)' }} /></div>;
      return <DuelResults match={match} myUserId="" result={result} scorecard={scorecard} />;
    }
    if (match.status === 'in_progress') {
      everSimulatedRef.current = true;
      return <DuelSimulation match={match} myUserId={match.player1_user_id} onComplete={handleSimulationComplete} spectator apiUrlFn={getApiUrl} />;
    }
    return <SpectatorView match={match} />;
  }

  if (match.status === 'completed') {
    if (everSimulatedRef.current) return <DuelSimulation match={match} myUserId={effectiveUserId} onComplete={handleSimulationComplete} apiUrlFn={getApiUrl} />;
    const result = simulationResult ?? match.result;
    const scorecard = simulationScorecard ?? match.scorecard;
    if (!result || !scorecard) return <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--background)' }}><Loader2 className="w-8 h-8 animate-spin" style={{ color: 'var(--sage-green)' }} /></div>;
    return <DuelResults match={match} myUserId={effectiveUserId} result={result} scorecard={scorecard} />;
  }

  if (match.status === 'in_progress') {
    everSimulatedRef.current = true;
    return <DuelSimulation match={match} myUserId={effectiveUserId} onComplete={handleSimulationComplete} apiUrlFn={getApiUrl} />;
  }

  if (match.status === 'ordering') return (
    <div style={{ background: 'var(--background)', minHeight: '100vh' }}>
      <div className="px-4 pt-6 max-w-2xl mx-auto">
        <Link href="/v1" className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-widest mb-6 hover:opacity-70 transition-opacity" style={{ color: 'var(--muted)' }}>
          <ArrowLeft className="w-3.5 h-3.5" /> Home
        </Link>
      </div>
      <OrderSetup match={match} myUserId={effectiveUserId} apiUrlFn={getApiUrl} />
    </div>
  );

  if (match.status === 'drafting') return (
    <div style={{ background: 'var(--background)', minHeight: '100vh' }}>
      <DraftPicker match={match} myUserId={effectiveUserId} apiUrlFn={getApiUrl} />
    </div>
  );

  return <DuelCountdown match={match} myUserId={effectiveUserId} apiUrlFn={getApiUrl} />;
}
