'use client';

import { useState, useEffect, useRef } from 'react';
import { ArrowLeft, History, ChevronDown, ChevronUp, Settings2, Zap } from 'lucide-react';
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
  const [numMatches, setNumMatches] = useState(1);
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
      <div className="grid md:grid-cols-2 gap-8">
        {/* Team 1 */}
        <div className="space-y-2">
          <div className="flex items-center gap-3 mb-4 pb-3 border-b border-slate-800">
            <div className="w-1.5 h-8 rounded-full bg-emerald-500"></div>
            <input
              value={team1.name}
              onChange={e => setTeam1({ ...team1, name: e.target.value })}
              className="flex-1 bg-transparent text-xl font-black text-white outline-none placeholder-slate-600 tracking-wide"
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
          <div className="flex items-center gap-3 mb-4 pb-3 border-b border-slate-800">
            <div className="w-1.5 h-8 rounded-full bg-rose-500"></div>
            <input
              value={team2.name}
              onChange={e => setTeam2({ ...team2, name: e.target.value })}
              className="flex-1 bg-transparent text-xl font-black text-white outline-none placeholder-slate-600 tracking-wide"
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
        <div className="flex items-stretch gap-0 rounded-xl border border-slate-800 overflow-hidden bg-slate-900/60 divide-x divide-slate-800">
          <div className="flex flex-col justify-center px-6 py-4 gap-1">
            <span className="text-[9px] uppercase font-black text-slate-500 tracking-widest">Matches</span>
            <input
              type="number"
              value={numMatches}
              onChange={e => setNumMatches(Math.max(1, parseInt(e.target.value) || 1))}
              className="bg-transparent w-16 text-2xl font-black text-emerald-400 outline-none tabular-nums"
            />
          </div>
          <div className="flex flex-col justify-center px-6 py-4 gap-1 min-w-[200px]">
            <span className="text-[9px] uppercase font-black text-slate-500 tracking-widest">AI Model</span>
            <select
              value={selectedModel}
              onChange={(e) => setSelectedModel(e.target.value)}
              className="bg-transparent text-sm font-bold text-cyan-400 outline-none cursor-pointer appearance-none"
            >
              <option value="" className="bg-slate-900">Default</option>
              {models.map(m => (
                <option key={m.id} value={m.id} className="bg-slate-900">{m.id}</option>
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
      <div className="w-16 bg-slate-900 border-r border-slate-800 flex flex-col items-center py-8 z-50 fixed left-0 h-full justify-between">
         <div className="flex flex-col items-center gap-2">
             <Link href="/" className="p-3 bg-slate-800/50 rounded-xl hover:bg-slate-700 text-slate-400 transition" title="Back to Home">
                 <ArrowLeft className="w-5 h-5" />
             </Link>
         </div>

         <div className="flex flex-col items-center h-full max-h-[50vh] relative group">
             <div className="mb-4 text-[10px] font-bold text-slate-500 uppercase tracking-widest rotate-180" style={{ writingMode: 'vertical-rl' }}>SIMULATION SPEED</div>
             <div className="h-64 relative flex items-center justify-center w-8 bg-slate-800/50 rounded-full overflow-hidden">
                <div 
                    className="absolute bottom-0 w-full bg-emerald-500/20 transition-all duration-300"
                    style={{ height: `${((1000 - delayMs) / 1000) * 100}%` }}
                ></div>
                <input
                  type="range"
                  min="0"
                  max="1000"
                  step="50"
                  value={1000 - delayMs} // Invert so up is fast
                  onChange={(e) => setDelayMs(1000 - parseInt(e.target.value))}
                  className="w-64 -rotate-90 bg-transparent h-full w-8 appearance-none cursor-pointer z-10 opacity-0"
                />
                <div className="pointer-events-none absolute inset-0 flex flex-col justify-between py-2 items-center text-[8px] font-mono text-slate-600">
                    <span>MAX</span>
                    <span>---</span>
                    <span>---</span>
                    <span>---</span>
                    <span>---</span>
                    <span>0.5x</span>
                </div>
             </div>
         </div>
         
         <button onClick={() => { simulationIdRef.current = 0; setStage('setup'); }} className="p-3 bg-rose-500/10 hover:bg-rose-500/20 text-rose-500 rounded-xl transition" title="Stop & Reset">
             <Settings2 className="w-5 h-5" />
         </button>
      </div>

      <div className="flex-1 ml-16 p-4 md:p-8 max-w-[1600px] mx-auto w-full">
        <header className="mb-6 flex justify-between items-center bg-slate-900/50 p-4 rounded-xl border border-slate-800/50 backdrop-blur">
          <div>
            <div className="flex items-center gap-3">
                <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse"></div>
                <h1 className="text-xl font-black italic tracking-tighter text-white">
                LIVE SIMULATION
                </h1>
            </div>
            <div className="flex gap-3 text-xs font-mono text-slate-500 mt-1 pl-5">
              <span>{matchDetail?.match_no ? `Match ${matchDetail.match_no} of ${numMatches}` : 'Starting...'}</span>
              <span>•</span>
              <span>Model: {selectedModel || 'Default'}</span>
            </div>
          </div>
          <div className="flex items-center gap-4">
               {seriesComplete && <div className="text-emerald-400 font-bold text-sm bg-emerald-500/10 px-3 py-1 rounded-full border border-emerald-500/20">SERIES COMPLETE</div>}
               <button onClick={() => setDelayMs(0)} className="px-4 py-2 bg-slate-800 hover:bg-emerald-500 hover:text-slate-900 text-slate-400 font-bold text-xs rounded-lg transition flex items-center gap-2 border border-slate-700 hover:border-emerald-500">
                 <Zap className="w-3 h-3" /> SKIP TO END
               </button>
          </div>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 h-[calc(100vh-140px)]">
          {/* Main Scorecard Area */}
          <div className="lg:col-span-3 flex flex-col gap-6 h-full overflow-y-auto scrollbar-thin scrollbar-thumb-slate-700 pr-2">
             <div className="flex-none">
                <ScoreCardLive detail={matchDetail} live={delayMs > 0 && !seriesComplete && (history.length < numMatches || !matchDetail?.is_wicket)} playerIdMap={playerIdMap} />
             </div>
             
             {/* Match History Grid */}
             {history.length > 0 && (
                <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-4">
                    <h3 className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-4 sticky top-0 bg-slate-900/95 py-2 z-10 backdrop-blur">Match History</h3>
                    <div className="flex flex-col gap-8">
                        {history.map((h, i) => {
                             const teams = Object.keys(h.scorecard);
                             const t1 = teams[0];
                             const t2 = teams[1];
                             const s1 = h.scorecard[t1];
                             const s2 = h.scorecard[t2];
                             
                             return (
                                 <div key={i} className="bg-slate-950 border border-slate-800 rounded-xl overflow-hidden hover:border-emerald-500/30 transition shadow-lg">
                                     <div className="bg-slate-900 px-4 py-3 border-b border-slate-800 flex justify-between items-center">
                                         <span className="text-sm font-bold text-slate-400">MATCH {i+1}</span>
                                         <span className="text-sm font-bold text-emerald-400 bg-emerald-500/10 px-3 py-1 rounded-full border border-emerald-500/20">{h.winner} won by {h.margin}</span>
                                     </div>
                                     <div className="p-4 grid lg:grid-cols-2 gap-6 bg-slate-900/50">
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
          <div className="flex flex-col gap-6 h-full min-h-0">
             <div className="flex-1 min-h-0 bg-slate-900/50 border border-slate-800 rounded-xl overflow-hidden flex flex-col">
                 <div className="p-3 border-b border-slate-800 bg-slate-900/80 backdrop-blur">
                     <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest">Commentary</h3>
                 </div>
                <div className="flex-1 overflow-hidden relative">
                    <div className="absolute inset-0 overflow-y-auto">
                        <Commentary events={ballEvents} />
                    </div>
                </div>
             </div>

             {(liveSummary) && (
                 <div className="flex-none h-1/3 min-h-[300px]">
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
                className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-40"
                onClick={() => setShowSummaryFull(false)}
            />
        )}
      </div>
    </div>
  );
}
