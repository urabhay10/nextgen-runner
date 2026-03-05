'use client';

import { useState, useEffect, useRef } from 'react';
import { ArrowLeft, ChevronDown, Check, MapPin, Dice6, Globe } from 'lucide-react';
import Link from 'next/link';
import PlayerInput from '@/components/PlayerInput';
import BowlingOrderEditor from '@/components/BowlingOrderEditor';
import ModelSimulation from '@/components/ModelSimulation';
import VenueSelector from '@/components/VenueSelector';
import { fetchV2Models, getV2ApiUrl } from '@/lib/api_v2';
import { Model, SlottedPlayer } from '@/types';

interface Venue { name: string; id: number; }

function makeSlots(names: string[], prefix: string, baseGameId: number = 0): SlottedPlayer[] {
  return Array.from({ length: 11 }, (_, i) => ({ uid: `${prefix}_${i}`, name: names[i] ?? '', gameId: baseGameId + i }));
}

function slotsToUidOrder(slots: number[], players: SlottedPlayer[]): string[] {
  return slots.map(i => players[i]?.uid ?? '');
}

function namesToUidOrder(names: string[], players: SlottedPlayer[]): string[] {
  const used = new Set<string>();
  return names.map(name => {
    const slot = players.find(p => p.name === name && !used.has(p.uid));
    if (slot) { used.add(slot.uid); return slot.uid; }
    return players.find(p => p.name === name)?.uid ?? '';
  });
}

function uidOrderToNames(order: string[], players: SlottedPlayer[]): string[] {
  return order.map(uid => players.find(p => p.uid === uid)?.name ?? '');
}

