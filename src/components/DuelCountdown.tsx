'use client';

import { useEffect, useState, useRef } from 'react';
import { Swords, Check, Loader2, ShieldCheck } from 'lucide-react';
import { teamFlag } from '@/lib/flags';
import { getApiUrl } from '@/lib/api';
import { supabase } from '@/lib/supabase';
import { useCommonNames, dn } from '@/lib/commonNames';

interface PoolPlayer { name: string; team: string; can_bowl: boolean; }
interface PlayerMiniStats { runs: number; sr: number; wkts: number | null; eco: number | null; }

interface DuelCountdownProps {
  match: any;
  myUserId: string;
}

const COUNTDOWN_SECS = 35;

export default function DuelCountdown({ match, myUserId }: DuelCountdownProps) {
  const isP1 = match.player1_user_id === myUserId;
  const myName  = isP1 ? match.player1_display_name : match.player2_display_name;
  const oppName = isP1 ? match.player2_display_name : match.player1_display_name;

  const [secsLeft, setSecsLeft] = useState(COUNTDOWN_SECS);
  const [myReady, setMyReady]     = useState(false);
  const [oppReady, setOppReady]   = useState(false);
  const [starting, setStarting]   = useState(false);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  const pool: PoolPlayer[] = match.player_pool ?? [];
  const bowlerCount = pool.filter(p => p.can_bowl).length;

  // Fetch common (display) names for all pool players — display only, never sent to server
  const cn = useCommonNames(pool.map(p => p.name));

  // ── Fetch mini-stats for all pool players ─────────────────────────────
  const [poolStats, setPoolStats] = useState<Map<string, PlayerMiniStats>>(new Map());
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
            wkts: data.bowling?.wickets ?? null,
            eco:  data.bowling?.economy ?? null,
          } as PlayerMiniStats] as const;
        } catch { return [p.name, null] as const; }
      })
    ).then(results => {
      const map = new Map<string, PlayerMiniStats>();
      for (const [name, s] of results) { if (s) map.set(name, s); }
      setPoolStats(map);
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Countdown timer ──────────────────────────────────────────────────
  useEffect(() => {
    const id = setInterval(() => setSecsLeft(s => Math.max(0, s - 1)), 1000);
    return () => clearInterval(id);
  }, []);

  // ── Supabase broadcast channel ────────────────────────────────────────
  useEffect(() => {
    const ch = supabase
      .channel(`lineup-ready-${match.id}`)
      .on('broadcast', { event: 'ready' }, ({ payload }: any) => {
        if (payload.user_id !== myUserId) setOppReady(true);
      })
      .subscribe();
    channelRef.current = ch;
    return () => { supabase.removeChannel(ch); };
  }, [match.id, myUserId]);

  // ── Trigger early start when both ready ───────────────────────────────
  const triggerStart = async () => {
    if (starting) return;
    setStarting(true);
    try {
      await fetch(getApiUrl(`/duel/match/${match.id}/start_draft`), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: myUserId, player_name: '' }),
      });
    } catch { /* backend fallback handles it */ }
  };

  useEffect(() => {
    if (myReady && oppReady) triggerStart();
  }, [myReady, oppReady]);

  const handleReady = () => {
    if (myReady) return;
    setMyReady(true);
    channelRef.current?.send({
      type: 'broadcast', event: 'ready', payload: { user_id: myUserId },
    });
  };

  const timerPct = (secsLeft / COUNTDOWN_SECS) * 100;
  const timerColor = secsLeft <= 10 ? 'var(--sandy-brown)' : 'var(--sage-green)';

  return (
    <div className="min-h-screen px-3 sm:px-4 py-5 sm:py-6 max-w-4xl mx-auto" style={{ color: 'var(--foreground)' }}>
      {/* VS header */}
      <div className="rounded-2xl p-3 sm:p-4 mb-4 sm:mb-5 flex items-center gap-3 sm:gap-4" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
        <div className="flex-1 flex items-center gap-2 sm:gap-3">
          <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl flex items-center justify-center text-lg sm:text-xl flex-shrink-0"
            style={{ background: 'rgba(108,174,117,0.15)', border: '1px solid rgba(108,174,117,0.3)' }}>🏏</div>
          <div>
            <div className="text-[9px] uppercase font-black tracking-widest" style={{ color: 'var(--sage-green)' }}>You</div>
            <div className="text-xs sm:text-sm font-black truncate max-w-[100px] sm:max-w-none">{myName}</div>
          </div>
        </div>
        <Swords className="w-4 h-4 sm:w-5 sm:h-5 flex-shrink-0" style={{ color: 'var(--sandy-brown)' }} />
        <div className="flex-1 flex items-center justify-end gap-2 sm:gap-3">
          <div className="text-right">
            <div className="text-[9px] uppercase font-black tracking-widest" style={{ color: 'var(--sandy-brown)' }}>Opponent</div>
            <div className="text-xs sm:text-sm font-black truncate max-w-[100px] sm:max-w-none">{oppName}</div>
          </div>
          <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl flex items-center justify-center text-lg sm:text-xl flex-shrink-0"
            style={{ background: 'rgba(245,166,91,0.15)', border: '1px solid rgba(245,166,91,0.3)' }}>🎯</div>
        </div>

        {/* Timer ring */}
        <div className="relative w-14 h-14 flex-shrink-0 ml-2">
          <svg className="w-full h-full -rotate-90" viewBox="0 0 36 36">
            <circle cx="18" cy="18" r="15.9" fill="none" stroke="var(--border)" strokeWidth="3" />
            <circle cx="18" cy="18" r="15.9" fill="none" stroke={timerColor} strokeWidth="3"
              strokeDasharray={`${timerPct} 100`}
              style={{ transition: 'stroke-dasharray 1s linear, stroke 0.3s' }}
              strokeLinecap="round" />
          </svg>
          <span className="absolute inset-0 flex items-center justify-center text-xs font-black font-mono" style={{ color: timerColor }}>
            {secsLeft}s
          </span>
        </div>
      </div>

      {/* Ready status */}
      <div className="flex gap-3 mb-5">
        {[{ label: 'You', name: myName, ready: myReady }, { label: 'Opponent', name: oppName, ready: oppReady }].map((p, i) => (
          <div key={i} className="flex-1 rounded-xl px-3 py-2.5 flex items-center gap-2"
            style={{ background: 'var(--surface)', border: `1px solid ${p.ready ? 'var(--sage-green)' : 'var(--border)'}` }}>
            {p.ready
              ? <Check className="w-4 h-4 flex-shrink-0" style={{ color: 'var(--sage-green)' }} />
              : <Loader2 className="w-4 h-4 flex-shrink-0 animate-spin" style={{ color: 'var(--muted)' }} />}
            <div>
              <div className="text-[9px] uppercase font-black tracking-widest" style={{ color: 'var(--muted)' }}>{p.label}</div>
              <div className="text-xs font-bold">{p.name}</div>
            </div>
            <span className="ml-auto text-[10px] font-black px-2 py-0.5 rounded-full"
              style={{
                background: p.ready ? 'rgba(108,174,117,0.15)' : 'var(--surface-2)',
                color: p.ready ? 'var(--sage-green)' : 'var(--muted)',
              }}>
              {p.ready ? 'READY' : 'REVIEWING…'}
            </span>
          </div>
        ))}
      </div>

      {/* I'm Ready button */}
      {!myReady ? (
        <button
          onClick={handleReady}
          className="w-full py-3.5 rounded-2xl font-black text-sm uppercase tracking-wider mb-5 transition-all hover:opacity-90 active:scale-95"
          style={{ background: 'var(--sage-green)', color: '#000' }}
        >
          ✓ I've Seen the Lineup — I'm Ready!
        </button>
      ) : (
        <div className="w-full py-3.5 rounded-2xl font-black text-sm uppercase tracking-wider mb-5 text-center flex items-center justify-center gap-2"
          style={{ background: 'rgba(108,174,117,0.12)', color: 'var(--sage-green)', border: '1px solid var(--sage-green)' }}>
          <Check className="w-4 h-4" />
          {oppReady ? 'Both Ready — Starting Draft…' : 'Waiting for opponent…'}
        </div>
      )}

      {/* Draft rules */}
      <div className="rounded-2xl p-4 mb-4 flex flex-col gap-2" style={{ background: 'var(--surface)', border: '1px solid rgba(var(--sage-green-rgb),0.3)' }}>
        <div className="flex items-center gap-2 mb-1">
          <ShieldCheck className="w-4 h-4 flex-shrink-0" style={{ color: 'var(--sage-green)' }} />
          <span className="text-[9px] uppercase font-black tracking-widest" style={{ color: 'var(--sage-green)' }}>Draft Rules</span>
        </div>
        {[
          { ok: pool.length >= 11, text: `Pool has ${pool.length} players (need 11+)` },
          { ok: bowlerCount >= 5,  text: `Pool has ${bowlerCount} eligible bowlers (need 5+)` },
          { ok: true,              text: 'Each team picks 11 players total' },
          { ok: true,              text: 'Your team must include ≥ 5 eligible bowlers' },
          { ok: true,              text: 'Max 4 overs per bowler · No bowler bowls 2 overs in a row' },
        ].map((rule, i) => (
          <div key={i} className="flex items-center gap-2 text-xs font-bold">
            <span style={{ color: rule.ok ? 'var(--sage-green)' : 'var(--sandy-brown)' }}>
              {rule.ok ? '✓' : '✗'}
            </span>
            <span style={{ color: rule.ok ? 'var(--foreground)' : 'var(--sandy-brown)' }}>{rule.text}</span>
          </div>
        ))}
      </div>

      {/* Player pool — with mini stats */}
      <div className="rounded-2xl p-3 sm:p-4" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
        <div className="text-[9px] uppercase font-black tracking-widest mb-1" style={{ color: 'var(--palm-leaf)' }}>
          Draft Pool — {pool.length} Players
        </div>
        <div className="text-xs mb-3 sm:mb-4" style={{ color: 'var(--muted)' }}>
          Study the pool before the draft starts. <span style={{ color: 'var(--sandy-brown)' }}>BOWL</span> = eligible bowler.
        </div>
        <div className="flex flex-col gap-1 sm:gap-1.5">
          {pool.map((p: PoolPlayer, i: number) => {
            const s = poolStats.get(p.name);
            return (
              <div key={i}
                className="flex items-center gap-1.5 sm:gap-2 px-2 sm:px-3 py-1.5 sm:py-2 rounded-lg"
                style={{
                  background: p.can_bowl ? 'rgba(245,166,91,0.07)' : 'var(--surface-2)',
                  border: `1px solid ${p.can_bowl ? 'rgba(245,166,91,0.25)' : 'var(--border)'}`,
                }}>
                <span className="text-[11px] flex-shrink-0">{teamFlag([p.team])}</span>
                <span className="flex-1 text-xs font-black truncate">{dn(p.name, cn)}</span>
                {/* Stats inline — hide some on mobile */}
                {s && (
                  <div className="flex items-center gap-2 sm:gap-3 flex-shrink-0 mr-1">
                    <div className="flex flex-col items-center leading-none">
                      <span className="text-[7px] uppercase font-black" style={{ color: 'var(--palm-leaf)' }}>R</span>
                      <span className="text-[11px] font-black font-mono" style={{ color: 'var(--sage-green)' }}>{s.runs}</span>
                    </div>
                    <div className="hidden sm:flex flex-col items-center leading-none">
                      <span className="text-[7px] uppercase font-black" style={{ color: 'var(--palm-leaf)' }}>SR</span>
                      <span className="text-[11px] font-black font-mono" style={{ color: 'var(--sage-green)' }}>{s.sr.toFixed(0)}</span>
                    </div>
                    {s.wkts !== null && (
                      <div className="flex flex-col items-center leading-none">
                        <span className="text-[7px] uppercase font-black" style={{ color: 'var(--palm-leaf)' }}>W</span>
                        <span className="text-[11px] font-black font-mono" style={{ color: 'var(--sandy-brown)' }}>{s.wkts}</span>
                      </div>
                    )}
                    {s.eco !== null && (
                      <div className="hidden sm:flex flex-col items-center leading-none">
                        <span className="text-[7px] uppercase font-black" style={{ color: 'var(--palm-leaf)' }}>Eco</span>
                        <span className="text-[11px] font-black font-mono" style={{ color: 'var(--sandy-brown)' }}>{s.eco.toFixed(1)}</span>
                      </div>
                    )}
                  </div>
                )}
                {p.can_bowl && (
                  <span className="text-[8px] px-1 py-0.5 rounded font-black flex-shrink-0"
                    style={{ background: 'rgba(245,166,91,0.2)', color: 'var(--sandy-brown)' }}>BOWL</span>
                )}
              </div>
            );
          })}
        </div>
      </div>

      <p className="mt-4 text-center text-xs font-bold uppercase tracking-widest" style={{ color: 'var(--muted)' }}>
        Draft starts automatically when timer ends or both players are ready
      </p>
    </div>
  );
}
