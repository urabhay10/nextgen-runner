'use client';

import { useState, useEffect } from 'react';
import { ArrowLeft, History, ChevronDown, ChevronUp, Settings2 } from 'lucide-react';
import Link from 'next/link';
import PlayerInput from '@/components/PlayerInput';
import BowlingOrderEditor from '@/components/BowlingOrderEditor';
import ScoreCardLive from '@/components/ScoreCardLive';
import Commentary from '@/components/Commentary';
import DetailedScorecard from '@/components/DetailedScorecard';
import SeriesSummary from '@/components/SeriesSummary';
import { MatchDetail, BallEvent, HistoryItem, SeriesSummaryData } from '@/types';

export default function Simulator() {
  const [stage, setStage] = useState<'setup' | 'live'>('setup');
  const [numMatches, setNumMatches] = useState(1);
  const [team1, setTeam1] = useState({ name: "India", players: Array(11).fill("") });
  const [team2, setTeam2] = useState({ name: "Australia", players: Array(11).fill("") });
  
  // Advanced State
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [eligibleBowlers1, setEligibleBowlers1] = useState<string[]>([]);
  const [eligibleBowlers2, setEligibleBowlers2] = useState<string[]>([]);
  const [bowlingOrder1, setBowlingOrder1] = useState<string[]>(Array(20).fill(""));
  const [bowlingOrder2, setBowlingOrder2] = useState<string[]>(Array(20).fill(""));
  const [loadingOrder1, setLoadingOrder1] = useState(false);
  const [loadingOrder2, setLoadingOrder2] = useState(false);

  const [matchDetail, setMatchDetail] = useState<MatchDetail | null>(null);
  const [ballEvents, setBallEvents] = useState<BallEvent[]>([]);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [seriesComplete, setSeriesComplete] = useState<SeriesSummaryData | null>(null);
  const [delayMs, setDelayMs] = useState(500); // Default to reasonable 500ms

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
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'https://hewhocodes247-cricket-transformer-api.hf.space';
    
    try {
      const res = await fetch(`${apiUrl}/generate_bowling_order`, {
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

    const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'https://hewhocodes247-cricket-transformer-api.hf.space';
    
    try {
      const res = await fetch(`${apiUrl}/eligible_bowlers`, {
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
    setStage('live');
    setBallEvents([]);
    setMatchDetail(null);
    setHistory([]);
    setSeriesComplete(null);

    const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'https://hewhocodes247-cricket-transformer-api.hf.space';

    // Determine Mode
    const isCustom = showAdvanced && bowlingOrder1.some(b=>b) && bowlingOrder2.some(b=>b);
    const endpoint = isCustom ? '/simulate_custom_match' : '/simulate_series_stream';
    
    const payload = isCustom ? {
        team1_name: team1.name,
        team1_players: team1.players,
        team1_bowling_order: bowlingOrder1,
        team2_name: team2.name,
        team2_players: team2.players,
        team2_bowling_order: bowlingOrder2,
        num_matches: numMatches
    } : {
        team1_name: team1.name,
        team1_players: team1.players,
        team2_name: team2.name,
        team2_players: team2.players,
        num_matches: numMatches
    };

    try {
      const response = await fetch(`${apiUrl}${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
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
        try {
          const data = JSON.parse(line);
          if (data.type === 'ball') {
            // Apply delay before updating state for ball events to simulate speed
            if (delayMs > 0) await wait(delayMs);

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
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value, { stream: true });
        buffer += chunk;
        const lines = buffer.split('\n');
        buffer = lines.pop() || "";
        
        // Loop through lines sequentially to respect the async delay in processLine
        for (const line of lines) {
           await processLine(line);
        }
      }
      if (buffer.trim()) await processLine(buffer);
    } catch (err) {
      console.error("Simulation Error:", err);
      alert("Simulation failure. Check console.");
      setStage('setup');
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
        <div className="flex items-center gap-4 bg-slate-800 p-3 rounded-xl border border-slate-700">
          <span className="text-slate-400 font-bold">Games:</span>
          <input 
            type="number" 
            
            value={numMatches} 
            onChange={e => setNumMatches(Math.max(1, parseInt(e.target.value) || 1))} 
            className="bg-slate-900 w-16 p-1 text-center font-bold text-emerald-400 border border-slate-700 rounded text-white"
          />
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

        {/* Speed Control */}
        <div className="flex items-center gap-4 bg-slate-900/50 p-4 rounded-xl border border-slate-800 w-full max-w-lg">
           <span className="text-slate-400 font-bold text-sm whitespace-nowrap">Sim Speed:</span>
           <input 
             type="range" 
             min="0" 
             max="1000" 
             step="50"
             value={delayMs} 
             onChange={(e) => setDelayMs(parseInt(e.target.value))}
             className="w-full accent-emerald-500 cursor-pointer"
           />
           <span className="text-emerald-400 font-mono text-xs w-16 text-right">
             {delayMs < 10 ? 'MAX' : `${delayMs}ms`}
           </span>
        </div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen p-6 bg-slate-950 flex flex-col items-center">
      {/* Header Bar */}
      <div className="w-full max-w-6xl flex justify-between items-center mb-6">
        <button onClick={() => setStage('setup')} className="text-xs font-bold text-slate-500 hover:text-white flex items-center gap-2 px-4 py-2 rounded-full bg-slate-900 border border-slate-800 transition hover:border-slate-600">
          <ArrowLeft className="w-4 h-4" /> BACK TO SETUP
        </button>
        {seriesComplete && <div className="text-emerald-400 font-black animate-pulse uppercase tracking-widest text-xs border border-emerald-500/20 px-3 py-1 rounded bg-emerald-500/5">Series Concluded</div>}
      </div>

      <div className="w-full max-w-6xl grid lg:grid-cols-2 gap-8">

        {/* LEFT COLUMN: LIVE ACTION (1/2 width) */}
        <div className="space-y-6">
          {/* Loading State */}
          {!matchDetail && !seriesComplete && (
            <div className="flex flex-col items-center justify-center h-96 text-slate-500 animate-pulse bg-slate-900/50 rounded-2xl border border-slate-800 border-dashed">
              <div className="text-6xl mb-6">🏏</div>
              <div className="font-mono text-sm uppercase tracking-widest text-emerald-500">Initializing Pitch...</div>
              <div className="text-xs text-slate-600 mt-2">Tossing coin... Checking field...</div>
            </div>
          )}

          <ScoreCardLive detail={matchDetail} live={!seriesComplete} />
        </div>

        {/* RIGHT COLUMN: COMMENTARY (1/2 width) */}
        <div className="">
          <Commentary events={ballEvents} />
        </div>
      </div>

      {/* FULL WIDTH BOTTOM SECTION: MATCH HISTORY / SCORECARDS */}
      <div className="w-full max-w-6xl mt-12 space-y-8">
        {seriesComplete && <SeriesSummary data={seriesComplete} />}

        {history.length > 0 && (
          <div>
            <h2 className="text-xl font-black text-slate-300 uppercase tracking-wider mb-6 flex items-center gap-3">
              <History className="w-6 h-6 text-slate-500" /> Match History
            </h2>

            <div className="grid gap-8">
              {history.map((m, idx) => (
                <HistoryMatchCard key={idx} match={m} index={idx} />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function HistoryMatchCard({ match, index }: { match: HistoryItem, index: number }) {
  const [isExpanded, setIsExpanded] = useState(false); // Changed default to false (minimized)

  return (
    <div className="bg-slate-950 rounded-2xl border border-slate-800 shadow-2xl overflow-hidden">
      {/* Match Header */}
      <div 
        onClick={() => setIsExpanded(!isExpanded)}
        className="bg-slate-900/50 p-4 flex justify-between items-center cursor-pointer hover:bg-slate-900 transition-colors select-none"
      >
        <div className="flex items-center gap-4">
          <button className="text-slate-500 hover:text-white transition">
            {isExpanded ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
          </button>
          <div>
            <span className="font-bold text-slate-300 block">Match {index + 1}</span>
            {!isExpanded && (
               <span className="text-xs text-slate-500">
                 {Object.entries(match.scorecard || {}).map(([team, data]) => `${team} ${data.score}`).join('  vs  ')}
               </span>
            )}
          </div>
        </div>
        
        <div className="text-right">
          <div className="text-emerald-400 font-bold">{match.winner} Won</div>
          <div className="text-xs text-slate-500">by {match.margin}</div>
        </div>
      </div>

      {/* Scorecards Container */}
      {isExpanded && (
        <div className="p-4 md:p-6 grid lg:grid-cols-2 gap-8 border-t border-slate-800 animate-in fade-in slide-in-from-top-4 duration-300">
          {match.scorecard && Object.entries(match.scorecard).map(([name, data]) => (
            <DetailedScorecard key={name} teamName={name} data={data} />
          ))}
        </div>
      )}
    </div>
  );
}
