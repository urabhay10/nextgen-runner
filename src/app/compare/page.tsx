'use client';

import { useState, useEffect } from 'react';
import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import PlayerInput from '@/components/PlayerInput';
import ModelSimulation from '@/components/ModelSimulation';
import { fetchModels } from '@/lib/api';
import { Model } from '@/types';

export default function CompareModels() {
  const [stage, setStage] = useState<'setup' | 'live'>('setup');
  const [numMatches, setNumMatches] = useState(1);
  const [models, setModels] = useState<Model[]>([]);
  
  const [team1, setTeam1] = useState({ 
      name: "India", 
      players: ["RG Sharma", "V Kohli", "RR Pant", "SA Yadav", "S Dube", "HH Pandya", "RA Jadeja", "AR Patel", "Kuldeep Yadav", "JJ Bumrah", "Arshdeep Singh"] 
  });
  const [team2, setTeam2] = useState({ 
      name: "Australia", 
      players: ["DA Warner", "TM Head", "MR Marsh", "GJ Maxwell", "MP Stoinis", "TH David", "MS Wade", "PJ Cummins", "MA Starc", "A Zampa", "JR Hazlewood"] 
  });

  useEffect(() => {
    fetchModels().then(data => {
      // Ensure data is valid array before setting
      if (Array.isArray(data)) {
        setModels(data);
      } else {
        console.error("fetchModels returned non-array:", data);
        setModels([]);
      }
    }).catch(err => {
        console.error("fetchModels failed:", err);
        setModels([]);
    });
  }, []);

  const updatePlayer = (tId: 1 | 2, idx: number, v: string) => {
    const setTeam = tId === 1 ? setTeam1 : setTeam2;
    const team = tId === 1 ? team1 : team2;
    const n = [...team.players];
    n[idx] = v;
    setTeam({ ...team, players: n });
  };

  const startComparison = () => {
    setStage('live');
  };

  if (stage === 'setup') return (
    <div className="min-h-screen p-8 max-w-6xl mx-auto dark:bg-[#0f172a]">
      <header className="mb-12 text-center relative">
          <Link href="/" className="absolute left-0 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white transition flex items-center gap-2 text-sm font-bold bg-slate-800 px-4 py-2 rounded-full border border-slate-700">
            <ArrowLeft className="w-4 h-4" /> BACK TO HOME
          </Link>
        <h1 className="text-5xl font-black bg-gradient-to-r from-blue-400 to-indigo-500 bg-clip-text text-transparent tracking-tight">MODEL COMPARISON</h1>
        <p className="text-slate-400 mt-2 font-mono text-sm">Run parallel simulations across multiple AI models</p>
      </header>

      <div className="grid md:grid-cols-2 gap-12">
        <div className="space-y-4">
          <input 
            value={team1.name} 
            onChange={e => setTeam1({ ...team1, name: e.target.value })} 
            className="w-full bg-transparent text-2xl font-bold border-b-2 border-slate-700 focus:border-blue-500 outline-none pb-2 text-blue-400" 
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
            className="w-full bg-transparent text-2xl font-bold border-b-2 border-slate-700 focus:border-indigo-500 outline-none pb-2 text-indigo-400 text-right" 
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
          <span className="text-slate-400 font-bold">Games per Model:</span>
          <input 
            type="number" 
            value={numMatches} 
            onChange={e => setNumMatches(Math.max(1, parseInt(e.target.value) || 1))} 
            className="bg-slate-900 w-16 p-1 text-center font-bold text-blue-400 border border-slate-700 rounded text-white"
          />
        </div>
        
        <button 
          onClick={startComparison}
          className="px-12 py-4 bg-gradient-to-r from-blue-600 to-indigo-600 rounded-2xl font-black text-xl text-white shadow-xl shadow-blue-900/20 hover:scale-105 active:scale-95 transition-all"
        >
          START COMPARISON ({models.length} Models)
        </button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-[#0f172a] text-white p-6">
      <header className="mb-8 flex justify-between items-center max-w-[1800px] mx-auto">
        <button onClick={() => setStage('setup')} className="text-slate-500 hover:text-white transition flex items-center gap-2 text-sm font-bold">
          <ArrowLeft className="w-4 h-4" /> RESTART COMPARISON
        </button>
        <div className="text-right">
          <h1 className="text-xl font-black text-white">Parallel Simulation</h1>
          <div className="text-xs text-slate-400 font-mono">Comparing {models.length} Models • {numMatches} Match Series</div>
        </div>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 max-w-[1800px] mx-auto">
        {models.map(model => (
          <ModelSimulation 
            key={model.id} 
            model={model} 
            start={true}
            payload={{
               team1_name: team1.name,
               team1_players: team1.players,
               team2_name: team2.name,
               team2_players: team2.players,
               num_matches: numMatches
            }} 
          />
        ))}
      </div>
    </div>
  );
}