export default function CompareModelsV2() {
  const [stage, setStage] = useState<'setup' | 'live'>('setup');
  const [numMatches, setNumMatches] = useState<string>('1');
  const [models, setModels] = useState<Model[]>([]);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const [selectedModels, setSelectedModels] = useState<string[]>([]);
  const [playerIdMap, setPlayerIdMap] = useState<Record<number, string | number>>({});

  const [selectedVenue, setSelectedVenue] = useState<Venue | null>(null);

  const [team1, setTeam1] = useState({
    name: 'Team A',
    players: makeSlots(Array(11).fill(''), 't1', 0),
  });
  const [team2, setTeam2] = useState({
    name: 'Team B',
    players: makeSlots(Array(11).fill(''), 't2', 11),
  });

  const [showAdvanced, setShowAdvanced] = useState(false);
  const [diceLoading1, setDiceLoading1] = useState(false);
  const [diceLoading2, setDiceLoading2] = useState(false);
  const [diceLoadingVenue, setDiceLoadingVenue] = useState(false);

  // (no aggregate compare summary state needed — each ModelSimulation card handles its own)

  // Country filter — separate per team
  const ALL_COUNTRIES = ['IND', 'AUS', 'ENG', 'NZ', 'SA', 'WI', 'PAK', 'SL', 'BAN', 'AFG', 'IRE', 'ZIM', 'NED', 'SCO'] as const;
  type CountryCode = typeof ALL_COUNTRIES[number];
  const [selectedCountries1, setSelectedCountries1] = useState<CountryCode[]>([...ALL_COUNTRIES]);
  const [selectedCountries2, setSelectedCountries2] = useState<CountryCode[]>([...ALL_COUNTRIES]);
  const [countryDropdownOpen1, setCountryDropdownOpen1] = useState(false);
  const [countryDropdownOpen2, setCountryDropdownOpen2] = useState(false);
  const countryDropdownRef1 = useRef<HTMLDivElement>(null);
  const countryDropdownRef2 = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (countryDropdownRef1.current && !countryDropdownRef1.current.contains(e.target as Node)) setCountryDropdownOpen1(false);
      if (countryDropdownRef2.current && !countryDropdownRef2.current.contains(e.target as Node)) setCountryDropdownOpen2(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const toggleCountry1 = (code: CountryCode) => {
    setSelectedCountries1(prev =>
      prev.includes(code) ? (prev.length > 1 ? prev.filter(c => c !== code) : prev) : [...prev, code]
    );
  };
  const toggleCountry2 = (code: CountryCode) => {
    setSelectedCountries2(prev =>
      prev.includes(code) ? (prev.length > 1 ? prev.filter(c => c !== code) : prev) : [...prev, code]
    );
  };

  // Premium venues for random pick
  const PREMIUM_VENUES = [
    "Melbourne Cricket Ground", "Adelaide Oval", "Sydney Cricket Ground",
    "Wankhede Stadium", "Eden Gardens", "Narendra Modi Stadium",
    "Perth Stadium", "Old Trafford", "Kensington Oval, Bridgetown, Barbados",
    "Kennington Oval", "Trent Bridge", "Eden Park", "New Wanderers Stadium",
    "Himachal Pradesh Cricket Association Stadium",
    "Vidarbha Cricket Association Stadium, Jamtha", "M Chinnaswamy Stadium",
    "Punjab Cricket Association IS Bindra Stadium, Mohali",
    "Feroz Shah Kotla", "Arun Jaitley Stadium", "Saurashtra Cricket Association Stadium",
  ];

  const randomFillTeam = async (teamId: 1 | 2) => {
    const setLoading = teamId === 1 ? setDiceLoading1 : setDiceLoading2;
    const setTeam = teamId === 1 ? setTeam1 : setTeam2;
    const currentTeam = teamId === 1 ? team1 : team2;
    setLoading(true);
    try {
      const countryParam = (teamId === 1 ? selectedCountries1 : selectedCountries2).join(',');
      const res = await fetch(getV2ApiUrl(`/random_team?countries=${encodeURIComponent(countryParam)}`), { cache: 'no-store' });
      if (!res.ok) throw new Error('Failed');
      const data = await res.json();
      const names: string[] = data.players ?? [];
      if (names.length !== 11) throw new Error('Invalid team');
      const orderRes = await fetch(getV2ApiUrl('/generate_batting_order'), {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ players: names }), cache: 'no-store',
      });
      let orderedNames = names;
      if (orderRes.ok) {
        const orderData = await orderRes.json();
        if (Array.isArray(orderData.batting_order) && orderData.batting_order.length === 11) {
          orderedNames = orderData.batting_order.map((item: { player?: string; name?: string } | string) =>
            typeof item === 'string' ? item : (item.player ?? item.name ?? '')
          );
        }
      }
      const prefix = teamId === 1 ? 't1' : 't2';
      const base = teamId === 1 ? 0 : 11;
      setTeam({ ...currentTeam, players: makeSlots(orderedNames, prefix, base) });
    } catch (e) { console.error(e); } finally { setLoading(false); }
  };

  const randomFillVenue = async () => {
    setDiceLoadingVenue(true);
    try {
      const venueName = PREMIUM_VENUES[Math.floor(Math.random() * PREMIUM_VENUES.length)];
      const res = await fetch(getV2ApiUrl('/venues/resolve'), {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: venueName }), cache: 'no-store',
      });
      if (!res.ok) throw new Error('Failed');
      const data = await res.json();
      setSelectedVenue({ name: data.resolved_name ?? venueName, id: data.resolved_id ?? 0 });
    } catch (e) { console.error(e); } finally { setDiceLoadingVenue(false); }
  };
  const [eligibleBowlers1, setEligibleBowlers1] = useState<string[]>([]);
  const [eligibleBowlers2, setEligibleBowlers2] = useState<string[]>([]);
  const [bowlingOrder1, setBowlingOrder1] = useState<string[]>(Array(20).fill(''));
  const [bowlingOrder2, setBowlingOrder2] = useState<string[]>(Array(20).fill(''));
  const [loadingOrder1, setLoadingOrder1] = useState(false);
  const [loadingOrder2, setLoadingOrder2] = useState(false);

  useEffect(() => {
    fetchV2Models().then(data => {
      if (Array.isArray(data)) { setModels(data); setSelectedModels(data.map(m => m.id)); }
      else setModels([]);
    }).catch(() => setModels([]));
  }, []);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) setDropdownOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const fetchDefaultBowlingOrder = async (teamId: 1 | 2) => {
    const team = teamId === 1 ? team1 : team2;
    const setOrder = teamId === 1 ? setBowlingOrder1 : setBowlingOrder2;
    const setLoading = teamId === 1 ? setLoadingOrder1 : setLoadingOrder2;
    const activeNames = team.players.map(p => p.name).filter(n => n.trim() !== '');
    if (activeNames.length < 5) return;
    setLoading(true);
    try {
      const res = await fetch(getV2ApiUrl('/generate_bowling_order'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ players: activeNames }),
        cache: 'no-store',
      });
      if (!res.ok) throw new Error('Failed');
      const data = await res.json();
      if (data.bowling_order_indices) setOrder(slotsToUidOrder(data.bowling_order_indices, team.players));
      else if (data.bowling_order) setOrder(namesToUidOrder(data.bowling_order, team.players));
    } catch (e) { console.error(e); } finally { setLoading(false); }
  };

  const fetchEligibleBowlers = async (teamId: 1 | 2) => {
    const team = teamId === 1 ? team1 : team2;
    const setEligible = teamId === 1 ? setEligibleBowlers1 : setEligibleBowlers2;
    const activeNames = team.players.map(p => p.name).filter(n => n.trim() !== '');
    if (activeNames.length === 0) return;
    try {
      const res = await fetch(getV2ApiUrl('/eligible_bowlers'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ players: activeNames }),
        cache: 'no-store',
      });
      if (!res.ok) throw new Error('Failed');
      const data = await res.json();
      if (Array.isArray(data)) setEligible(data.map((p: { name: string }) => p.name));
    } catch (e) { console.error(e); }
  };

  useEffect(() => {
    if (showAdvanced) {
      if (bowlingOrder1.every(b => b === '') && team1.players.some(p => p.name)) fetchDefaultBowlingOrder(1);
      if (bowlingOrder2.every(b => b === '') && team2.players.some(p => p.name)) fetchDefaultBowlingOrder(2);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showAdvanced]);

  useEffect(() => {
    if (showAdvanced && team1.players.some(p => p.name)) {
      const t = setTimeout(() => fetchEligibleBowlers(1), 800);
      return () => clearTimeout(t);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [team1.players, showAdvanced]);

  useEffect(() => {
    if (showAdvanced && team2.players.some(p => p.name)) {
      const t = setTimeout(() => fetchEligibleBowlers(2), 800);
      return () => clearTimeout(t);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [team2.players, showAdvanced]);

  const updatePlayer = (tId: 1 | 2, idx: number, v: string) => {
    const team = tId === 1 ? team1 : team2;
    const setTeam = tId === 1 ? setTeam1 : setTeam2;
    setTeam({ ...team, players: team.players.map((p, i) => i === idx ? { ...p, name: v } : p) });
  };

  const bulkPastePlayer = (tId: 1 | 2, startIdx: number, values: string[]) => {
    const team = tId === 1 ? team1 : team2;
    const setTeam = tId === 1 ? setTeam1 : setTeam2;
    setTeam({
      ...team,
      players: team.players.map((p, i) => {
        const offset = i - startIdx;
        return offset >= 0 && offset < values.length ? { ...p, name: values[offset] } : p;
      }),
    });
  };

  const toggleModelSelection = (modelId: string) => {
    setSelectedModels(prev =>
      prev.includes(modelId) ? prev.filter(id => id !== modelId) : [...prev, modelId]
    );
  };

  if (stage === 'setup') return (
    <div className="min-h-screen p-8 max-w-6xl mx-auto" style={{ background: 'var(--background)' }}>
      <header className="mb-12 text-center relative">
        <Link
          href="/"
          className="absolute left-0 top-1/2 -translate-y-1/2 transition flex items-center gap-2 text-sm font-bold px-4 py-2 rounded-full border"
          style={{ color: 'var(--muted)', background: 'var(--surface)', borderColor: 'var(--border)' }}
        >
          <ArrowLeft className="w-4 h-4" /> Back
        </Link>
        <h1 className="text-4xl font-black tracking-tight" style={{ color: 'var(--foreground)' }}>MODEL COMPARISON</h1>
        <p className="mt-2 font-mono text-sm" style={{ color: 'var(--muted)' }}>Run parallel v2 simulations across multiple AI models</p>
        <span className="inline-block mt-2 text-[10px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full" style={{ background: 'rgba(var(--sage-green-rgb),0.12)', color: 'var(--sage-green)', border: '1px solid rgba(var(--sage-green-rgb),0.3)' }}>
          v2 · Venue-Aware
        </span>
      </header>

      {/* Venue selector */}
      <div className="mb-4 max-w-sm mx-auto">
        <label className="text-[10px] uppercase font-bold text-[var(--sage-green)] mb-2 flex items-center gap-1 justify-center">
          <MapPin className="w-3 h-3" /> Venue (optional)
        </label>
        <div className="flex items-center gap-2">
          <div className="flex-1"><VenueSelector value={selectedVenue} onChange={setSelectedVenue} /></div>
          <button onClick={randomFillVenue} disabled={diceLoadingVenue} title="Random venue"
            className="p-2 rounded-lg border transition hover:bg-[var(--surface-2)] disabled:opacity-50"
            style={{ background: 'var(--surface)', borderColor: 'var(--border)', color: 'var(--sage-green)' }}>
            {diceLoadingVenue ? <span className="w-5 h-5 block border-2 border-current border-t-transparent rounded-full animate-spin" /> : <Dice6 className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {/* Country filter for random team — shared helper rendered inline per team */}
      <div className="mb-8 flex justify-center">
        <span className="text-[10px] uppercase font-bold tracking-widest flex items-center gap-1.5" style={{ color: 'var(--muted)' }}>
          <Globe className="w-3.5 h-3.5" /> Country pools set per team below
        </span>
      </div>

      <div className="grid md:grid-cols-2 gap-8">
        {/* Team 1 */}
        <div className="space-y-2">
          <div className="flex items-center gap-3 mb-4 pb-3 border-b" style={{ borderColor: 'var(--border)' }}>
            <div className="w-1.5 h-8 rounded-full" style={{ background: 'var(--sage-green)' }} />
            <input
              value={team1.name}
              onChange={e => setTeam1({ ...team1, name: e.target.value })}
              className="flex-1 bg-transparent text-xl font-black text-white outline-none placeholder-slate-600 tracking-wide"
              placeholder="Team A"
            />
            {/* Country filter for team 1 */}
            <div className="relative" ref={countryDropdownRef1}>
              <button
                onClick={() => setCountryDropdownOpen1(o => !o)}
                className="p-1.5 rounded-lg border transition hover:bg-[var(--surface-2)]"
                style={{ background: 'var(--surface)', borderColor: countryDropdownOpen1 ? 'var(--sage-green)' : 'var(--border)', color: 'var(--sage-green)' }}
                title="Filter countries for team 1">
                <Globe className="w-4 h-4" />
              </button>
              {countryDropdownOpen1 && (
                <div className="absolute top-full mt-1 right-0 z-30 rounded-xl border shadow-lg p-2 flex flex-col gap-0.5 w-[130px]"
                  style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}>
                  {ALL_COUNTRIES.map(code => (
                    <button key={code} onClick={() => toggleCountry1(code)}
                      className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-bold transition hover:bg-[var(--surface-2)] text-left"
                      style={{ color: selectedCountries1.includes(code) ? 'var(--sage-green)' : 'var(--muted)' }}>
                      <span className="w-3 h-3 rounded border flex items-center justify-center flex-shrink-0"
                        style={{ borderColor: selectedCountries1.includes(code) ? 'var(--sage-green)' : 'var(--border)', background: selectedCountries1.includes(code) ? 'var(--sage-green)' : 'transparent' }}>
                        {selectedCountries1.includes(code) && <span className="text-[8px] text-black font-black">✓</span>}
                      </span>
                      {code}
                    </button>
                  ))}
                </div>
              )}
            </div>
            <button onClick={() => randomFillTeam(1)} disabled={diceLoading1} title="Random team"
              className="p-1.5 rounded-lg border transition hover:bg-[var(--surface-2)] disabled:opacity-50"
              style={{ background: 'var(--surface)', borderColor: 'var(--border)', color: 'var(--sage-green)' }}>
              {diceLoading1 ? <span className="w-4 h-4 block border-2 border-current border-t-transparent rounded-full animate-spin" /> : <Dice6 className="w-4 h-4" />}
            </button>
          </div>
          {team1.players.map((p, i) => (
            <PlayerInput
              key={p.uid}
              value={p.name}
              index={i}
              onChange={v => updatePlayer(1, i, v)}
              onSelectPlayer={(name, id) => { if (id != null) setPlayerIdMap(prev => ({ ...prev, [team1.players[i].gameId]: id })); }}
              onBulkPaste={values => bulkPastePlayer(1, i, values)}
              placeholder={`Player ${i + 1}`}
              apiUrlFn={getV2ApiUrl}
            />
          ))}
          {showAdvanced && (
            <div className="mt-6">
              <BowlingOrderEditor
                teamName={team1.name}
                players={team1.players}
                eligibleBowlers={eligibleBowlers1}
                bowlingOrder={bowlingOrder1}
                onOrderChange={setBowlingOrder1}
                onDefault={() => fetchDefaultBowlingOrder(1)}
                loading={loadingOrder1}
              />
            </div>
          )}
        </div>

        {/* Team 2 */}
        <div className="space-y-2">
          <div className="flex items-center gap-3 mb-4 pb-3 border-b" style={{ borderColor: 'var(--border)' }}>
            <div className="w-1.5 h-8 rounded-full" style={{ background: 'var(--sandy-brown)' }} />
            <input
              value={team2.name}
              onChange={e => setTeam2({ ...team2, name: e.target.value })}
              className="flex-1 bg-transparent text-xl font-black text-white outline-none placeholder-slate-600 tracking-wide"
              placeholder="Team B"
            />
            {/* Country filter for team 2 */}
            <div className="relative" ref={countryDropdownRef2}>
              <button
                onClick={() => setCountryDropdownOpen2(o => !o)}
                className="p-1.5 rounded-lg border transition hover:bg-[var(--surface-2)]"
                style={{ background: 'var(--surface)', borderColor: countryDropdownOpen2 ? 'var(--sandy-brown)' : 'var(--border)', color: 'var(--sandy-brown)' }}
                title="Filter countries for team 2">
                <Globe className="w-4 h-4" />
              </button>
              {countryDropdownOpen2 && (
                <div className="absolute top-full mt-1 right-0 z-30 rounded-xl border shadow-lg p-2 flex flex-col gap-0.5 w-[130px]"
                  style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}>
                  {ALL_COUNTRIES.map(code => (
                    <button key={code} onClick={() => toggleCountry2(code)}
                      className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-bold transition hover:bg-[var(--surface-2)] text-left"
                      style={{ color: selectedCountries2.includes(code) ? 'var(--sandy-brown)' : 'var(--muted)' }}>
                      <span className="w-3 h-3 rounded border flex items-center justify-center flex-shrink-0"
                        style={{ borderColor: selectedCountries2.includes(code) ? 'var(--sandy-brown)' : 'var(--border)', background: selectedCountries2.includes(code) ? 'var(--sandy-brown)' : 'transparent' }}>
                        {selectedCountries2.includes(code) && <span className="text-[8px] text-black font-black">✓</span>}
                      </span>
                      {code}
                    </button>
                  ))}
                </div>
              )}
            </div>
            <button onClick={() => randomFillTeam(2)} disabled={diceLoading2} title="Random team"
              className="p-1.5 rounded-lg border transition hover:bg-[var(--surface-2)] disabled:opacity-50"
              style={{ background: 'var(--surface)', borderColor: 'var(--border)', color: 'var(--sandy-brown)' }}>
              {diceLoading2 ? <span className="w-4 h-4 block border-2 border-current border-t-transparent rounded-full animate-spin" /> : <Dice6 className="w-4 h-4" />}
            </button>
          </div>
          {team2.players.map((p, i) => (
            <PlayerInput
              key={p.uid}
              value={p.name}
              index={i}
              onChange={v => updatePlayer(2, i, v)}
              onSelectPlayer={(name, id) => { if (id != null) setPlayerIdMap(prev => ({ ...prev, [team2.players[i].gameId]: id })); }}
              onBulkPaste={values => bulkPastePlayer(2, i, values)}
              placeholder={`Player ${i + 1}`}
              apiUrlFn={getV2ApiUrl}
            />
          ))}
          {showAdvanced && (
            <div className="mt-6">
              <BowlingOrderEditor
                teamName={team2.name}
                players={team2.players}
                eligibleBowlers={eligibleBowlers2}
                bowlingOrder={bowlingOrder2}
                onOrderChange={setBowlingOrder2}
                onDefault={() => fetchDefaultBowlingOrder(2)}
                loading={loadingOrder2}
              />
            </div>
          )}
        </div>
      </div>

      <div className="mt-8 flex justify-center">
        <button
          onClick={() => setShowAdvanced(!showAdvanced)}
          className="text-sm font-bold flex items-center gap-2 px-4 py-2 rounded-full border transition-colors"
          style={{
            color: showAdvanced ? 'var(--foreground)' : 'var(--muted)',
            background: showAdvanced ? 'var(--surface-2)' : 'var(--surface)',
            borderColor: 'var(--border)',
          }}
        >
          {showAdvanced ? 'Hide Advanced Settings' : 'Show Advanced Settings'}
        </button>
      </div>

      <div className="mt-12 flex flex-col items-center gap-5">
        {/* Config row */}
        <div className="flex items-stretch gap-0 rounded-xl border divide-x" style={{ borderColor: 'var(--border)', background: 'var(--surface)' }}>
          <div className="flex flex-col justify-center px-6 py-4 gap-1 rounded-l-xl">
            <span className="text-[9px] uppercase font-black tracking-widest" style={{ color: 'var(--muted)' }}>Games / Model</span>
            <input
              type="number"
              min={1}
              value={numMatches}
              onChange={e => setNumMatches(e.target.value)}
              onBlur={e => setNumMatches(String(Math.max(1, parseInt(e.target.value) || 1)))}
              className="bg-transparent w-16 text-2xl font-black outline-none tabular-nums"
              style={{ color: 'var(--sage-green)' }}
            />
          </div>
          <div className="flex flex-col justify-center px-6 py-4 gap-1 rounded-r-xl">
            <span className="text-[9px] uppercase font-black tracking-widest" style={{ color: 'var(--muted)' }}>Models</span>
            <div className="relative" ref={dropdownRef}>
              <button
                onClick={() => models.length > 0 && setDropdownOpen(o => !o)}
                className="px-4 py-2 rounded-lg border flex items-center gap-2 text-sm font-bold transition-colors"
                style={{
                  background: 'var(--surface-2)',
                  borderColor: dropdownOpen ? 'var(--sage-green)' : 'var(--border)',
                  color: 'var(--foreground)',
                }}
              >
                {models.length === 0 ? 'Loading…' : `${selectedModels.length} / ${models.length} Models`}
                {models.length > 0 && <ChevronDown className={`w-3.5 h-3.5 transition-transform ${dropdownOpen ? 'rotate-180' : ''}`} style={{ color: 'var(--muted)' }} />}
              </button>
              {dropdownOpen && models.length > 0 && (
                <div className="absolute top-full left-0 mt-2 w-64 rounded-xl border shadow-2xl z-50" style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}>
                  <div className="p-1.5 flex flex-col gap-0.5 max-h-64 overflow-y-auto">
                    {models.map(model => {
                      const checked = selectedModels.includes(model.id);
                      return (
                        <button
                          key={model.id}
                          onClick={() => toggleModelSelection(model.id)}
                          className="flex items-center gap-3 px-3 py-2 rounded-lg text-left transition-colors w-full"
                          style={{ background: checked ? 'rgba(var(--sage-green-rgb),0.1)' : undefined }}
                        >
                          <div className="w-4 h-4 rounded flex items-center justify-center flex-none border" style={{ borderColor: checked ? 'var(--sage-green)' : 'var(--border)', background: checked ? 'var(--sage-green)' : 'transparent' }}>
                            {checked && <Check className="w-3 h-3" style={{ color: 'var(--background)' }} />}
                          </div>
                          <span className="text-sm font-bold" style={{ color: 'var(--foreground)' }}>{model.name}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        <button
          onClick={() => setStage('live')}
          className="px-12 py-3.5 rounded-xl font-black text-base text-white shadow-lg hover:scale-105 active:scale-95 transition-all tracking-wide"
          style={{ background: 'var(--sage-green)', color: 'var(--background)', boxShadow: '0 0 20px rgba(var(--sage-green-rgb), 0.4)' }}
        >
          START COMPARISON
        </button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen text-white p-6" style={{ background: 'var(--background)' }}>
      <header className="mb-8 flex justify-between items-center max-w-[1800px] mx-auto">
        <button onClick={() => setStage('setup')} className="transition flex items-center gap-2 text-sm font-bold mb-8" style={{ color: 'var(--muted)' }}>
          <ArrowLeft className="w-4 h-4" /> Back to Setup
        </button>
        <div className="text-right">
          <h1 className="text-xl font-black text-white">v2 Parallel Simulation</h1>
          <div className="text-xs font-mono" style={{ color: 'var(--muted)' }}>
            Comparing {selectedModels.length} Models · {numMatches} Match Series
            {selectedVenue && ` · ${selectedVenue.name}`}
          </div>
        </div>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 max-w-[1800px] mx-auto">
        {models.filter(m => selectedModels.includes(m.id)).map(model => (
          <ModelSimulation
            key={model.id}
            model={model}
            start={true}
            gameIdMap={playerIdMap}
            allPlayers={[...team1.players, ...team2.players]}
            payload={{
              team1_name: team1.name,
              team1_players: team1.players.map(p => p.name),
              team2_name: team2.name,
              team2_players: team2.players.map(p => p.name),
              team1_bowling_order: showAdvanced ? uidOrderToNames(bowlingOrder1, team1.players) : undefined,
              team2_bowling_order: showAdvanced ? uidOrderToNames(bowlingOrder2, team2.players) : undefined,
              num_matches: Math.max(1, parseInt(numMatches) || 1),
              venue_id: selectedVenue?.id ?? 0,
              venue_name: selectedVenue?.name ?? undefined,
            }}
            apiUrlFn={getV2ApiUrl}
          />
        ))}
      </div>
    </div>
  );
}
