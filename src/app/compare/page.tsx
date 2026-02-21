'use client';

import { useState, useEffect, useRef } from 'react';
import { ArrowLeft, ChevronDown, Check } from 'lucide-react';
import Link from 'next/link';
import PlayerInput from '@/components/PlayerInput';
import BowlingOrderEditor from '@/components/BowlingOrderEditor';
import ModelSimulation from '@/components/ModelSimulation';
import { fetchModels, getApiUrl } from '@/lib/api';
import { Model } from '@/types';

export default function CompareModels() {
  const [stage, setStage] = useState<'setup' | 'live'>('setup');
  const [numMatches, setNumMatches] = useState<string>('1');
  const [models, setModels] = useState<Model[]>([]);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const [selectedModels, setSelectedModels] = useState<string[]>([]);
  const [playerIdMap, setPlayerIdMap] = useState<Record<string, string | number>>({});
  
  const [team1, setTeam1] = useState({ 
      name: "India", 
      players: ["RG Sharma", "V Kohli", "RR Pant", "SA Yadav", "S Dube", "HH Pandya", "RA Jadeja", "AR Patel", "Kuldeep Yadav", "JJ Bumrah", "Arshdeep Singh"] 
  });
  const [team2, setTeam2] = useState({ 
      name: "Australia", 
      players: ["DA Warner", "TM Head", "MR Marsh", "GJ Maxwell", "MP Stoinis", "TH David", "MS Wade", "PJ Cummins", "MA Starc", "A Zampa", "JR Hazlewood"] 
  });

  // Advanced State
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [eligibleBowlers1, setEligibleBowlers1] = useState<string[]>([]);
  const [eligibleBowlers2, setEligibleBowlers2] = useState<string[]>([]);
  const [bowlingOrder1, setBowlingOrder1] = useState<string[]>(Array(20).fill(""));
  const [bowlingOrder2, setBowlingOrder2] = useState<string[]>(Array(20).fill(""));
  const [loadingOrder1, setLoadingOrder1] = useState(false);
  const [loadingOrder2, setLoadingOrder2] = useState(false);

  useEffect(() => {
    fetchModels().then(data => {
      // Ensure data is valid array before setting
      if (Array.isArray(data)) {
        setModels(data);
        setSelectedModels(data.map(m => m.id));
      } else {
        console.error("fetchModels returned non-array:", data);
        setModels([]);
      }
    }).catch(err => {
        console.error("fetchModels failed:", err);
        setModels([]);
    });
  }, []);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const fetchDefaultBowlingOrder = async (teamId: 1 | 2) => {
    const team = teamId === 1 ? team1 : team2;
    const setOrder = teamId === 1 ? setBowlingOrder1 : setBowlingOrder2;
    const setLoading = teamId === 1 ? setLoadingOrder1 : setLoadingOrder2;

    const activePlayers = team.players.filter(p => p.trim() !== "");
    if (activePlayers.length < 5) return;

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

  useEffect(() => {
    if (showAdvanced) {
      if (bowlingOrder1.every(b => b === "") && team1.players.some(p => p)) fetchDefaultBowlingOrder(1);
      if (bowlingOrder2.every(b => b === "") && team2.players.some(p => p)) fetchDefaultBowlingOrder(2);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showAdvanced]);

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
    const setTeam = tId === 1 ? setTeam1 : setTeam2;
    const team = tId === 1 ? team1 : team2;
    const n = [...team.players];
    n[idx] = v;
    setTeam({ ...team, players: n });
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

  const startComparison = () => {
    setStage('live');
  };

  const toggleModelSelection = (modelId: string) => {
    setSelectedModels(prev => 
      prev.includes(modelId) 
        ? prev.filter(id => id !== modelId)
        : [...prev, modelId]
    );
  };

  if (stage === 'setup') return (
    <div className="min-h-screen p-8 max-w-6xl mx-auto" style={{ background: 'var(--background)' }}>
      <header className="mb-12 text-center relative">
          <Link href="/" className="absolute left-0 top-1/2 -translate-y-1/2 transition flex items-center gap-2 text-sm font-bold px-4 py-2 rounded-full border" style={{ color: 'var(--muted)', background: 'var(--surface)', borderColor: 'var(--border)' }}>
            <ArrowLeft className="w-4 h-4" />
            Back
          </Link>
          <h1 className="text-4xl font-black tracking-tight" style={{ color: 'var(--foreground)' }}>
            MODEL COMPARISON
          </h1>
          <p className="mt-2 font-mono text-sm" style={{ color: 'var(--muted)' }}>Run parallel simulations across multiple AI models</p>
        </header>

      <div className="grid md:grid-cols-2 gap-8">
        {/* Team 1 */}
        <div className="space-y-2">
          <div className="flex items-center gap-3 mb-4 pb-3 border-b" style={{ borderColor: 'var(--border)' }}>
            <div className="w-1.5 h-8 rounded-full" style={{ background: 'var(--sage-green)' }}></div>
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
            <div className="w-1.5 h-8 rounded-full" style={{ background: 'var(--sandy-brown)' }}></div>
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
            borderColor: 'var(--border)'
          }}
        >
          {showAdvanced ? 'Hide Advanced Settings' : 'Show Advanced Settings'}
        </button>
      </div>

      <div className="mt-12 flex flex-col items-center gap-5">
        {/* Config row */}
        <div className="flex items-stretch gap-0 rounded-xl border divide-x" style={{ borderColor: 'var(--border)', background: 'var(--surface)' }}>
          <div className="flex flex-col justify-center px-6 py-4 gap-1 rounded-l-xl" style={{ borderRightColor: 'var(--border)' }}>
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
                style={{ background: 'var(--surface-2)', borderColor: dropdownOpen ? 'var(--sage-green)' : 'var(--border)', color: 'var(--foreground)' }}
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
          onClick={startComparison}
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
          <ArrowLeft className="w-4 h-4" />
          Back to Setup
        </button>
        <div className="text-right">
          <h1 className="text-xl font-black text-white">Parallel Simulation</h1>
          <div className="text-xs font-mono" style={{ color: 'var(--muted)' }}>Comparing {selectedModels.length} Models • {numMatches} Match Series</div>
        </div>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 max-w-[1800px] mx-auto">
        {models.filter(m => selectedModels.includes(m.id)).map(model => (
          <ModelSimulation 
            key={model.id} 
            model={model} 
            start={true}
            playerIdMap={playerIdMap}
            payload={{
               team1_name: team1.name,
               team1_players: team1.players,
               team2_name: team2.name,
               team2_players: team2.players,
               team1_bowling_order: showAdvanced ? bowlingOrder1 : undefined,
               team2_bowling_order: showAdvanced ? bowlingOrder2 : undefined,
               num_matches: Math.max(1, parseInt(numMatches) || 1)
            }}
          />
        ))}
      </div>
    </div>
  );
}
