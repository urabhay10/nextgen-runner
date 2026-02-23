'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Swords, Copy, Check, Loader2, Pencil, Shuffle, Users, BookOpen, Zap } from 'lucide-react';
import { getApiUrl } from '@/lib/api';
import { supabase } from '@/lib/supabase';

// ── Types ─────────────────────────────────────────────────────────────────────
interface DuelUser {
  id: string;
  username: string;
  display_name: string;
}
interface Lobby {
  id: string;
  code: string;
  status: string;
  match_id: string | null;
}

// ── Helpers ───────────────────────────────────────────────────────────────────
async function getOrCreateUser(): Promise<DuelUser> {
  const stored = localStorage.getItem('duel_user_id');
  if (stored) {
    try {
      const res = await fetch(getApiUrl(`/duel/user/${stored}`));
      if (res.ok) return res.json();
    } catch { /* fall through to create */ }
  }
  const res = await fetch(getApiUrl('/duel/user'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({}),
  });
  const user: DuelUser = await res.json();
  localStorage.setItem('duel_user_id', user.id);
  return user;
}

// ── Page ──────────────────────────────────────────────────────────────────────
export default function DuelPage() {
  const router = useRouter();

  const [user, setUser]           = useState<DuelUser | null>(null);
  const [lobby, setLobby]         = useState<Lobby | null>(null);
  const [joinCode, setJoinCode]   = useState('');
  const [loading, setLoading]     = useState(true);
  const [creating, setCreating]   = useState(false);
  const [joining, setJoining]     = useState(false);
  const [copied, setCopied]       = useState(false);
  const [editingName, setEditingName] = useState(false);
  const [draftName, setDraftName] = useState('');
  const [savingName, setSavingName]   = useState(false);
  const [joinError, setJoinError] = useState('');
  const [autoPickEnabled, setAutoPickEnabled] = useState(false);
  const [simSpeed, setSimSpeed] = useState<'slow' | 'moderate' | 'max'>('moderate');

  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  // ── Init user ──────────────────────────────────────────────────────────────
  useEffect(() => {
    getOrCreateUser()
      .then(u => { setUser(u); setDraftName(u.display_name); })
      .finally(() => setLoading(false));
    // Restore preferences
    setAutoPickEnabled(localStorage.getItem('duel_auto_pick') === 'true');
    const storedSpeed = localStorage.getItem('duel_sim_speed');
    if (storedSpeed === 'slow' || storedSpeed === 'moderate' || storedSpeed === 'max') {
      setSimSpeed(storedSpeed);
    }
  }, []);

  // ── Subscribe to lobby realtime once we have one ───────────────────────────
  useEffect(() => {
    if (!lobby) return;
    if (channelRef.current) supabase.removeChannel(channelRef.current);

    const ch = supabase
      .channel(`lobby-${lobby.id}`)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'duel_lobbies', filter: `id=eq.${lobby.id}` },
        (payload) => {
          const updated = payload.new as Lobby;
          setLobby(updated);
          if (updated.status === 'matched' && updated.match_id) {
            router.push(`/duel/${updated.match_id}`);
          }
        }
      )
      .subscribe();

    channelRef.current = ch;
    return () => { supabase.removeChannel(ch); };
  }, [lobby, router]);

  // ── Polling fallback — check every 3 s in case Realtime doesn't fire ──────
  useEffect(() => {
    if (!lobby || lobby.status === 'matched') return;
    const timer = setInterval(async () => {
      try {
        const res = await fetch(getApiUrl(`/duel/lobby/${lobby.id}`));
        if (!res.ok) return;
        const updated: Lobby = await res.json();
        if (updated.status === 'matched' && updated.match_id) {
          router.push(`/duel/${updated.match_id}`);
        }
      } catch { /* network error — try again next tick */ }
    }, 3000);
    return () => clearInterval(timer);
  }, [lobby?.id, lobby?.status, router]);

  // ── Create lobby ───────────────────────────────────────────────────────────
  const handleCreate = async () => {
    if (!user) return;
    setCreating(true);
    try {
      const res = await fetch(getApiUrl('/duel/lobby'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: user.id }),
      });
      if (!res.ok) throw new Error();
      const data: Lobby = await res.json();
      setLobby(data);
    } catch {
      alert('Failed to create lobby. Please try again.');
    } finally {
      setCreating(false);
    }
  };

  // ── Join lobby ─────────────────────────────────────────────────────────────
  const handleJoin = async () => {
    if (!user || joinCode.length !== 4) return;
    setJoining(true);
    setJoinError('');
    try {
      const res = await fetch(getApiUrl('/duel/lobby/join'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: user.id, code: joinCode }),
      });
      if (!res.ok) {
        const err = await res.json();
        setJoinError(err.detail || 'Code not found or already used.');
        return;
      }
      const data = await res.json();
      router.push(`/duel/${data.match_id}`);
    } catch {
      setJoinError('Network error. Please try again.');
    } finally {
      setJoining(false);
    }
  };

  // ── Copy code ──────────────────────────────────────────────────────────────
  const handleCopy = () => {
    if (!lobby) return;
    navigator.clipboard.writeText(lobby.code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // ── Save display name ──────────────────────────────────────────────────────
  const handleSaveName = async () => {
    if (!user || !draftName.trim()) return;
    setSavingName(true);
    try {
      const res = await fetch(getApiUrl(`/duel/user/${user.id}/display_name`), {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ display_name: draftName.trim() }),
      });
      if (!res.ok) throw new Error();
      const updated: DuelUser = await res.json();
      setUser(updated);
      setEditingName(false);
    } catch {
      alert('Failed to update name.');
    } finally {
      setSavingName(false);
    }
  };

  // ── Render ─────────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--background)' }}>
        <Loader2 className="w-8 h-8 animate-spin" style={{ color: 'var(--sage-green)' }} />
      </div>
    );
  }

  return (
    <div className="min-h-screen" style={{ background: 'var(--background)', color: 'var(--foreground)' }}>
      <div className="max-w-[1200px] mx-auto px-4 py-8 flex gap-8 items-start">
        
        {/* ── LEFT — lobby panel ──────────────────────────────────────── */}
        <div className="w-full max-w-md flex-shrink-0 flex flex-col">
<Link href="/" className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-widest mb-8 hover:opacity-70 transition-opacity" style={{ color: 'var(--muted)' }}>
        <ArrowLeft className="w-3.5 h-3.5" /> Back
      </Link>

      {/* Header */}
      <div className="flex items-center gap-3 mb-8">
        <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: 'rgba(var(--sandy-brown-rgb),0.12)', border: '1px solid rgba(var(--sandy-brown-rgb),0.3)' }}>
          <Swords className="w-5 h-5" style={{ color: 'var(--sandy-brown)' }} />
        </div>
        <div>
          <h1 className="text-xl font-black">1v1 Cricket Duel</h1>
          <p className="text-xs" style={{ color: 'var(--muted)' }}>Draft your squad and go head-to-head</p>
        </div>
      </div>

      {/* Player card */}
      <div className="rounded-2xl p-5 mb-6" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
        <div className="text-[9px] uppercase font-black tracking-widest mb-2" style={{ color: 'var(--palm-leaf)' }}>Your Identity</div>
        {editingName ? (
          <div className="flex items-center gap-2">
            <input
              autoFocus
              value={draftName}
              onChange={e => setDraftName(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') handleSaveName(); if (e.key === 'Escape') setEditingName(false); }}
              maxLength={30}
              className="flex-1 bg-transparent border-b border-dashed text-lg font-bold outline-none"
              style={{ borderColor: 'var(--sage-green)', color: 'var(--foreground)' }}
            />
            <button onClick={handleSaveName} disabled={savingName} className="px-3 py-1 rounded-lg text-xs font-bold transition-opacity hover:opacity-80" style={{ background: 'var(--sage-green)', color: '#000' }}>
              {savingName ? '…' : 'Save'}
            </button>
            <button onClick={() => setEditingName(false)} className="px-3 py-1 rounded-lg text-xs font-bold" style={{ background: 'var(--border)', color: 'var(--muted)' }}>
              Cancel
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <span className="text-lg font-black">{user?.display_name}</span>
            <button onClick={() => { setDraftName(user?.display_name || ''); setEditingName(true); }}
              className="p-1 rounded opacity-50 hover:opacity-100 transition-opacity">
              <Pencil className="w-3.5 h-3.5" style={{ color: 'var(--muted)' }} />
            </button>
          </div>
        )}
        <div className="text-[10px] mt-1" style={{ color: 'var(--muted)' }}>@{user?.username}</div>
      </div>

      {/* Auto Pick toggle */}
      <button
        onClick={() => {
          const next = !autoPickEnabled;
          setAutoPickEnabled(next);
          localStorage.setItem('duel_auto_pick', String(next));
        }}
        className="w-full rounded-2xl p-4 mb-4 text-left transition-all"
        style={{
          background: 'var(--surface)',
          border: `1px solid ${autoPickEnabled ? 'rgba(var(--sandy-brown-rgb),0.5)' : 'var(--border)'}`,
        }}
      >
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Shuffle className="w-4 h-4 flex-shrink-0" style={{ color: autoPickEnabled ? 'var(--sandy-brown)' : 'var(--muted)' }} />
            <span className="text-xs font-black uppercase tracking-widest" style={{ color: autoPickEnabled ? 'var(--sandy-brown)' : 'var(--muted)' }}>
              Auto Pick (Random)
            </span>
          </div>
          {/* Toggle pill */}
          <div
            className="w-10 h-6 rounded-full flex-shrink-0 flex items-center px-1 transition-colors"
            style={{ background: autoPickEnabled ? 'var(--sandy-brown)' : 'var(--border)' }}
          >
            <div
              className="w-4 h-4 rounded-full bg-white shadow-sm transition-transform duration-200"
              style={{ transform: autoPickEnabled ? 'translateX(16px)' : 'translateX(0px)' }}
            />
          </div>
        </div>
        <p className="text-[11px] mt-2 leading-relaxed" style={{ color: 'var(--muted)' }}>
          Picks a random allowed player on your draft turn. Bowlers picked first when required.
        </p>
        {autoPickEnabled && (
          <p className="text-[11px] mt-1.5 font-bold" style={{ color: 'var(--sandy-brown)' }}>
            ⚠ Not recommended — you lose full control of your squad.
          </p>
        )}
      </button>

      {/* Simulation Speed picker */}
      <div className="rounded-2xl p-4 mb-4" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
        <div className="flex items-center gap-2 mb-3">
          <Zap className="w-4 h-4 flex-shrink-0" style={{ color: 'var(--sandy-brown)' }} />
          <span className="text-xs font-black uppercase tracking-widest" style={{ color: 'var(--muted)' }}>Simulation Speed</span>
        </div>
        <div className="grid grid-cols-3 gap-2">
          {([
            { key: 'slow',     label: 'Slow',     sub: '0.5×' },
            { key: 'moderate', label: 'Moderate', sub: '2×'   },
            { key: 'max',      label: 'Max',      sub: 'instant' },
          ] as const).map(opt => {
            const active = simSpeed === opt.key;
            return (
              <button
                key={opt.key}
                onClick={() => {
                  setSimSpeed(opt.key);
                  localStorage.setItem('duel_sim_speed', opt.key);
                }}
                className="flex flex-col items-center gap-0.5 py-2.5 rounded-xl transition-all"
                style={{
                  background: active ? 'rgba(245,166,91,0.15)' : 'var(--surface-2)',
                  border: `1px solid ${active ? 'var(--sandy-brown)' : 'var(--border)'}`,
                }}
              >
                <span className="text-xs font-black" style={{ color: active ? 'var(--sandy-brown)' : 'var(--foreground)' }}>
                  {opt.label}
                </span>
              </button>
            );
          })}
        </div>
        <p className="mt-2 text-[10px]" style={{ color: 'var(--muted)' }}>
          Configure before game starts
        </p>
      </div>

      {/* Create Duel */}
      {!lobby ? (
        <button
          onClick={handleCreate}
          disabled={creating}
          className="w-full py-4 rounded-2xl font-black text-sm uppercase tracking-wider flex items-center justify-center gap-2 transition-all hover:opacity-90 active:scale-95 mb-4"
          style={{ background: 'var(--sandy-brown)', color: '#000' }}
        >
          {creating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Swords className="w-4 h-4" />}
          {creating ? 'Creating…' : 'Create a Duel'}
        </button>
      ) : (
        <div className="rounded-2xl p-6 mb-4 text-center" style={{ background: 'var(--surface)', border: '1px solid rgba(var(--sandy-brown-rgb),0.3)' }}>
          <div className="text-[9px] uppercase font-black tracking-widest mb-3" style={{ color: 'var(--palm-leaf)' }}>Share this code with your opponent</div>
          <div className="text-7xl font-black font-mono tracking-[0.2em] mb-4" style={{ color: 'var(--sandy-brown)' }}>
            {lobby.code}
          </div>
          <button onClick={handleCopy} className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all hover:opacity-80" style={{ background: 'var(--surface-2)', border: '1px solid var(--border)' }}>
            {copied ? <Check className="w-3.5 h-3.5" style={{ color: 'var(--sage-green)' }} /> : <Copy className="w-3.5 h-3.5" />}
            {copied ? 'Copied!' : 'Copy Code'}
          </button>
          <div className="mt-4 flex items-center justify-center gap-2 text-xs" style={{ color: 'var(--muted)' }}>
            <Loader2 className="w-3.5 h-3.5 animate-spin" style={{ color: 'var(--sage-green)' }} />
            Waiting for opponent…
          </div>
        </div>
      )}

      {/* Divider */}
      <div className="flex items-center gap-3 my-5">
        <div className="flex-1 h-px" style={{ background: 'var(--border)' }} />
        <span className="text-[10px] uppercase font-black tracking-widest" style={{ color: 'var(--muted)' }}>or join one</span>
        <div className="flex-1 h-px" style={{ background: 'var(--border)' }} />
      </div>

      {/* Join by code */}
      <div className="rounded-2xl p-5" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
        <div className="text-[9px] uppercase font-black tracking-widest mb-3" style={{ color: 'var(--palm-leaf)' }}>Enter opponent's code</div>
        <div className="flex gap-2">
          <input
            value={joinCode}
            onChange={e => { setJoinCode(e.target.value.replace(/\D/g, '').slice(0, 4)); setJoinError(''); }}
            onKeyDown={e => e.key === 'Enter' && handleJoin()}
            placeholder="0000"
            maxLength={4}
            className="flex-1 bg-transparent border rounded-xl px-4 py-3 text-xl font-black font-mono text-center outline-none transition-colors focus:border-[var(--sage-green)]"
            style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', color: 'var(--foreground)' }}
          />
          <button
            onClick={handleJoin}
            disabled={joining || joinCode.length !== 4}
            className="px-5 py-3 rounded-xl font-black text-sm uppercase tracking-wider transition-all hover:opacity-90 active:scale-95 disabled:opacity-40"
            style={{ background: 'var(--sage-green)', color: '#000' }}
          >
            {joining ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Join'}
          </button>
        </div>
        {joinError && <p className="text-xs mt-2 font-bold" style={{ color: 'var(--sandy-brown)' }}>{joinError}</p>}
      </div>
        </div>{/* end left panel */}

        {/* ── RIGHT — rules & info sidebar ────────────────────────────── */}
        <div className="flex-1 min-w-0 flex flex-col gap-5 pt-16">

          {/* What is Duel? */}
          <div className="rounded-2xl p-5" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
            <div className="flex items-center gap-2 mb-3">
              <BookOpen className="w-4 h-4 flex-shrink-0" style={{ color: 'var(--sandy-brown)' }} />
              <span className="text-[9px] uppercase font-black tracking-widest" style={{ color: 'var(--palm-leaf)' }}>What is 1v1 Duel?</span>
            </div>
            <p className="text-sm leading-relaxed" style={{ color: 'var(--muted)' }}>
              Two players draft a squad of <strong style={{ color: 'var(--foreground)' }}>11 players</strong> each by pikcing players one by one from a shared pool of <strong style={{ color: 'var(--foreground)' }}>30 real T20I cricketers</strong>.
              Once both squads are set, you arrange your batting order and the AI transformer engine simulates a full T20 match, ball-by-ball, to determine the winner.
            </p>
          </div>

          {/* Draft Rules */}
          <div className="rounded-2xl p-5" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
            <div className="flex items-center gap-2 mb-4">
              <Users className="w-4 h-4 flex-shrink-0" style={{ color: 'var(--sage-green)' }} />
              <span className="text-[9px] uppercase font-black tracking-widest" style={{ color: 'var(--palm-leaf)' }}>Draft Rules</span>
            </div>
            <div className="flex flex-col gap-2.5">
              {[
                { icon: '🎯', label: '30-player pool', desc: 'A random selection of real T20I players forms the shared draft pool for each match.' },
                { icon: '🔄', label: 'Alternating picks', desc: 'Players take turns picking one player at a time — 22 picks total (11 per side).' },
                { icon: '⏱', label: '10 seconds per pick', desc: 'You have 10 s to make your selection. Auto-pick fires on timeout.' },
                { icon: '🏏', label: '5 bowlers minimum', desc: 'Each team must include at least 5 players capable of bowling.' },
                { icon: '🤖', label: 'Auto-pick', desc: 'Picks a random eligible player. When bowlers are urgently needed it picks bowlers only.' },
              ].map(r => (
                <div key={r.label} className="flex gap-3 items-start">
                  <span className="text-base leading-none mt-0.5 flex-shrink-0">{r.icon}</span>
                  <div>
                    <div className="text-xs font-black mb-0.5" style={{ color: 'var(--foreground)' }}>{r.label}</div>
                    <div className="text-[11px] leading-relaxed" style={{ color: 'var(--muted)' }}>{r.desc}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>

        </div>{/* end right panel */}
      </div>{/* end two-col grid */}
    </div>
  );
}
