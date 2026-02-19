'use client';

import { useState, useEffect, useRef } from 'react';
import { Model, BallEvent, MatchDetail, SeriesSummaryData } from '@/types';
import { getApiUrl } from '@/lib/api';
import ScoreCardLive from './ScoreCardLive';
import SeriesSummary from './SeriesSummary';

interface ModelSimulationProps {
  model: Model;
  payload: any;
  start: boolean;
}

export default function ModelSimulation({ model, payload, start }: ModelSimulationProps) {
  const [matchDetail, setMatchDetail] = useState<BallEvent | null>(null);
  
  // New state to partial aggregate data
  const [completedMatches, setCompletedMatches] = useState<any[]>([]);
  const [aggregatedStats, setAggregatedStats] = useState<any>({});

  const [seriesComplete, setSeriesComplete] = useState<SeriesSummaryData | null>(null);
  const [status, setStatus] = useState<'idle' | 'running' | 'complete' | 'error'>('idle');
  const [isExpanded, setIsExpanded] = useState(false);
  const simulationIdRef = useRef(0);

  // Helper to calculate summary from completed matches
  const getLiveSummary = () => {
    if (seriesComplete) return { ...seriesComplete, matches: completedMatches };
    if (completedMatches.length === 0) return null;

    const team1Name = payload.team1_name;
    const team2Name = payload.team2_name;

    let t1Wins = 0;
    let t2Wins = 0;
    let ties = 0;
    
    for (const h of completedMatches) {
        if (h.winner === team1Name) t1Wins++;
        else if (h.winner === team2Name) t2Wins++;
        else if (h.winner === 'Tie') ties++;
    }

    let header = "Series in Progress";
    if (t1Wins > t2Wins) header = `${team1Name} leads ${t1Wins}-${t2Wins}`;
    else if (t2Wins > t1Wins) header = `${team2Name} leads ${t2Wins}-${t1Wins}`;
    else header = `Series Level ${t1Wins}-${t2Wins}`;

    if (ties > 0) header += ` (${ties} ties)`;

    return {
        summary: { 
            scoreline: header,
            [team1Name]: t1Wins,
            [team2Name]: t2Wins,
            Tie: ties
        },
        matches: completedMatches
    };
  };

  const liveSummary = getLiveSummary();

  useEffect(() => {
    if (!start) return;

    const controller = new AbortController();

    const runSimulation = async () => {
      const simId = Date.now();
      simulationIdRef.current = simId;
      setStatus('running');
      setMatchDetail(null);
      setSeriesComplete(null);
      setCompletedMatches([]);
      setAggregatedStats({});

      try {
        const fullPayload = { ...payload, model: model.id };
        const response = await fetch(getApiUrl('/simulate_series_stream'), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(fullPayload),
          signal: controller.signal
        });

        if (!response.body) throw new Error("No response body");

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";

        const processLine = async (line: string) => {
          if (!line.trim()) return;
          try {
            const data = JSON.parse(line);
            if (data.type === 'ball') {
              if (simulationIdRef.current === simId) {
                  setMatchDetail(data.detail);
              }
            } else if (data.type === 'match_update') {
               // Store match result when a match finishes (or updates)
               if (simulationIdRef.current === simId) {
                  // We only want to store the FINAL state of the match
                  // The backend sends match_update after every ball? No, checking backend...
                  // Backend sends match_update at the END of the match loop in simulate_series_stream
                  // "yield json.dumps(match_data) + '\n'" is inside the loop but at the end.
                  setCompletedMatches(prev => {
                      // Check if we already have this match
                      const exists = prev.find(m => m.match_no === data.match_no);
                      if (exists) return prev.map(m => m.match_no === data.match_no ? data : m);
                      return [...prev, data];
                  });
               }
            } else if (data.type === 'series_complete') {
              if (simulationIdRef.current === simId) {
                  setSeriesComplete(data);
                  setStatus('complete');
              }
            }
          } catch (e) {
            console.error(e);
          }
        };

        while (true) {
          const { done, value } = await reader.read();
          if (done || simulationIdRef.current !== simId) break;
          const chunk = decoder.decode(value, { stream: true });
          buffer += chunk;
          const lines = buffer.split('\n');
          buffer = lines.pop() || "";
          for (const line of lines) {
             if (simulationIdRef.current !== simId) break;
             await processLine(line);
          }
        }
        if (buffer.trim() && simulationIdRef.current === simId) await processLine(buffer);
      } catch (err: any) {
        if (err.name === 'AbortError') {
           console.log(`Simulation aborted for ${model.name}`);
           return;
        }
        console.error(`Simulation error for ${model.name}:`, err);
        setStatus('error');
      }
    };

    runSimulation();
    
    return () => { 
        controller.abort();
        simulationIdRef.current = 0; 
    };
  }, [start, model, payload]);

  return (
    <div className="bg-slate-900 rounded-xl border border-slate-800 overflow-hidden flex flex-col h-full">
      <div className="p-3 bg-slate-800/50 border-b border-slate-700 flex justify-between items-center">
        <h3 className="font-bold text-white text-sm">{model.name}</h3>
        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${status === 'running' ? 'bg-emerald-500/20 text-emerald-400 animate-pulse' : status === 'complete' ? 'bg-blue-500/20 text-blue-400' : 'bg-slate-700 text-slate-400'}`}>
          {status.toUpperCase()}
        </span>
      </div>
      
      <div className="p-4 flex-1 flex flex-col gap-4 overflow-y-auto">
        {matchDetail ? (
           <div className={`transition-all duration-300 ${isExpanded ? 'opacity-0 h-0 overflow-hidden' : 'scale-90 origin-top-left w-[111%] -mb-4'}`}>
             <ScoreCardLive detail={matchDetail} live={status === 'running'} />
           </div>
        ) : (
            <div className={`flex-1 flex items-center justify-center text-slate-600 text-xs font-mono transition-all ${isExpanded ? 'opacity-0 h-0 overflow-hidden' : ''}`}>
                {status === 'running' ? 'Starting...' : 'Waiting to start...'}
            </div>
        )}
        
        {liveSummary && (
            <div className={`mt-auto pt-4 border-t border-slate-800 transition-all duration-300 ${isExpanded ? 'flex-1' : 'min-h-[300px]'}`}>
                <SeriesSummary 
                  data={liveSummary} 
                  isExpanded={isExpanded}
                  onToggleExpand={() => setIsExpanded(!isExpanded)}
                />
            </div>
        )}
      </div>
      
      {isExpanded && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-40" onClick={() => setIsExpanded(false)} />
      )}
    </div>
  );
}
