'use client';

import { useState, useEffect, useRef } from 'react';
import { ArrowLeft, ChevronUp, ChevronDown, Pause, Play, SkipForward, Settings2, Zap, Dice6, Globe } from 'lucide-react';
import Link from 'next/link';
import PlayerInput from '@/components/PlayerInput';
import BowlingOrderEditor from '@/components/BowlingOrderEditor';
import ScoreCardLive from '@/components/ScoreCardLive';
import Commentary from '@/components/Commentary';
import SeriesSummary from '@/components/SeriesSummary';
import DetailedScorecard from '@/components/DetailedScorecard';
import VenueSelector from '@/components/VenueSelector';
import { MatchDetail, BallEvent, HistoryItem, SeriesSummaryData, Model, SlottedPlayer } from '@/types';
import { fetchV2Models, getV2ApiUrl } from '@/lib/api_v2';
function calcNaturalDelay(baseMs: number, over: number, outcome: number | string, lastBallOfOver: boolean = false): number {
  const ballMult =
    outcome === 'W' ? 3.0 : outcome === 6 ? 2.0 : outcome === 4 ? 1.5 : outcome === 2 ? 1.25 : outcome === 1 ? 1.05 : 1.0;
  const overMult = over <= 15 ? 1.0 : 1 + (over - 15) / 10;
  const eovMult = lastBallOfOver ? 4.0 : 1.0;
  return Math.round(baseMs * ballMult * overMult * eovMult);
}

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

interface Venue { name: string; id: number; }

