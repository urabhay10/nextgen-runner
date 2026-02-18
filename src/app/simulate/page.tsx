'use client';

import { useState, useEffect, useRef } from 'react';
import { ArrowLeft, History, ChevronDown, ChevronUp, Settings2, Zap } from 'lucide-react';
import Link from 'next/link';
import PlayerInput from '@/components/PlayerInput';
import BowlingOrderEditor from '@/components/BowlingOrderEditor';
import ScoreCardLive from '@/components/ScoreCardLive';
import Commentary from '@/components/Commentary';
import SeriesSummary from '@/components/SeriesSummary';
import { MatchDetail, BallEvent, HistoryItem, SeriesSummaryData, Model } from '@/types';
import { fetchModels, getApiUrl } from '@/lib/api';

export default function Simulator() {
  const [stage, setStage] = useState<'setup' | 'live'>('setup');
  const [numMatches, setNumMatches] = useState(1);
  const [team1, setTeam1] = useState({ name: "India", players: Array(11).fill("") });
  const [team2, setTeam2] = useState({ name: "Australia", players: Array(11).fill("") });
  
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
  const [delayMs, setDelayMs] = useState(500); // Default to reasonable 500ms
  const delayMsRef = useRef(delayMs);

  useEffect(() => {
    delayMsRef.current = delayMs;
  }, [delayMs]);

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
        body: JSON.stringify({
          players: activePlayers
        })
      });
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
        body: JSON.stringify({ players: activePlayers })
      });
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
        num_matches: numMatches,
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
        signal: abortControllerRef.current.signal
      });

      if (!response.body) {
        throw new Error("No response body");
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      // Helper function to force delay
      const wait = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

      const processLine = async (line: string) => {
        if (!line.trim()) return;
        if (simulationIdRef.current !== currentSimId) return; // Stop if new sim started

        try {
          const data = JSON.parse(line);
          if (data.type === 'ball') {
            // Apply delay before updating state for ball events to simulate speed
            // Check ref again after delay
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
    <div className="min-h-screen p-8 max-w-6xl mx-auto dark:bg-[#0f172a]">
      <header className="mb-12 text-center relative">
          <Link href="/" className="absolute left-0 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white transition flex items-center gap-2 text-sm font-bold bg-slate-800 px-4 py-2 rounded-full border border-slate-700">
            <ArrowLeft className="w-4 h-4" /> BACK TO HOME
          </Link>
        <h1 className="text-5xl font-black bg-gradient-to-r from-emerald-400 to-cyan-500 bg-clip-text text-transparent tracking-tight">CRICKET SERIES SIMULATOR</h1>
      </header>
      <div className="grid md:grid-cols-2 gap-12">
        <div className="space-y-4">
          <input 
            value={team1.name} 
            onChange={e => setTeam1({ ...team1, name: e.target.value })} 
            className="w-full bg-transparent text-2xl font-bold border-b-2 border-slate-700 focus:border-emerald-500 outline-none pb-2 text-emerald-400" 
            placeholder="Team 1" 
          />
          {team1.players.map((p, i) => (
            <PlayerInput 
              key={i} 
              value={p} 
              onChange={v => updatePlayer(1, i, v)} 
              placeholder={`Player ${i + 1}`} 
            />
          ))}
        </div>
        <div className="space-y-4 text-right">
          <input 
            value={team2.name} 
            onChange={e => setTeam2({ ...team2, name: e.target.value })} 
            className="w-full bg-transparent text-2xl font-bold border-b-2 border-slate-700 focus:border-rose-500 outline-none pb-2 text-rose-400 text-right" 
            placeholder="Team 2" 
          />
          {team2.players.map((p, i) => (
            <PlayerInput 
              key={i} 
              value={p} 
              onChange={v => updatePlayer(2, i, v)} 
              placeholder={`Player ${i + 1}`} 
            />
          ))}
        </div>
      </div>
      <div className="mt-16 flex flex-col items-center gap-6">
        <div className="flex gap-8">
          <div className="flex items-center gap-4 bg-slate-800 p-3 rounded-xl border border-slate-700">
            <span className="text-slate-400 font-bold">Games:</span>
            <input 
              type="number" 
              value={numMatches} 
              onChange={e => setNumMatches(Math.max(1, parseInt(e.target.value) || 1))} 
              className="bg-slate-900 w-16 p-1 text-center font-bold text-emerald-400 border border-slate-700 rounded text-white"
            />
          </div>

          <div className="flex items-center gap-4 bg-slate-800 p-3 rounded-xl border border-slate-700">
            <span className="text-slate-400 font-bold">Model:</span>
            <select 
              value={selectedModel}
              onChange={(e) => setSelectedModel(e.target.value)}
              className="bg-slate-900 px-3 py-1 font-bold text-emerald-400 border border-slate-700 rounded text-white outline-none"
            >
              <option value="">Default Backend Model</option>
              {models.map(m => (
                <option key={m.id} value={m.id}>{m.id}</option>
              ))}
            </select>
          </div>
        </div>
        
        {/* Advanced Toggle */}
        <button 
          onClick={() => setShowAdvanced(!showAdvanced)}
          className={`flex items-center gap-2 text-sm font-bold px-4 py-2 rounded-lg border transition ${showAdvanced ? 'bg-emerald-500/10 border-emerald-500/50 text-emerald-400' : 'bg-slate-800 border-slate-700 text-slate-400 hover:text-white'}`}
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
          <button onClick={fillDefaults} className="px-8 py-3 rounded-xl text-slate-400 border border-slate-700 font-bold hover:bg-slate-800 transition">Quick Fill</button>
          <button onClick={startSimulation} className="px-12 py-3 rounded-xl bg-emerald-500 text-slate-900 font-black hover:scale-105 transition shadow-[0_0_20px_rgba(16,185,129,0.4)]">
            {showAdvanced ? 'SIMULATE CUSTOM MATCH' : 'START SERIES'}
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-[#0f172a] text-white flex">
      {/* Speed Control Sidebar */}
      <div className="w-16 bg-slate-900 border-r border-slate-800 flex flex-col items-center py-8 z-50 fixed left-0 h-full">
         <div className="mb-4 text-xs font-bold text-slate-500 uppercase tracking-widest rotate-180" style={{ writingMode: 'vertical-rl' }}>SPEED</div>
         <div className="h-64 relative flex items-center justify-center">
            <input
              type="range"
              min="0"
              max="1000"
              step="50"
              value={1000 - delayMs} // Invert so up is fast
              onChange={(e) => setDelayMs(1000 - parseInt(e.target.value))}
              className="w-64 -rotate-90 bg-slate-800 h-2 rounded-lg appearance-none cursor-pointer accent-emerald-500"
            />
         </div>
         <div className="mt-4 text-xs font-bold text-slate-500">
            {delayMs < 50 ? 'MAX' : delayMs > 800 ? 'SLOW' : ''}
         </div>
         
         <div className="mt-auto">
            <button key="exit" onClick={() => { simulationIdRef.current = 0; setStage('setup'); }} className="p-3 bg-slate-800 rounded-full hover:bg-rose-500 hover:text-white transition text-slate-400">
                <ArrowLeft className="w-5 h-5" />
            </button>
         </div>
      </div>

      <div className="flex-1 ml-16 p-4 md:p-8 max-w-7xl mx-auto w-full">
        <header className="mb-8 flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-black italic tracking-tighter text-transparent bg-clip-text bg-gradient-to-r from-white to-slate-500">
              LIVE SIMULATION
            </h1>
            <div className="flex gap-2 text-sm font-mono text-slate-400 mt-1">
              <span>Model: {models.find(m => m.id === selectedModel)?.name || selectedModel}</span>
              <span>•</span>
              <span>Delay: {delayMs}ms</span>
            </div>
          </div>
        </header>

        <div className="grid lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 space-y-6">
            <ScoreCardLive detail={matchDetail} live={delayMs > 0 && !seriesComplete && (history.length < numMatches || !matchDetail?.is_wicket)} />
            <Commentary events={ballEvents} />
          </div>
          
          <div className="space-y-6">
            {seriesComplete && <SeriesSummary data={seriesComplete} />}
            <div className="bg-slate-900 p-6 rounded-2xl border border-slate-800">
               <h3 className="font-bold text-slate-400 mb-4 uppercase text-xs tracking-widest">Controls</h3>
               <button onClick={() => setDelayMs(0)} className="w-full py-3 bg-emerald-500 hover:bg-emerald-400 text-slate-900 font-bold rounded-lg transition flex items-center justify-center gap-2 mb-3">
                 <Zap className="w-4 h-4" /> SKIP / INSTANT
               </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
