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
  playerIdMap?: Record<string, string | number>;
}

export default function ModelSimulation({ model, payload, start, playerIdMap }: ModelSimulationProps) {
  const [matchDetail, setMatchDetail] = useState<BallEvent | null>(null);
  const [completedMatches, setCompletedMatches] = useState<any[]>([]);
  const [liveSummary, setLiveSummary] = useState<any>(null);
  const [seriesComplete, setSeriesComplete] = useState<SeriesSummaryData | null>(null);
  const [status, setStatus] = useState<'idle' | 'running' | 'complete' | 'error'>('idle');
  const simulationIdRef = useRef(0);

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
      setLiveSummary(null);

      try {
        const fullPayload = { ...payload, model: model.id };
        const endpoint = fullPayload.team1_bowling_order ? '/simulate_custom_match' : '/simulate_series_stream';
        const response = await fetch(getApiUrl(endpoint), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(fullPayload),
          cache: 'no-store'
        });

        if (!response.ok) throw new Error('Simulation failed');
        if (!response.body) throw new Error('No response body');

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
            } else if (data.type === 'match_update' || data.type === 'match_complete') {
               if (simulationIdRef.current === simId) {
                  setCompletedMatches(prev => {
                      const exists = prev.find(m => m.match_no === data.match_no);
                      const updated = exists ? prev.map(m => m.match_no === data.match_no ? data : m) : [...prev, data];
                      // Build live summary from updated matches
                      let t1Wins = 0, t2Wins = 0, ties = 0;
                      let t1Name = '', t2Name = '';
                      updated.forEach(m => {
                          const teams = Object.keys(m.scorecard || {});
                          if (!t1Name && teams.length >= 2) { t1Name = teams[0]; t2Name = teams[1]; }
                          if (m.winner === t1Name) t1Wins++;
                          else if (m.winner === t2Name) t2Wins++;
                          else if (m.winner === 'Tie') ties++;
                      });
                      const scoreline = t1Wins > t2Wins ? `${t1Name} leads ${t1Wins}-${t2Wins}` :
                          t2Wins > t1Wins ? `${t2Name} leads ${t2Wins}-${t1Wins}` :
                          `Level ${t1Wins}-${t2Wins}`;
                      setLiveSummary({ summary: { scoreline, [t1Name]: t1Wins, [t2Name]: t2Wins, Tie: ties }, matches: updated });
                      return updated;
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
    <div className="rounded-xl border overflow-hidden flex flex-col h-full" style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}>
      <div className="p-3 border-b flex justify-between items-center" style={{ background: 'var(--surface-2)', borderColor: 'var(--border)' }}>
        <h3 className="font-bold text-white text-sm">{model.name}</h3>
        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${status === 'running' ? 'animate-pulse' : ''}`}
          style={{
            background: status === 'running' ? 'rgba(var(--sage-green-rgb), 0.2)' : status === 'complete' ? 'rgba(var(--sandy-brown-rgb), 0.2)' : 'var(--surface)',
            color: status === 'running' ? 'var(--sage-green)' : status === 'complete' ? 'var(--sandy-brown)' : 'var(--muted)'
          }}
        >
          {status.toUpperCase()}
        </span>
      </div>
      
      <div className="p-4 flex-1 flex flex-col gap-4 overflow-hidden">
        {matchDetail ? (
           <div className="flex-none scale-90 origin-top-left w-[111%] -mb-4">
             <ScoreCardLive detail={matchDetail} live={status === 'running'} playerIdMap={playerIdMap} />
           </div>
        ) : (
            <div className="flex-1 flex items-center justify-center text-xs font-mono" style={{ color: 'var(--muted)' }}>
                {status === 'running' ? 'Starting...' : 'Waiting to start...'}
            </div>
        )}
        
        {/* Live summary — shown during running AND after complete */}
        {(liveSummary || seriesComplete) && (
            <div className="flex-1 min-h-0 overflow-hidden mt-2">
                <SeriesSummary data={seriesComplete ? {...seriesComplete, matches: completedMatches} : liveSummary} />
            </div>
        )}
      </div>
    </div>
  );
}