export default function SimulatorV2() {
  const [stage, setStage] = useState<'setup' | 'live'>('setup');
  const [numMatches, setNumMatches] = useState<string>('1');
  const [team1, setTeam1] = useState({ name: "Team A", players: makeSlots(Array(11).fill(''), 't1', 0) });
  const [team2, setTeam2] = useState({ name: "Team B", players: makeSlots(Array(11).fill(''), 't2', 11) });
  const [playerIdMap, setPlayerIdMap] = useState<Record<number, string | number>>({});

  // v2: venue selection
  const [selectedVenue, setSelectedVenue] = useState<Venue | null>(null);

  const [models, setModels] = useState<Model[]>([]);
  const [selectedModel, setSelectedModel] = useState<string>("");

  const simulationIdRef = useRef<number>(0);
  const abortControllerRef = useRef<AbortController | null>(null);

  const [showAdvanced, setShowAdvanced] = useState(false);
  const [eligibleBowlers1, setEligibleBowlers1] = useState<string[]>([]);
  const [eligibleBowlers2, setEligibleBowlers2] = useState<string[]>([]);
  const [bowlingOrder1, setBowlingOrder1] = useState<string[]>(Array(20).fill(""));
  const [bowlingOrder2, setBowlingOrder2] = useState<string[]>(Array(20).fill(""));
  const [loadingOrder1, setLoadingOrder1] = useState(false);
  const [loadingOrder2, setLoadingOrder2] = useState(false);

  const [matchDetail, setMatchDetail] = useState<BallEvent | null>(null);
  const [ballEvents, setBallEvents] = useState<BallEvent[]>([]);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [seriesComplete, setSeriesComplete] = useState<SeriesSummaryData | null>(null);
  const [showSummaryFull, setShowSummaryFull] = useState(false);
  const [delayMs, setDelayMs] = useState(500);
  const delayMsRef = useRef(delayMs);
  const [paused, setPaused] = useState(false);
  const pausedRef = useRef(false);
  const nextBallRef = useRef<(() => void) | null>(null);
  const stepSignalRef = useRef<(() => void) | null>(null);
  const stepOnceRef = useRef(false);
  const [naturalMode, setNaturalMode] = useState(false);
  const naturalModeRef = useRef(false);
  const NATURAL_BASE_MS = 600;
  const lastBallRef = useRef<{ over: number; outcome: number | string; ball: number }>({ over: 0, outcome: 0, ball: 0 });

  useEffect(() => { delayMsRef.current = delayMs; }, [delayMs]);
  useEffect(() => { pausedRef.current = paused; }, [paused]);
  useEffect(() => { naturalModeRef.current = naturalMode; }, [naturalMode]);

  const SPEED_STEPS = [5000, 2000, 1000, 500, 200, 100, 0];
  const getSpeedLabel = (ms: number) => ms === 0 ? 'MAX' : `${(1000 / ms).toFixed(1)}x`;
  const currentSpeedIdx = SPEED_STEPS.indexOf(delayMs) !== -1 ? SPEED_STEPS.indexOf(delayMs) : 3;
  const speedUp = () => setDelayMs(prev => SPEED_STEPS[Math.min(SPEED_STEPS.indexOf(prev) !== -1 ? SPEED_STEPS.indexOf(prev) + 1 : 4, SPEED_STEPS.length - 1)]);
  const slowDown = () => setDelayMs(prev => SPEED_STEPS[Math.max(SPEED_STEPS.indexOf(prev) !== -1 ? SPEED_STEPS.indexOf(prev) - 1 : 2, 0)]);
  const advanceOneBall = () => {
    stepOnceRef.current = true;
    if (stepSignalRef.current) stepSignalRef.current();
    if (nextBallRef.current) nextBallRef.current();
  };
  const stopAndReset = () => { simulationIdRef.current = 0; setStage('setup'); setPaused(false); pausedRef.current = false; };

  useEffect(() => {
    if (stage !== 'live') return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.key === ' ') { e.preventDefault(); setPaused(p => !p); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); if (!naturalModeRef.current) speedUp(); }
      else if (e.key === 'ArrowDown') { e.preventDefault(); if (!naturalModeRef.current) slowDown(); }
      else if (e.key === 'ArrowRight') { e.preventDefault(); advanceOneBall(); }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stage, paused, delayMs]);

  useEffect(() => {
    fetchV2Models().then(data => {
      if (Array.isArray(data)) { setModels(data); setSelectedModel(""); }
      else { setModels([]); }
    }).catch(() => setModels([]));
  }, []);

  const [diceLoading1, setDiceLoading1] = useState(false);
  const [diceLoading2, setDiceLoading2] = useState(false);
  const [diceLoadingVenue, setDiceLoadingVenue] = useState(false);

  // Per-team country pool for random team generation
  const ALL_COUNTRIES = ['IND', 'AUS', 'ENG', 'NZ', 'SA', 'WI', 'PAK', 'SL', 'BAN', 'AFG', 'IRE', 'ZIM', 'NED', 'SCO'] as const;
  type CountryCode = typeof ALL_COUNTRIES[number];
  const DEFAULT_COUNTRIES: CountryCode[] = ['IND', 'AUS', 'ENG', 'NZ', 'SA', 'WI'];
  const [selectedCountries1, setSelectedCountries1] = useState<CountryCode[]>([...DEFAULT_COUNTRIES]);
  const [selectedCountries2, setSelectedCountries2] = useState<CountryCode[]>([...DEFAULT_COUNTRIES]);
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

  const toggleCountry1 = (code: CountryCode) =>
    setSelectedCountries1(prev => prev.includes(code) ? (prev.length > 1 ? prev.filter(c => c !== code) : prev) : [...prev, code]);
  const toggleCountry2 = (code: CountryCode) =>
    setSelectedCountries2(prev => prev.includes(code) ? (prev.length > 1 ? prev.filter(c => c !== code) : prev) : [...prev, code]);

  // Premium venues for random venue pick (must match backend _PREMIUM_ORDER)
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
      // Fetch random 11 players (5 bowlers, 3 non-bowlers, 3 random) from backend
      const countryParam = (teamId === 1 ? selectedCountries1 : selectedCountries2).join(',');
      const res = await fetch(getV2ApiUrl(`/random_team?countries=${encodeURIComponent(countryParam)}`), { cache: 'no-store' });
      if (!res.ok) throw new Error('Failed');
      const data = await res.json();
      const names: string[] = data.players ?? [];
      if (names.length !== 11) throw new Error('Invalid team');

      // Get batting order from backend
      const orderRes = await fetch(getV2ApiUrl('/generate_batting_order'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ players: names }),
        cache: 'no-store',
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
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: venueName }),
        cache: 'no-store',
      });
      if (!res.ok) throw new Error('Failed');
      const data = await res.json();
      setSelectedVenue({ name: data.resolved_name ?? venueName, id: data.resolved_id ?? 0 });
    } catch (e) { console.error(e); } finally { setDiceLoadingVenue(false); }
  };

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
    if (tId === 1) setTeam1({ ...team1, players: team1.players.map((p, i) => i === idx ? { ...p, name: v } : p) });
    else setTeam2({ ...team2, players: team2.players.map((p, i) => i === idx ? { ...p, name: v } : p) });
  };

  const bulkPastePlayer = (tId: 1 | 2, startIdx: number, values: string[]) => {
    const team = tId === 1 ? team1 : team2;
    const setTeam = tId === 1 ? setTeam1 : setTeam2;
    setTeam({ ...team, players: team.players.map((p, i) => { const o = i - startIdx; return o >= 0 && o < values.length ? { ...p, name: values[o] } : p; }) });
  };

  const getLiveSummary = () => {
    if (seriesComplete) return { ...seriesComplete, matches: history };
    if (history.length === 0) return null;
    let t1Wins = 0, t2Wins = 0, ties = 0;
    for (const h of history) {
      if (h.winner === team1.name) t1Wins++;
      else if (h.winner === team2.name) t2Wins++;
      else if (h.winner === 'Tie') ties++;
    }
    let header = ties > 0
      ? `Series Level ${t1Wins}-${t2Wins} (${ties} ties)`
      : t1Wins > t2Wins ? `${team1.name} leads ${t1Wins}-${t2Wins}`
      : t2Wins > t1Wins ? `${team2.name} leads ${t2Wins}-${t1Wins}`
      : `Series Level ${t1Wins}-${t2Wins}`;
    return { summary: { scoreline: header, [team1.name]: t1Wins, [team2.name]: t2Wins, Tie: ties }, matches: history };
  };

  const liveSummary = getLiveSummary();

  const startSimulation = async () => {
    const currentSimId = Date.now();
    simulationIdRef.current = currentSimId;
    if (abortControllerRef.current) abortControllerRef.current.abort();
    abortControllerRef.current = new AbortController();

    setStage('live');
    setBallEvents([]);
    setMatchDetail(null);
    setHistory([]);
    setSeriesComplete(null);

    const isCustom = showAdvanced && bowlingOrder1.some(b => b) && bowlingOrder2.some(b => b);
    const endpoint = isCustom ? '/simulate_custom_match' : '/simulate_series_stream';

    const payload: Record<string, unknown> = {
      team1_name: team1.name,
      team1_players: team1.players.map(p => p.name),
      team2_name: team2.name,
      team2_players: team2.players.map(p => p.name),
      num_matches: Math.max(1, parseInt(numMatches) || 1),
      ...(selectedModel ? { model: selectedModel } : {}),
      // v2: venue
      ...(selectedVenue ? { venue_id: selectedVenue.id, venue_name: selectedVenue.name } : {}),
    };

    if (isCustom) {
      payload.team1_bowling_order = uidOrderToNames(bowlingOrder1, team1.players);
      payload.team2_bowling_order = uidOrderToNames(bowlingOrder2, team2.players);
    }

    try {
      const response = await fetch(getV2ApiUrl(endpoint), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        cache: 'no-store',
      });
      if (!response.ok) throw new Error('Simulation failed');
      if (!response.body) throw new Error('No response body');

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let lastInnings = -1;

      const wait = (ms: number) => new Promise<void>(resolve => {
        if (ms <= 0 || stepOnceRef.current) { stepOnceRef.current = false; resolve(); return; }
        const timer = setTimeout(resolve, ms);
        nextBallRef.current = () => { clearTimeout(timer); stepOnceRef.current = false; resolve(); };
      });

      const waitIfPaused = () => new Promise<void>(resolve => {
        const check = () => {
          if (!pausedRef.current || stepOnceRef.current) { stepSignalRef.current = null; resolve(); return; }
          stepSignalRef.current = () => { stepSignalRef.current = null; resolve(); };
          setTimeout(check, 50);
        };
        check();
      });

      const processLine = async (line: string) => {
        if (!line.trim()) return;
        if (simulationIdRef.current !== currentSimId) return;
        try {
          const data = JSON.parse(line);
          if (data.type === 'ball') {
            const isMax = !naturalModeRef.current && delayMsRef.current === 0;
            // Detect innings transition → pause for innings break
            const thisInnings = data.innings ?? 0;
            if (lastInnings >= 0 && thisInnings !== lastInnings) {
              // First ball of second innings: pause 2.5s (natural) or 1.5s (normal)
              const breakDelay = naturalModeRef.current ? 2500 : 1500;
              if (!isMax) {
                await waitIfPaused();
                if (simulationIdRef.current !== currentSimId) return;
                await wait(breakDelay);
                if (simulationIdRef.current !== currentSimId) return;
              }
            }
            lastInnings = thisInnings;
            setMatchDetail(data.detail);
            const latestEvent = { ...data.detail, innings: data.innings, match_no: data.match_no } as BallEvent;
            setBallEvents(prev => {
              const currentMatchNo = data.match_no;
              const lastMatchNo = prev.length > 0 ? prev[prev.length - 1].match_no : currentMatchNo;
              if (currentMatchNo !== lastMatchNo) return [latestEvent];
              return [...prev, latestEvent];
            });
            if (!isMax || pausedRef.current) {
              await waitIfPaused();
              if (simulationIdRef.current !== currentSimId) return;
              lastBallRef.current = { over: data.detail?.over ?? 0, ball: data.detail?.ball ?? 0, outcome: data.detail?.is_wicket ? 'W' : (data.detail?.runs_scored ?? 0) };
              const isLastBallOfOver = (data.detail?.ball ?? 0) >= 6;
              const currentDelay = naturalModeRef.current
                ? calcNaturalDelay(NATURAL_BASE_MS, lastBallRef.current.over, lastBallRef.current.outcome, isLastBallOfOver)
                : delayMsRef.current;
              if (currentDelay > 0) await wait(currentDelay);
              if (simulationIdRef.current !== currentSimId) return;
            }
          } else if (data.type === 'match_update') {
            setHistory(prev => [...prev, data]);
          } else if (data.type === 'innings_complete' || (data.type === 'ball' && data.innings === 1 && data.detail?.over === 0 && data.detail?.ball === 1)) {
            // innings break — wait 2s (or 3s natural) before second innings
          } else if (data.type === 'match_complete') {
            setHistory(prev => [...prev, data]);
            setSeriesComplete({ summary: { scoreline: `${data.winner} won by ${data.margin}` } });
          } else if (data.type === 'series_complete') {
            setSeriesComplete(data);
          }
        } catch (e) { console.error("Parse error:", line, e); }
      };

      while (true) {
        if (simulationIdRef.current !== currentSimId) break;
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || "";
        for (const line of lines) {
          if (simulationIdRef.current !== currentSimId) break;
          await processLine(line);
        }
      }
      if (simulationIdRef.current === currentSimId && buffer.trim()) await processLine(buffer);
    } catch (err) {
      if (simulationIdRef.current === currentSimId) {
        console.error("Simulation Error:", err);
        alert("Simulation failure. Check console.");
        setStage('setup');
      }
    }
  };

  if (stage === 'setup') return (
    <div className="min-h-screen p-4 md:p-8 max-w-6xl mx-auto" style={{ background: 'var(--background)' }}>
      <header className="mb-8 md:mb-12 text-center relative">
        <Link href="/" className="absolute left-0 top-1/2 -translate-y-1/2 text-[var(--muted)] hover:text-[var(--foreground)] transition flex items-center gap-1 md:gap-2 text-sm font-bold px-2 md:px-4 py-2 rounded-full border" style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}>
          <ArrowLeft className="w-4 h-4" /> <span className="hidden sm:inline">BACK</span>
        </Link>
        <div>
          <span className="text-[10px] font-black tracking-widest uppercase px-2 py-0.5 rounded-full mb-2 inline-block" style={{ background: 'rgba(var(--sandy-brown-rgb),0.15)', color: 'var(--sandy-brown)', border: '1px solid rgba(var(--sandy-brown-rgb),0.3)' }}>v2 Higher-Context</span>
          <h1 className="text-2xl sm:text-3xl md:text-5xl font-black text-[var(--foreground)] tracking-tight">CRICKET SERIES SIMULATOR</h1>
        </div>
      </header>

      {/* v2 venue selector */}
      <div className="mb-6 max-w-sm mx-auto">
        <label className="block text-[10px] font-black uppercase tracking-widest mb-1.5" style={{ color: 'var(--muted)' }}>Venue (optional)</label>
        <div className="flex items-center gap-2">
          <div className="flex-1"><VenueSelector value={selectedVenue} onChange={setSelectedVenue} /></div>
          <button onClick={randomFillVenue} disabled={diceLoadingVenue} title="Random venue"
            className="p-2 rounded-lg border transition hover:bg-[var(--surface-2)] disabled:opacity-50"
            style={{ background: 'var(--surface)', borderColor: 'var(--border)', color: 'var(--muted)' }}>
            {diceLoadingVenue ? <span className="w-5 h-5 block border-2 border-current border-t-transparent rounded-full animate-spin" /> : <Dice6 className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {/* Country filter for random team — moved into each team header below */}

      <div className="grid md:grid-cols-2 gap-8">
        {/* Team 1 */}
        <div className="space-y-2">
          <div className="flex items-center gap-3 mb-4 pb-3 border-b" style={{ borderColor: 'var(--border)' }}>
            <div className="w-1.5 h-8 rounded-full" style={{ background: 'var(--sage-green)' }} />
            <input value={team1.name} onChange={e => setTeam1({ ...team1, name: e.target.value })}
              className="flex-1 bg-transparent text-xl font-black text-[var(--foreground)] outline-none placeholder-[var(--muted)] tracking-wide" placeholder="Team A" />
            {/* Country pool for team 1 */}
            <div className="relative" ref={countryDropdownRef1}>
              <button
                onClick={() => setCountryDropdownOpen1(o => !o)}
                className="p-1.5 rounded-lg border transition hover:bg-[var(--surface-2)]"
                style={{ background: 'var(--surface)', borderColor: countryDropdownOpen1 ? 'var(--sage-green)' : 'var(--border)', color: 'var(--sage-green)' }}
                title="Country pool for random team 1">
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
            <PlayerInput key={i} value={p.name} index={i}
              onChange={v => updatePlayer(1, i, v)}
              onSelectPlayer={(name, id) => { if (id != null) setPlayerIdMap(prev => ({ ...prev, [team1.players[i].gameId]: id })); }}
              onBulkPaste={values => bulkPastePlayer(1, i, values)}
              placeholder={`Player ${i + 1}`}
              apiUrlFn={getV2ApiUrl}
            />
          ))}
        </div>

        {/* Team 2 */}
        <div className="space-y-2">
          <div className="flex items-center gap-3 mb-4 pb-3 border-b" style={{ borderColor: 'var(--border)' }}>
            <div className="w-1.5 h-8 rounded-full" style={{ background: 'var(--sandy-brown)' }} />
            <input value={team2.name} onChange={e => setTeam2({ ...team2, name: e.target.value })}
              className="flex-1 bg-transparent text-xl font-black text-[var(--foreground)] outline-none placeholder-[var(--muted)] tracking-wide" placeholder="Team B" />
            {/* Country pool for team 2 */}
            <div className="relative" ref={countryDropdownRef2}>
              <button
                onClick={() => setCountryDropdownOpen2(o => !o)}
                className="p-1.5 rounded-lg border transition hover:bg-[var(--surface-2)]"
                style={{ background: 'var(--surface)', borderColor: countryDropdownOpen2 ? 'var(--sandy-brown)' : 'var(--border)', color: 'var(--sandy-brown)' }}
                title="Country pool for random team 2">
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
            <PlayerInput key={i} value={p.name} index={i}
              onChange={v => updatePlayer(2, i, v)}
              onSelectPlayer={(name, id) => { if (id != null) setPlayerIdMap(prev => ({ ...prev, [team2.players[i].gameId]: id })); }}
              onBulkPaste={values => bulkPastePlayer(2, i, values)}
              placeholder={`Player ${i + 1}`}
              apiUrlFn={getV2ApiUrl}
            />
          ))}
        </div>
      </div>

      <div className="mt-8 md:mt-12 flex flex-col items-center gap-5">
        <div className="flex flex-wrap items-stretch gap-0 rounded-xl border overflow-hidden divide-x" style={{ borderColor: 'var(--border)', background: 'var(--surface)' }}>
          <div className="flex flex-col justify-center px-4 md:px-6 py-3 md:py-4 gap-1">
            <span className="text-[9px] uppercase font-black text-[var(--muted)] tracking-widest">Matches</span>
            <input type="number" min={1} value={numMatches}
              onChange={e => setNumMatches(e.target.value)}
              onBlur={e => setNumMatches(String(Math.max(1, parseInt(e.target.value) || 1)))}
              className="bg-transparent w-16 text-2xl font-black outline-none tabular-nums" style={{ color: 'var(--sage-green)' }} />
          </div>
          <div className="flex flex-col justify-center px-4 md:px-6 py-3 md:py-4 gap-1 min-w-[160px] md:min-w-[200px]">
            <span className="text-[9px] uppercase font-black text-[var(--muted)] tracking-widest">AI Model</span>
            <select value={selectedModel} onChange={e => setSelectedModel(e.target.value)}
              className="bg-transparent text-sm font-bold outline-none cursor-pointer appearance-none" style={{ color: 'var(--sandy-brown)' }}>
              <option value="" style={{ background: 'var(--surface)' }}>Default v2</option>
              {models.map(m => <option key={m.id} value={m.id} style={{ background: 'var(--surface)' }}>{m.id}</option>)}
            </select>
          </div>
        </div>

        <button onClick={() => setShowAdvanced(!showAdvanced)}
          className="flex items-center gap-2 text-sm font-bold px-4 py-2 rounded-lg border transition"
          style={{ background: showAdvanced ? 'rgba(var(--sage-green-rgb), 0.1)' : 'var(--surface)', borderColor: showAdvanced ? 'rgba(var(--sage-green-rgb), 0.5)' : 'var(--border)', color: showAdvanced ? 'var(--sage-green)' : 'var(--muted)' }}>
          <Settings2 className="w-4 h-4" />
          {showAdvanced ? 'Hide Advanced Options' : 'Advanced Options'}
        </button>

        {showAdvanced && (
          <div className="w-full grid lg:grid-cols-2 gap-8 animate-in fade-in slide-in-from-top-4 duration-500">
            <BowlingOrderEditor teamName={team1.name} players={team1.players} eligibleBowlers={eligibleBowlers1}
              bowlingOrder={bowlingOrder1} onOrderChange={setBowlingOrder1} onDefault={() => fetchDefaultBowlingOrder(1)} loading={loadingOrder1} />
            <BowlingOrderEditor teamName={team2.name} players={team2.players} eligibleBowlers={eligibleBowlers2}
              bowlingOrder={bowlingOrder2} onOrderChange={setBowlingOrder2} onDefault={() => fetchDefaultBowlingOrder(2)} loading={loadingOrder2} />
          </div>
        )}

        <div className="flex gap-4">
          <button onClick={startSimulation} className="px-12 py-3 rounded-xl font-black hover:scale-105 transition shadow-[0_0_20px_rgba(var(--sandy-brown-rgb),0.4)]" style={{ background: 'var(--sandy-brown)', color: 'var(--background)' }}>
            {showAdvanced ? 'SIMULATE CUSTOM MATCH' : 'START SERIES'}
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen text-[var(--foreground)] flex" style={{ background: 'var(--background)' }}>
      <div className="fixed z-50 bg-[var(--surface)] border-[var(--border)] bottom-0 left-0 right-0 h-12 border-t flex-row md:bottom-auto md:left-0 md:top-0 md:right-auto md:w-14 md:h-full md:border-t-0 md:border-r md:flex-col md:py-4 md:gap-3 flex items-center justify-around md:justify-start px-2 md:px-0">
        <button onClick={stopAndReset} className="p-2.5 rounded-xl hover:bg-[var(--surface-2)] text-[var(--muted)] transition" title="Back">
          <ArrowLeft className="w-4 h-4" />
        </button>
        <div className="hidden md:block w-8 border-t border-[var(--border)]" />
        <button onClick={speedUp} className="p-2.5 rounded-xl hover:bg-[var(--surface-2)] transition"
          style={{ color: naturalMode ? 'var(--border)' : currentSpeedIdx === SPEED_STEPS.length - 1 ? 'var(--sage-green)' : 'var(--muted)', pointerEvents: naturalMode ? 'none' : 'auto', opacity: naturalMode ? 0.3 : 1 }}>
          <ChevronUp className="w-4 h-4" />
        </button>
        <span className="text-[9px] font-black font-mono tabular-nums" style={{ color: 'var(--sandy-brown)' }}>
          {naturalMode ? 'AUTO' : getSpeedLabel(delayMs)}
        </span>
        <button onClick={slowDown} className="p-2.5 rounded-xl hover:bg-[var(--surface-2)] transition"
          style={{ color: naturalMode ? 'var(--border)' : currentSpeedIdx === 0 ? 'var(--sage-green)' : 'var(--muted)', pointerEvents: naturalMode ? 'none' : 'auto', opacity: naturalMode ? 0.3 : 1 }}>
          <ChevronDown className="w-4 h-4" />
        </button>
        <div className="hidden md:block w-8 border-t border-[var(--border)]" />
        <button onClick={() => setNaturalMode(m => !m)}
          className="px-1.5 py-1 rounded-lg transition text-[9px] font-black tracking-widest"
          style={{ background: naturalMode ? 'rgba(var(--sandy-brown-rgb),0.15)' : 'var(--surface-2)', color: naturalMode ? 'var(--sandy-brown)' : 'var(--muted)', border: `1px solid ${naturalMode ? 'rgba(var(--sandy-brown-rgb),0.4)' : 'transparent'}` }}>
          AUTO
        </button>
        <div className="hidden md:block w-8 border-t border-[var(--border)]" />
        <button onClick={() => setPaused(p => !p)}
          className="p-2.5 rounded-xl transition"
          style={{ background: paused ? 'rgba(var(--sandy-brown-rgb),0.15)' : 'var(--surface-2)', color: paused ? 'var(--sandy-brown)' : 'var(--muted)' }}>
          {paused ? <Play className="w-4 h-4" /> : <Pause className="w-4 h-4" />}
        </button>
        <button onClick={advanceOneBall} className="p-2.5 rounded-xl hover:bg-[var(--surface-2)] text-[var(--muted)] transition">
          <SkipForward className="w-4 h-4" />
        </button>
      </div>

      <div className="flex-1 md:ml-14 pb-14 md:pb-0 p-3 md:p-8 max-w-[1600px] mx-auto w-full">
        <header className="mb-4 md:mb-6 flex justify-between items-center bg-[rgba(var(--surface-rgb),0.5)] p-3 md:p-4 rounded-xl border border-[rgba(var(--border-rgb),0.5)] backdrop-blur">
          <div>
            <div className="flex items-center gap-2 md:gap-3">
              {(delayMs === 0 || naturalMode) && !paused && !seriesComplete && (
                <div className="w-2 h-2 rounded-full bg-[var(--sandy-brown)] animate-pulse" />
              )}
              <h1 className="text-base md:text-xl font-black italic tracking-tighter">
                {(delayMs === 0 || naturalMode) && !paused && !seriesComplete ? 'LIVE SIMULATION' : 'SIMULATION'}
              </h1>
              <span className="text-[10px] font-black px-1.5 py-0.5 rounded-full" style={{ background: 'rgba(var(--sandy-brown-rgb),0.15)', color: 'var(--sandy-brown)' }}>v2</span>
            </div>
            <div className="flex gap-2 md:gap-3 text-xs font-mono text-[var(--muted)] mt-0.5 md:mt-1 pl-4 md:pl-5">
              <span className="truncate">{matchDetail?.match_no ? `Match ${matchDetail.match_no}/${numMatches}` : 'Starting...'}</span>
              {selectedVenue && <><span className="hidden sm:inline">•</span><span className="hidden sm:inline truncate">📍 {selectedVenue.name}</span></>}
            </div>
          </div>
          <div className="flex items-center gap-2 md:gap-4">
            {delayMs > 0 && !naturalMode && !seriesComplete && (
              <button onClick={() => { setDelayMs(0); setPaused(false); }} className="px-2 md:px-4 py-1.5 md:py-2 bg-[var(--surface-2)] hover:bg-[var(--sandy-brown)] hover:text-[var(--background)] text-[var(--muted)] font-bold text-xs rounded-lg transition flex items-center gap-1 md:gap-2 border border-[var(--border)]">
                <Zap className="w-3 h-3" /> <span className="hidden sm:inline">GO LIVE</span>
              </button>
            )}
            {seriesComplete && <div className="text-[var(--sandy-brown)] font-bold text-xs md:text-sm bg-[rgba(var(--sandy-brown-rgb),0.1)] px-2 md:px-3 py-1 rounded-full border border-[rgba(var(--sandy-brown-rgb),0.2)] whitespace-nowrap">SERIES COMPLETE</div>}
          </div>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-4 md:gap-6 lg:h-[calc(100vh-140px)]">
          <div className="lg:col-span-3 flex flex-col gap-4 md:gap-6 lg:h-full lg:overflow-y-auto scrollbar-thin scrollbar-thumb-[var(--border)] pr-0 lg:pr-2">
            <div className="flex-none">
              <ScoreCardLive detail={matchDetail} live={(delayMs === 0 || naturalMode) && !paused && !seriesComplete} gameIdMap={playerIdMap} allPlayers={[...team1.players, ...team2.players]} />
            </div>
            {history.length > 0 && (
              <div className="bg-[rgba(var(--surface-rgb),0.5)] border border-[var(--border)] rounded-xl p-4">
                <h3 className="text-xs font-bold text-[var(--muted)] uppercase tracking-widest mb-4">Match History</h3>
                <div className="flex flex-col gap-8">
                  {history.map((h, i) => {
                    const teams = Object.keys(h.scorecard);
                    const t1 = teams[0]; const t2 = teams[1];
                    return (
                      <div key={i} className="bg-[var(--background)] border border-[var(--border)] rounded-xl overflow-hidden hover:border-[rgba(var(--sandy-brown-rgb),0.3)] transition shadow-lg">
                        <div className="bg-[var(--surface)] px-4 py-3 border-b border-[var(--border)] flex justify-between items-center">
                          <span className="text-sm font-bold text-[var(--muted)]">MATCH {i + 1}</span>
                          <span className="text-sm font-bold text-[var(--sandy-brown)] bg-[rgba(var(--sandy-brown-rgb),0.1)] px-3 py-1 rounded-full border border-[rgba(var(--sandy-brown-rgb),0.2)]">{h.winner} won by {h.margin}</span>
                        </div>
                        <div className="p-4 grid lg:grid-cols-2 gap-6 bg-[rgba(var(--surface-rgb),0.5)]">
                          <DetailedScorecard teamName={t1} data={h.scorecard[t1]} gameIdMap={playerIdMap} teamPlayers={t1 === team1.name ? team1.players : team2.players} />
                          <DetailedScorecard teamName={t2} data={h.scorecard[t2]} gameIdMap={playerIdMap} teamPlayers={t2 === team1.name ? team1.players : team2.players} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
          <div className="flex flex-col gap-3 lg:h-full min-h-0">
            <div className="flex flex-col min-h-0" style={{ flex: liveSummary ? '0 0 auto' : '1 1 0', minHeight: liveSummary ? '180px' : undefined, maxHeight: liveSummary ? '50%' : '100%' }}>
              <div className="bg-[rgba(var(--surface-rgb),0.5)] border border-[var(--border)] rounded-xl overflow-hidden flex flex-col h-full">
                <div className="p-3 border-b border-[var(--border)] bg-[rgba(var(--surface-rgb),0.8)] backdrop-blur flex-none">
                  <h3 className="text-xs font-bold text-[var(--muted)] uppercase tracking-widest">Commentary</h3>
                </div>
                <div className="flex-1 overflow-y-auto min-h-0 h-48 lg:h-auto">
                  <Commentary events={ballEvents} />
                </div>
              </div>
            </div>
            {liveSummary && (
              <div className="lg:flex-1 min-h-0">
                <SeriesSummary data={liveSummary} isExpanded={showSummaryFull} onToggleExpand={() => setShowSummaryFull(!showSummaryFull)} />
              </div>
            )}
          </div>
        </div>
        {showSummaryFull && <div className="fixed inset-0 bg-[rgba(var(--background-rgb),0.8)] backdrop-blur-sm z-40" onClick={() => setShowSummaryFull(false)} />}
      </div>
    </div>
  );
}
