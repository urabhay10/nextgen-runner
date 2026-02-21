'use client';

import { useState, useEffect, useRef } from 'react';
import { ArrowLeft, ChevronUp, ChevronDown, Pause, Play, SkipForward, Settings2, Zap } from 'lucide-react';
import Link from 'next/link';
import PlayerInput from '@/components/PlayerInput';
import BowlingOrderEditor from '@/components/BowlingOrderEditor';
import ScoreCardLive from '@/components/ScoreCardLive';
import Commentary from '@/components/Commentary';
import SeriesSummary from '@/components/SeriesSummary';
import DetailedScorecard from '@/components/DetailedScorecard';
import { MatchDetail, BallEvent, HistoryItem, SeriesSummaryData, Model } from '@/types';
import { fetchModels, getApiUrl } from '@/lib/api';

export default function Simulator() {
  const [stage, setStage] = useState<'setup' | 'live'>('setup');
  const [numMatches, setNumMatches] = useState<string>('1');
  const [team1, setTeam1] = useState({ name: "India", players: Array(11).fill("") });
  const [team2, setTeam2] = useState({ name: "Australia", players: Array(11).fill("") });
  const [playerIdMap, setPlayerIdMap] = useState<Record<string, string | number>>({});
  
  // Models
  const [models, setModels] = useState<Model[]>([]);
  const [selectedModel, setSelectedModel] = useState<string>("");

  // Simulation Control
  const simulationIdRef = useRef<number>(0);
  const abortControllerRef = useRef<AbortController | null>(null);

  // Advanced State
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
  // stepSignalRef: fires the current waitIfPaused immediately
  const stepSignalRef = useRef<(() => void) | null>(null);
  // stepOnceRef: flag that causes both waitIfPaused AND the subsequent wait() to resolve instantly
  const stepOnceRef = useRef(false);

  useEffect(() => { delayMsRef.current = delayMs; }, [delayMs]);
  useEffect(() => { pausedRef.current = paused; }, [paused]);

  // Speed steps: 0.2x = 5000ms delay, 1x = 1000ms, 5x = 200ms, MAX = 0ms
  const SPEED_STEPS = [5000, 2000, 1000, 500, 200, 100, 0]; // index 2 = 1x default
  const getSpeedLabel = (ms: number) => {
    if (ms === 0) return 'MAX';
    return `${(1000 / ms).toFixed(1)}x`;
  };
  const currentSpeedIdx = SPEED_STEPS.indexOf(delayMs) !== -1 ? SPEED_STEPS.indexOf(delayMs) : 3;
  const speedUp = () => setDelayMs(prev => SPEED_STEPS[Math.min(SPEED_STEPS.indexOf(prev) !== -1 ? SPEED_STEPS.indexOf(prev) + 1 : 4, SPEED_STEPS.length - 1)]);
  const slowDown = () => setDelayMs(prev => SPEED_STEPS[Math.max(SPEED_STEPS.indexOf(prev) !== -1 ? SPEED_STEPS.indexOf(prev) - 1 : 2, 0)]);
  const advanceOneBall = () => {
    // Always set the step flag so the next gate (waitIfPaused or wait) picks it up
    stepOnceRef.current = true;
    // Fire whichever gate is currently active
    if (stepSignalRef.current) stepSignalRef.current(); // in waitIfPaused
    if (nextBallRef.current) nextBallRef.current();      // in wait()
  };
  const stopAndReset = () => { simulationIdRef.current = 0; setStage('setup'); setPaused(false); pausedRef.current = false; };

  // Keyboard shortcuts (only active in live stage)
  useEffect(() => {
    if (stage !== 'live') return;
    const handleKey = (e: KeyboardEvent) => {
      // Don't fire if user is typing in an input
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.key === ' ') { e.preventDefault(); setPaused(p => !p); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); speedUp(); }
      else if (e.key === 'ArrowDown') { e.preventDefault(); slowDown(); }
      else if (e.key === 'ArrowRight') { e.preventDefault(); advanceOneBall(); }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stage, paused, delayMs]);

  // Initial Data Fetch
  useEffect(() => {
    fetchModels().then(data => {
      // Ensure data is valid array before setting
      if (Array.isArray(data)) {
        setModels(data);
        // Default to empty string for "Default Backend Model"
        setSelectedModel(""); 
      } else {
        console.error("fetchModels returned non-array:", data);
        setModels([]);
      }
    }).catch(err => {
        console.error("fetchModels failed:", err);
        setModels([]);
    });
  }, []);

  const fillDefaults = () => {
    setTeam1({ name: "India", players: ["RG Sharma", "V Kohli", "RR Pant", "SA Yadav", "S Dube", "HH Pandya", "RA Jadeja", "AR Patel", "Kuldeep Yadav", "JJ Bumrah", "Arshdeep Singh"] });
    setTeam2({ name: "Australia", players: ["DA Warner", "TM Head", "MR Marsh", "GJ Maxwell", "MP Stoinis", "TH David", "MS Wade", "PJ Cummins", "MA Starc", "A Zampa", "JR Hazlewood"] });
  };

  const fetchDefaultBowlingOrder = async (teamId: 1 | 2) => {
    const team = teamId === 1 ? team1 : team2;
    const setOrder = teamId === 1 ? setBowlingOrder1 : setBowlingOrder2;
    const setLoading = teamId === 1 ? setLoadingOrder1 : setLoadingOrder2;

    // Filter empty players
    const activePlayers = team.players.filter(p => p.trim() !== "");
    if (activePlayers.length < 5) return; // Need at least 5 to bowl 20 overs typically

    setLoading(true);
    
    try {
      const res = await fetch(getApiUrl('/generate_bowling_order'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ players: activePlayers }),
        cache: 'no-store'
      });
      if (!res.ok) throw new Error('Failed to generate bowling order');
      const data = await res.json();
      if (data.bowling_order) {
        setOrder(data.bowling_order);
      }
    } catch (e) {
      console.error("Failed to fetch bowling order", e);
    } finally {
      setLoading(false);
    }
  };

  const fetchEligibleBowlers = async (teamId: 1 | 2) => {
    const team = teamId === 1 ? team1 : team2;
    const setEligible = teamId === 1 ? setEligibleBowlers1 : setEligibleBowlers2;
    
    const activePlayers = team.players.filter(p => p.trim() !== "");
    if (activePlayers.length === 0) return;

    try {
      const res = await fetch(getApiUrl('/eligible_bowlers'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ players: activePlayers }),
        cache: 'no-store'
      });
      if (!res.ok) throw new Error('Failed to fetch eligible bowlers');
      const data = await res.json();
      if (Array.isArray(data)) {
          setEligible(data.map((p: { name: string }) => p.name));
      }
    } catch (e) {
      console.error("Failed to fetch eligible bowlers", e);
    }
  };

  // Auto-fetch defaults when opening advanced or filling defaults if empty
  useEffect(() => {
    if (showAdvanced) {
      if (bowlingOrder1.every(b => b === "") && team1.players.some(p => p)) fetchDefaultBowlingOrder(1);
      if (bowlingOrder2.every(b => b === "") && team2.players.some(p => p)) fetchDefaultBowlingOrder(2);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showAdvanced]);

  // Debounced fetch for eligible bowlers when players or advanced mode changes
  useEffect(() => {
    if (showAdvanced && team1.players.some(p => p)) {
      const timer = setTimeout(() => fetchEligibleBowlers(1), 800);
      return () => clearTimeout(timer);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [team1.players, showAdvanced]);

  useEffect(() => {
    if (showAdvanced && team2.players.some(p => p)) {
      const timer = setTimeout(() => fetchEligibleBowlers(2), 800);
      return () => clearTimeout(timer);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [team2.players, showAdvanced]);

  const updatePlayer = (tId: 1 | 2, idx: number, v: string) => {
    if (tId === 1) { const n = [...team1.players]; n[idx] = v; setTeam1({ ...team1, players: n }); }
    else { const n = [...team2.players]; n[idx] = v; setTeam2({ ...team2, players: n }); }
  };

  const bulkPastePlayer = (tId: 1 | 2, startIdx: number, values: string[]) => {
    const team = tId === 1 ? team1 : team2;
    const setTeam = tId === 1 ? setTeam1 : setTeam2;
    const n = [...team.players];
    values.forEach((v, offset) => {
      const slot = startIdx + offset;
      if (slot < n.length) n[slot] = v;
    });
    setTeam({ ...team, players: n });
  };

  const getLiveSummary = () => {
    if (seriesComplete) return { ...seriesComplete, matches: history };
    if (history.length === 0) return null;

    let t1Wins = 0;
    let t2Wins = 0;
    let ties = 0;
    
    for (const h of history) {
        if (h.winner === team1.name) t1Wins++;
        else if (h.winner === team2.name) t2Wins++;
        else if (h.winner === 'Tie') ties++;
    }

    let header = "Series in Progress";
    if (t1Wins > t2Wins) header = `${team1.name} leads ${t1Wins}-${t2Wins}`;
    else if (t2Wins > t1Wins) header = `${team2.name} leads ${t2Wins}-${t1Wins}`;
    else header = `Series Level ${t1Wins}-${t2Wins}`;

    if (ties > 0) header += ` (${ties} ties)`;

    return {
        summary: { 
            scoreline: header,
            [team1.name]: t1Wins,
            [team2.name]: t2Wins,
            Tie: ties
        },
        matches: history
    };
  };

  const liveSummary = getLiveSummary();

  const startSimulation = async () => {
    // Generate new ID for this run
    const currentSimId = Date.now();
    simulationIdRef.current = currentSimId;

    // Cancel any ongoing request
    if (abortControllerRef.current) {
        abortControllerRef.current.abort();
    }
    abortControllerRef.current = new AbortController();

    setStage('live');
    setBallEvents([]);
    setMatchDetail(null);
    setHistory([]);
    setSeriesComplete(null);

    // Determine Mode
    const isCustom = showAdvanced && bowlingOrder1.some(b=>b) && bowlingOrder2.some(b=>b);
    const endpoint = isCustom ? '/simulate_custom_match' : '/simulate_series_stream';
    
    const payload: any = { // eslint-disable-line @typescript-eslint/no-explicit-any
        team1_name: team1.name,
        team1_players: team1.players,
        team2_name: team2.name,
        team2_players: team2.players,
        num_matches: Math.max(1, parseInt(numMatches) || 1),
        // Only include model if a specific one is selected (not empty string)
        ...(selectedModel ? { model: selectedModel } : {})
    };

    if (isCustom) {
        payload.team1_bowling_order = bowlingOrder1;
        payload.team2_bowling_order = bowlingOrder2;
    }

    try {
      const response = await fetch(getApiUrl(endpoint), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        cache: 'no-store'
      });

      if (!response.ok) throw new Error('Simulation failed');
      if (!response.body) throw new Error('No response body');

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      // Helper function to force delay / pause
      const wait = (ms: number) => new Promise<void>(resolve => {
        // If a step was requested, skip the delay and consume the flag
        if (ms <= 0 || stepOnceRef.current) { stepOnceRef.current = false; resolve(); return; }
        const timer = setTimeout(resolve, ms);
        // nextBallRef skips the delay; also clear stepOnce so it doesn't bleed to next ball
        nextBallRef.current = () => { clearTimeout(timer); stepOnceRef.current = false; resolve(); };
      });

      const waitIfPaused = () => new Promise<void>(resolve => {
        const check = () => {
          // Not paused, or a step was requested — let this ball through
          if (!pausedRef.current || stepOnceRef.current) { stepSignalRef.current = null; resolve(); return; }
          // Register step signal so advanceOneBall can fire it immediately
          stepSignalRef.current = () => { stepSignalRef.current = null; resolve(); };
          setTimeout(check, 50);
        };
        check();
      });

      const processLine = async (line: string) => {
        if (!line.trim()) return;
        if (simulationIdRef.current !== currentSimId) return; // Stop if new sim started

        try {
          const data = JSON.parse(line);
          if (data.type === 'ball') {
            // Wait if paused
            await waitIfPaused();
            if (simulationIdRef.current !== currentSimId) return;
            // Apply delay
            const currentDelay = delayMsRef.current;
            if (currentDelay > 0) await wait(currentDelay);
            if (simulationIdRef.current !== currentSimId) return;

            setMatchDetail(data.detail);
            setBallEvents(prev => {
              const currentMatchNo = data.match_no;
              const lastMatchNo = prev.length > 0 ? prev[prev.length - 1].match_no : currentMatchNo;
              if (currentMatchNo !== lastMatchNo) {
                // Return a new array for new match to reset commentary or handle transitions if needed.
                return [{ ...data.detail, runs_scored: data.detail.runs_scored, is_wicket: data.detail.is_wicket, innings: data.innings, match_no: data.match_no } as BallEvent];
              }
              return [...prev, { ...data.detail, runs_scored: data.detail.runs_scored, is_wicket: data.detail.is_wicket, innings: data.innings, match_no: data.match_no } as BallEvent];
            });
          } else if (data.type === 'match_update') {
            // Append new matches to the end of the list so previous matches don't shift down
            setHistory(prev => [...prev, data]);
            
            // If the match update contains comprehensive player stats, we might want to ensure 'out_by' is populated.
            // However, the server response 'match_update' payload structure for 'scorecard' -> 'batting' list 
            // should ideally already contain the 'out_by' or 'wicket_taker' info if available. 
            // The simulation API might need to provide this. Assuming 'out_by' comes in the 'batting' stats.
            
          } else if (data.type === 'match_complete') {
             // Handle single match completion (custom match)
             setHistory(prev => [...prev, data]);
             setSeriesComplete({ summary: { scoreline: `${data.winner} won by ${data.margin}` } });
          } else if (data.type === 'series_complete') {
            setSeriesComplete(data);
          }
        } catch (e) {
          console.error("Error parsing JSON line:", line, e);
        }
      };

      while (true) {
        if (simulationIdRef.current !== currentSimId) break;
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value, { stream: true });
        buffer += chunk;
        const lines = buffer.split('\n');
        buffer = lines.pop() || "";
        
        // Loop through lines sequentially to respect the async delay in processLine
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
    <div className="min-h-screen p-8 max-w-6xl mx-auto" style={{ background: 'var(--background)' }}>
      <header className="mb-12 text-center relative">
          <Link href="/" className="absolute left-0 top-1/2 -translate-y-1/2 text-[var(--muted)] hover:text-[var(--foreground)] transition flex items-center gap-2 text-sm font-bold px-4 py-2 rounded-full border" style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}>
            <ArrowLeft className="w-4 h-4" /> BACK TO HOME
          </Link>
        <h1 className="text-5xl font-black text-[var(--foreground)] tracking-tight">CRICKET SERIES SIMULATOR</h1>
      </header>
      <div className="grid md:grid-cols-2 gap-8">
        {/* Team 1 */}
        <div className="space-y-2">
          <div className="flex items-center gap-3 mb-4 pb-3 border-b" style={{ borderColor: 'var(--border)' }}>
            <div className="w-1.5 h-8 rounded-full" style={{ background: 'var(--sage-green)' }}></div>
            <input
              value={team1.name}
              onChange={e => setTeam1({ ...team1, name: e.target.value })}
              className="flex-1 bg-transparent text-xl font-black text-[var(--foreground)] outline-none placeholder-[var(--muted)] tracking-wide"
              placeholder="Team 1"
            />
          </div>
          {team1.players.map((p, i) => (
            <PlayerInput 
              key={i} 
              value={p} 
              index={i}
              onChange={v => updatePlayer(1, i, v)}
              onSelectPlayer={(name, id) => { if (id != null) setPlayerIdMap(prev => ({ ...prev, [name]: id })); }}
              onBulkPaste={values => bulkPastePlayer(1, i, values)}
              placeholder={`Player ${i + 1}`} 
            />
          ))}
        </div>

        {/* Team 2 */}
        <div className="space-y-2">
          <div className="flex items-center gap-3 mb-4 pb-3 border-b" style={{ borderColor: 'var(--border)' }}>
            <div className="w-1.5 h-8 rounded-full" style={{ background: 'var(--sandy-brown)' }}></div>
            <input
              value={team2.name}
              onChange={e => setTeam2({ ...team2, name: e.target.value })}
              className="flex-1 bg-transparent text-xl font-black text-[var(--foreground)] outline-none placeholder-[var(--muted)] tracking-wide"
              placeholder="Team 2"
            />
          </div>
          {team2.players.map((p, i) => (
            <PlayerInput 
              key={i} 
              value={p} 
              index={i}
              onChange={v => updatePlayer(2, i, v)}
              onSelectPlayer={(name, id) => { if (id != null) setPlayerIdMap(prev => ({ ...prev, [name]: id })); }}
              onBulkPaste={values => bulkPastePlayer(2, i, values)}
              placeholder={`Player ${i + 1}`} 
            />
          ))}
        </div>
      </div>
      <div className="mt-12 flex flex-col items-center gap-5">
        {/* Config row */}
        <div className="flex items-stretch gap-0 rounded-xl border overflow-hidden divide-x" style={{ borderColor: 'var(--border)', background: 'var(--surface)' }}>
          <div className="flex flex-col justify-center px-6 py-4 gap-1" style={{ borderRightColor: 'var(--border)' }}>
            <span className="text-[9px] uppercase font-black text-[var(--muted)] tracking-widest">Matches</span>
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
          <div className="flex flex-col justify-center px-6 py-4 gap-1 min-w-[200px]">
            <span className="text-[9px] uppercase font-black text-[var(--muted)] tracking-widest">AI Model</span>
            <select
              value={selectedModel}
              onChange={(e) => setSelectedModel(e.target.value)}
              className="bg-transparent text-sm font-bold outline-none cursor-pointer appearance-none"
              style={{ color: 'var(--sandy-brown)' }}
            >
              <option value="" style={{ background: 'var(--surface)' }}>Default</option>
              {models.map(m => (
                <option key={m.id} value={m.id} style={{ background: 'var(--surface)' }}>{m.id}</option>
              ))}
            </select>
          </div>
        </div>
        
        {/* Advanced Toggle */}
        <button 
          onClick={() => setShowAdvanced(!showAdvanced)}
          className={`flex items-center gap-2 text-sm font-bold px-4 py-2 rounded-lg border transition`}
          style={{
            background: showAdvanced ? 'rgba(var(--sage-green-rgb), 0.1)' : 'var(--surface)',
            borderColor: showAdvanced ? 'rgba(var(--sage-green-rgb), 0.5)' : 'var(--border)',
            color: showAdvanced ? 'var(--sage-green)' : 'var(--muted)'
          }}
        >
          <Settings2 className="w-4 h-4" />
          {showAdvanced ? 'Hide Advanced Options' : 'Advanced Options'}
        </button>

        {showAdvanced && (
          <div className="w-full grid lg:grid-cols-2 gap-8 animate-in fade-in slide-in-from-top-4 duration-500">
            <BowlingOrderEditor 
              teamName={team1.name}
              players={team1.players}
              eligibleBowlers={eligibleBowlers1}
              bowlingOrder={bowlingOrder1}
              onOrderChange={setBowlingOrder1}
              onDefault={() => fetchDefaultBowlingOrder(1)}
              loading={loadingOrder1}
            />
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

        <div className="flex gap-4">
          <button onClick={fillDefaults} className="px-8 py-3 rounded-xl font-bold transition" style={{ color: 'var(--muted)', border: '1px solid var(--border)', background: 'var(--surface)' }}>Quick Fill</button>
          <button onClick={startSimulation} className="px-12 py-3 rounded-xl font-black hover:scale-105 transition shadow-[0_0_20px_rgba(var(--sage-green-rgb),0.4)]" style={{ background: 'var(--sage-green)', color: 'var(--background)' }}>
            {showAdvanced ? 'SIMULATE CUSTOM MATCH' : 'START SERIES'}
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen text-[var(--foreground)] flex" style={{ background: 'var(--background)' }}>
      {/* Control Sidebar */}
      <div className="w-14 bg-[var(--surface)] border-r border-[var(--border)] flex flex-col items-center py-4 gap-3 z-50 fixed left-0 h-full">
        {/* Back / Stop & Reset */}
        <button onClick={stopAndReset} className="p-2.5 rounded-xl hover:bg-[var(--surface-2)] text-[var(--muted)] transition" title="Back to Setup">
          <ArrowLeft className="w-4 h-4" />
        </button>

        <div className="w-8 border-t border-[var(--border)]" />

        {/* Speed up */}
        <button onClick={speedUp} title={`Speed up (current: ${getSpeedLabel(delayMs)})`}
          className="p-2.5 rounded-xl hover:bg-[var(--surface-2)] transition"
          style={{ color: currentSpeedIdx === SPEED_STEPS.length - 1 ? 'var(--sage-green)' : 'var(--muted)' }}>
          <ChevronUp className="w-4 h-4" />
        </button>

        {/* Speed label */}
        <span className="text-[9px] font-black font-mono tabular-nums" style={{ color: 'var(--sage-green)' }}>
          {getSpeedLabel(delayMs)}
        </span>

        {/* Slow down */}
        <button onClick={slowDown} title="Slow down"
          className="p-2.5 rounded-xl hover:bg-[var(--surface-2)] transition"
          style={{ color: currentSpeedIdx === 0 ? 'var(--sage-green)' : 'var(--muted)' }}>
          <ChevronDown className="w-4 h-4" />
        </button>

        <div className="w-8 border-t border-[var(--border)]" />

        {/* Pause / Resume */}
        <button onClick={() => setPaused(p => !p)} title={paused ? 'Resume (Space)' : 'Pause (Space)'}
          className="p-2.5 rounded-xl transition"
          style={{ background: paused ? 'rgba(var(--sandy-brown-rgb),0.15)' : 'var(--surface-2)', color: paused ? 'var(--sandy-brown)' : 'var(--muted)' }}>
          {paused ? <Play className="w-4 h-4" /> : <Pause className="w-4 h-4" />}
        </button>

        {/* Next ball (skip one step) */}
        <button onClick={advanceOneBall} title="Advance one ball (→)"
          className="p-2.5 rounded-xl hover:bg-[var(--surface-2)] text-[var(--muted)] transition">
          <SkipForward className="w-4 h-4" />
        </button>
      </div>

      <div className="flex-1 ml-14 p-4 md:p-8 max-w-[1600px] mx-auto w-full">
        <header className="mb-6 flex justify-between items-center bg-[rgba(var(--surface-rgb),0.5)] p-4 rounded-xl border border-[rgba(var(--border-rgb),0.5)] backdrop-blur">
          <div>
            <div className="flex items-center gap-3">
                {delayMs === 0 && !paused && !seriesComplete && (
                  <div className="w-2 h-2 rounded-full bg-[var(--sandy-brown)] animate-pulse"></div>
                )}
                <h1 className="text-xl font-black italic tracking-tighter text-[var(--foreground)]">
                {delayMs === 0 && !paused && !seriesComplete ? 'LIVE SIMULATION' : 'SIMULATION'}
                </h1>
            </div>
            <div className="flex gap-3 text-xs font-mono text-[var(--muted)] mt-1 pl-5">
              <span>{matchDetail?.match_no ? `Match ${matchDetail.match_no} of ${numMatches}` : 'Starting...'}</span>
              <span>•</span>
              <span>Model: {selectedModel || 'Default'}</span>
            </div>
          </div>
          <div className="flex items-center gap-4">
               {delayMs > 0 && !seriesComplete && (
                 <button onClick={() => { setDelayMs(0); setPaused(false); }} className="px-4 py-2 bg-[var(--surface-2)] hover:bg-[var(--sage-green)] hover:text-[var(--background)] text-[var(--muted)] font-bold text-xs rounded-lg transition flex items-center gap-2 border border-[var(--border)] hover:border-[var(--sage-green)]">
                   <Zap className="w-3 h-3" /> GO LIVE
                 </button>
               )}
               {seriesComplete && <div className="text-[var(--sage-green)] font-bold text-sm bg-[rgba(var(--sage-green-rgb),0.1)] px-3 py-1 rounded-full border border-[rgba(var(--sage-green-rgb),0.2)]">SERIES COMPLETE</div>}
          </div>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 h-[calc(100vh-140px)]">
          {/* Main Scorecard Area */}
          <div className="lg:col-span-3 flex flex-col gap-6 h-full overflow-y-auto scrollbar-thin scrollbar-thumb-[var(--border)] pr-2">
             <div className="flex-none">
                <ScoreCardLive detail={matchDetail} live={delayMs === 0 && !paused && !seriesComplete} playerIdMap={playerIdMap} />
             </div>
             
             {/* Match History Grid */}
             {history.length > 0 && (
                <div className="bg-[rgba(var(--surface-rgb),0.5)] border border-[var(--border)] rounded-xl p-4">
                    <h3 className="text-xs font-bold text-[var(--muted)] uppercase tracking-widest mb-4 sticky top-0 bg-[rgba(var(--surface-rgb),0.95)] py-2 z-10 backdrop-blur">Match History</h3>
                    <div className="flex flex-col gap-8">
                        {history.map((h, i) => {
                             const teams = Object.keys(h.scorecard);
                             const t1 = teams[0];
                             const t2 = teams[1];
                             const s1 = h.scorecard[t1];
                             const s2 = h.scorecard[t2];
                             
                             return (
                                 <div key={i} className="bg-[var(--background)] border border-[var(--border)] rounded-xl overflow-hidden hover:border-[rgba(var(--sage-green-rgb),0.3)] transition shadow-lg">
                                     <div className="bg-[var(--surface)] px-4 py-3 border-b border-[var(--border)] flex justify-between items-center">
                                         <span className="text-sm font-bold text-[var(--muted)]">MATCH {i+1}</span>
                                         <span className="text-sm font-bold text-[var(--sage-green)] bg-[rgba(var(--sage-green-rgb),0.1)] px-3 py-1 rounded-full border border-[rgba(var(--sage-green-rgb),0.2)]">{h.winner} won by {h.margin}</span>
                                     </div>
                                     <div className="p-4 grid lg:grid-cols-2 gap-6 bg-[rgba(var(--surface-rgb),0.5)]">
                                         <DetailedScorecard teamName={t1} data={s1} playerIdMap={playerIdMap} />
                                         <DetailedScorecard teamName={t2} data={s2} playerIdMap={playerIdMap} />
                                     </div>
                                 </div>
                             );
                        })}
                    </div>
                </div>
             )}
          </div>
          
          {/* Right Sidebar */}
          <div className="flex flex-col gap-3 h-full min-h-0">
             {/* Commentary — fixed min height so it never collapses too small */}
             <div className="flex flex-col min-h-0" style={{ flex: liveSummary ? '0 0 auto' : '1 1 0', minHeight: liveSummary ? '220px' : undefined, maxHeight: liveSummary ? '50%' : '100%' }}>
               <div className="bg-[rgba(var(--surface-rgb),0.5)] border border-[var(--border)] rounded-xl overflow-hidden flex flex-col h-full">
                 <div className="p-3 border-b border-[var(--border)] bg-[rgba(var(--surface-rgb),0.8)] backdrop-blur flex-none">
                     <h3 className="text-xs font-bold text-[var(--muted)] uppercase tracking-widest">Commentary</h3>
                 </div>
                <div className="flex-1 overflow-y-auto min-h-0">
                    <Commentary events={ballEvents} />
                </div>
               </div>
             </div>

             {liveSummary && (
                 <div className="flex-1 min-h-0">
                     <SeriesSummary 
                        data={liveSummary} 
                        isExpanded={showSummaryFull}
                        onToggleExpand={() => setShowSummaryFull(!showSummaryFull)}
                     />
                 </div>
             )}
          </div>
        </div>
        {/* Overlay when summary is expanded */}
        {showSummaryFull && (
            <div 
                className="fixed inset-0 bg-[rgba(var(--background-rgb),0.8)] backdrop-blur-sm z-40"
                onClick={() => setShowSummaryFull(false)}
            />
        )}
      </div>
    </div>
  );
}
